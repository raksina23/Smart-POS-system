import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ใช้ service key ตัวเดียวกับ route สร้าง user ของคุณ (ชื่อ env อาจต่างกัน)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ===== ส่วนเดียวที่ต้องแก้ให้ตรงกับเอกสาร API ของ dotBLUE =====
async function callDotBlue(prompt: string): Promise<string> {
  const res = await fetch(process.env.DOTBLUE_API_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DOTBLUE_API_KEY}`, // ปรับตามเอกสาร
    },
    body: JSON.stringify({ message: prompt }), // ปรับตามเอกสาร
  });
  if (!res.ok) throw new Error(`dotBLUE error ${res.status}`);
  const data = await res.json();
  return String(data.answer); // ปรับชื่อ field ตามเอกสาร
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
    rows = (data as unknown[]).slice(0, 40);
    prompt =
      `You are an inventory assistant for a small grocery store. The JSON below was computed by the system from the last 28 days of sales.\n` +
      `Rules: use ONLY these numbers. Never change suggested_qty. If suggested_qty is 0, say no purchase is needed. ` +
      `If units_sold is 0, say the item is not selling and should not be restocked. Mention at most 8 items. ` +
      `Reply in Thai, short lines, grouped under "ควรซื้อเพิ่ม" and "ไม่ต้องซื้อเพิ่ม".\nDATA: ${JSON.stringify(rows)}`;
  } else if (kind === "shelf") {
    const { data, error } = await admin.rpc("get_product_pairs", { days_window: 30, min_orders: 3 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows = data as unknown[];
    if (rows.length === 0)
      return NextResponse.json({ error: "ยังไม่มีบิลที่ซื้อสินค้าคู่กันมากพอ (ต้องซ้ำอย่างน้อย 3 บิล)" }, { status: 422 });
    prompt =
      `You are a retail layout assistant for a small grocery store. The JSON below lists product pairs bought in the same bill (last 30 days). ` +
      `confidence_pct = % of bills with product_a that also contain product_b. lift above 1 means bought together more than chance.\n` +
      `Rules: use ONLY these numbers; suggest which pairs to place close together and why; do not invent products. Reply in Thai, max 6 lines.\nDATA: ${JSON.stringify(rows)}`;
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