import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ใช้ service key ตัวเดียวกับ route สร้าง user ของคุณ (ชื่อ env อาจต่างกัน)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ===== ส่วนเรียก dotBLUE =====
function parseCompletion(text: string): string {
  // กรณีตอบเป็น JSON ปกติ
  try {
    const data = JSON.parse(text);
    return data.choices?.[0]?.message?.content ?? "";
  } catch {
    // กรณีตอบเป็น stream (SSE): แต่ละบรรทัดขึ้นต้นด้วย "data:" ให้ต่อข้อความจากทุกชิ้น
    let out = "";
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") break;
      try {
        const chunk = JSON.parse(payload);
        out +=
          chunk.choices?.[0]?.delta?.content ??
          chunk.choices?.[0]?.message?.content ??
          "";
      } catch {
        // ข้ามบรรทัดที่ไม่ใช่ JSON
      }
    }
    return out;
  }
}

async function callDotBlue(prompt: string): Promise<string> {
  const res = await fetch(process.env.DOTBLUE_API_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DOTBLUE_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.DOTBLUE_MODEL,
      stream: false, // ขอให้ตอบเป็นก้อนเดียว
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`dotBLUE error ${res.status}: ${text.slice(0, 200)}`);

  const content = parseCompletion(text).trim();
  if (!content) throw new Error(`dotBLUE ตอบว่าง: ${text.slice(0, 200)}`);
  return content;
}
// ===============================================================

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const { data } = await admin.auth.getUser(token);
  if (!data.user) return false;
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  return profile?.role?.toLowerCase() === "admin";
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data } = await admin
    .from("ai_recommendations")
    .select("kind, content, source_data, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const latest = (kind: string) => data?.find((r) => r.kind === kind) ?? null;
  return NextResponse.json({ purchase: latest("purchase"), shelf: latest("shelf") });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { kind } = await req.json();
  let rows: unknown[] = [];
  let prompt = "";

  if (kind === "purchase") {
    const { data, error } = await admin.rpc("get_purchase_plan", { days_window: 28, cover_days: 14 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    type PlanRow = {
      product_id: string;
      name: string;
      units_sold: number;
      avg_daily: number;
      current_stock: number;
      suggested_qty: number;
    };

    const all = (data as PlanRow[]).map((r) => ({
      ...r,
      // ของจะหมดในกี่วัน คำนวณโดยโค้ด ไม่ให้ AI คำนวณเอง
      days_left: r.avg_daily > 0 ? Math.floor(r.current_stock / r.avg_daily) : null,
    }));

    rows = all.slice(0, 40); // ใช้แสดงตารางใต้การ์ด

    const toBuy = all
      .filter((r) => r.suggested_qty > 0)
      .sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999)); // เร่งด่วนก่อน

    const aiInput = {
      total_items_to_buy: toBuy.length,
      total_units_to_buy: toBuy.reduce((sum, r) => sum + r.suggested_qty, 0),
      top_items_to_buy: toBuy.slice(0, 5).map((r) => ({
        name: r.name,
        buy_qty: r.suggested_qty,
        days_left: r.days_left,
      })),
      no_sales_28_days: all.filter((r) => r.units_sold === 0).slice(0, 3).map((r) => r.name),
    };

    prompt =
      `You help a small grocery store owner decide what to buy. The JSON below is computed by the system. Use ONLY these values; never change or add numbers.\n` +
      `Reply in simple, friendly Thai, using exactly this layout and nothing else:\n` +
      `Line 1: one short sentence saying how many items should be bought and the total units (use total_items_to_buy and total_units_to_buy).\n` +
      `Then the heading "🛒 ควรซื้อ (เรียงจากเร่งด่วนที่สุด)" followed by one line per item in top_items_to_buy, in the same order, formatted as "• name — ซื้อ buy_qty ชิ้น (ของจะหมดใน days_left วัน)". If days_left is null, omit the brackets.\n` +
      `If no_sales_28_days is not empty, add a final line "⏸ ไม่มียอดขายเลยใน 28 วัน ยังไม่ต้องซื้อ: " followed by the names separated by commas.\n` +
      `If top_items_to_buy is empty, reply only "ตอนนี้สต็อกยังพอขาย ไม่ต้องซื้อเพิ่ม".\n` +
      `Do not explain formulas or add advice.\nDATA: ${JSON.stringify(aiInput)}`;
  }else if (kind === "shelf") {
    const { data, error } = await admin.rpc("get_product_pairs", { days_window: 30, min_orders: 3 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    type PairRow = {
      product_a: string;
      product_b: string;
      pair_orders: number;
      total_bills: number;
      bills_a: number;
      bills_b: number;
      lift: number;
    };

    // เกณฑ์ว่าคู่ไหนคุ้มจัดวางใกล้กัน ปรับตามขนาดร้านได้
    const MIN_BILLS = 10; // ต้องอยู่ในบิลเดียวกันอย่างน้อยกี่บิล
    const MIN_LIFT = 1.2; // 1.0 = บังเอิญล้วนๆ
    const STRONG_LIFT = 1.5; // ตั้งแต่ค่านี้ขึ้นไปติดป้าย "บ่อยมาก"

    const strong = (data as PairRow[])
      .filter((p) => p.pair_orders >= MIN_BILLS && p.lift >= MIN_LIFT)
      .slice(0, 5)
      .map((p) => ({
        product_a: p.product_a,
        product_b: p.product_b,
        pair_orders: p.pair_orders,
        total_bills: p.total_bills,
        together_pct: Math.round((100 * p.pair_orders) / p.total_bills), // % ของบิลทั้งหมด
        a_to_b_pct: Math.round((100 * p.pair_orders) / p.bills_a), // ซื้อ A แล้วซื้อ B ด้วย
        b_to_a_pct: Math.round((100 * p.pair_orders) / p.bills_b), // ซื้อ B แล้วซื้อ A ด้วย
        strength: p.lift >= STRONG_LIFT ? "strong" : "medium",
      }));

    if (strong.length === 0)
      return NextResponse.json(
        { error: "ยังไม่พบสินค้าคู่ที่ซื้อด้วยกันบ่อยพอ (ต้องอยู่ในบิลเดียวกันอย่างน้อย 10 บิลใน 30 วัน)" },
        { status: 422 }
      );

    rows = strong; // ข้อมูลใต้การ์ดจะตรงกับที่ AI ใช้

    const aiInput = {
      total_bills: strong[0].total_bills,
      pairs_found: strong.length,
      pairs: strong.map((p) => ({
        product_a: p.product_a,
        product_b: p.product_b,
        bills_together: p.pair_orders,
      })),
    };

    prompt =
      `You help a small grocery store owner arrange shelves. The JSON lists product pairs often bought in the same bill during the last 30 days. Use ONLY these values; never add numbers or products.\n` +
      `Reply in simple, friendly Thai using exactly this layout and nothing else:\n` +
      `First line: "พบ {pairs_found} คู่สินค้าที่ควรวางใกล้กัน จากบิลย้อนหลัง 30 วัน ({total_bills} บิล)"\n` +
      `Then one line per pair in pairs, in the same order: "• product_a + product_b — ซื้อพร้อมกัน bills_together บิล"\n` +
      `Last line: start with "💡" and give one short practical tip (at most 20 words) about placing these pairs on the same shelf or next to each other.\n` +
      `Do not mention lift, confidence, or any statistics terms.\nDATA: ${JSON.stringify(aiInput)}`;
  } else {
    return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  }

  try {
    const content = await callDotBlue(prompt);
    await admin.from("ai_recommendations").insert({ kind, content, source_data: rows });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}