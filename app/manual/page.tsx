"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";

type Section = {
  id: string;
  icon: string;
  title: string; // ไทย
  subtitle: string; // English
  admin?: boolean; // true = เห็นเฉพาะ Admin
  numbered?: boolean; // ค่าเริ่มต้น true
  steps: string[];
  tips?: string[];
};

const SECTIONS: Section[] = [
  {
    id: "start",
    icon: "🔐",
    title: "เริ่มต้นใช้งาน",
    subtitle: "Getting Started",
    steps: [
      "เปิดเว็บของร้านในเบราว์เซอร์ กรอกชื่อผู้ใช้งานและรหัสผ่านที่ผู้ดูแลระบบสร้างให้ แล้วกด “เข้าสู่ระบบ”",
      "บัญชี Admin เห็นเมนูครบทุกหน้า ส่วนบัญชี Cashier เห็นเฉพาะหน้าขาย (POS) และคู่มือนี้",
      "เมื่อใช้งานเสร็จ กด Logout ในเมนูเพื่อออกจากระบบ (บนมือถือกดปุ่มเมนู ☰ มุมขวาบน)",
    ],
    tips: ["ใช้งานได้ทั้งบนคอมพิวเตอร์และมือถือ ไม่ต้องติดตั้งโปรแกรมเพิ่ม"],
  },
  {
    id: "pos",
    icon: "🛒",
    title: "การขายสินค้า (POS)",
    subtitle: "Making a Sale",
    steps: [
      "เปิดหน้า POS จากเมนู",
      "เพิ่มสินค้าด้วยการสแกน: กดกรอบ “กดเพื่อเปิดกล้องสแกน” อนุญาตให้เบราว์เซอร์ใช้กล้อง แล้วถือบาร์โค้ดให้อยู่ในภาพ",
      "หรือพิมพ์เลขบาร์โค้ดในช่อง “คีย์บาร์โค้ดด้วยตนเอง” แล้วกด Enter",
      "สินค้าจะเข้าตะกร้า ใช้ปุ่ม + และ − เพิ่มลดจำนวน หรือกด ✕ เพื่อลบ ระบบไม่ให้ขายเกินจำนวนสต็อกที่มี",
      "ตรวจ “ยอดรวมทั้งสิ้น” แล้วกด “ชำระเงิน (Checkout)”",
      "เลือกวิธีชำระเงิน เงินสด หรือ โอนเงิน/QR ถ้าเป็นเงินสด กรอกจำนวนเงินที่รับ แล้วกด “คำนวณ” เพื่อดูเงินทอน",
      "กด “ยืนยันการชำระเงิน” ระบบจะบันทึกการขายและตัดสต็อกให้อัตโนมัติ จากนั้นกด “ขายต่อ” เพื่อเริ่มบิลใหม่",
    ],
    tips: [
      "ถ้าต้องการยกเลิกก่อนจ่ายเงิน กด “ยกเลิกออเดอร์”",
      "ระบบตัดสต็อกจากล็อตที่ใกล้หมดอายุที่สุดก่อนเสมอ (FEFO) พนักงานไม่ต้องเลือกล็อตเอง",
      "สแกนไม่ติด: ถือบาร์โค้ดห่างจากกล้อง 10-15 ซม. ให้นิ่ง แสงสว่างพอ และไม่มีแสงสะท้อน หรือพิมพ์เลขบาร์โค้ดแทน",
    ],
  },
  {
    id: "inventory",
    icon: "📦",
    title: "จัดการคลังสินค้า",
    subtitle: "Inventory",
    admin: true,
    steps: [
      "เปิดหน้า Inventory ค้นหาสินค้าด้วยชื่อหรือบาร์โค้ด หรือกรองตามหมวดหมู่ ในการ์ดสินค้าจะเห็นสต็อกรวม ราคา ต้นทุน กำไร และวันหมดอายุที่ใกล้ที่สุด",
      "เพิ่มสินค้าใหม่: กด “+ เพิ่มสินค้า” กรอกชื่อ บาร์โค้ด หมวดหมู่ ราคาขาย ราคาทุน จำนวนเริ่มต้น และจำนวนขั้นต่ำ (ระบบจะเตือนเมื่อสต็อกเหลือเท่านี้หรือต่ำกว่า) แล้วกด “บันทึกสินค้า” จะใส่รูปสินค้าด้วยก็ได้",
      "เมื่อเลือกหมวดหมู่ ระบบจะเสนอวันหมดอายุให้ตามอายุสินค้าของหมวดนั้น แก้ไขเองได้ถ้าวันจริงต่างออกไป",
      "รับสินค้าเข้าเพิ่ม: กด “รับสินค้า / Restock” ที่สินค้านั้น ใส่จำนวนที่รับและตรวจวันหมดอายุ แล้วกดบันทึก ระบบจะสร้างเป็นล็อตใหม่ ไม่ทับล็อตเดิม",
      "แก้ไขข้อมูลหรือรูป: กด “แก้ไข / Edit” (จำนวนสต็อกแก้ที่นี่ไม่ได้ ให้ใช้ Restock)",
      "ลบสินค้า: กด “ลบ / Delete” แล้วยืนยัน",
      "ดูล็อต: ถ้าสินค้ามีหลายล็อต กดป้าย “N ล็อต” เพื่อดูรายการ เรียงตามวันหมดอายุ ล็อตแรกคือล็อตที่จะถูกขายก่อน",
    ],
    tips: [
      "ป้ายสีส้ม “สต็อกต่ำ” = สต็อกรวมต่ำกว่าหรือเท่ากับจำนวนขั้นต่ำ ป้ายสีแดง “ใกล้หมดอายุ” = มีล็อตที่จะหมดอายุภายใน 7 วัน",
    ],
  },
  {
    id: "categories",
    icon: "🏷️",
    title: "จัดการหมวดหมู่",
    subtitle: "Categories",
    admin: true,
    steps: [
      "เปิดหน้า Categories (จัดการหมวดหมู่)",
      "ตั้ง “อายุ (วัน)” ของแต่ละหมวด ระบบใช้คำนวณวันหมดอายุให้อัตโนมัติเมื่อเพิ่มสินค้าหรือรับสินค้าเข้า เว้นว่างถ้าไม่ต้องการให้คำนวณ",
      "ตั้ง “ลด %” ของแต่ละหมวด ระบบใช้คำนวณราคาลดเมื่อสินค้าล็อตนั้นใกล้หมดอายุ (ราคาลดจะไม่ต่ำกว่าราคาทุน)",
      "เพิ่มหมวดใหม่ที่แถบ “เพิ่มหมวดหมู่ใหม่” หรือกด “ลบ” เพื่อลบหมวด (ลบไม่ได้ถ้ายังมีสินค้าใช้หมวดนั้นอยู่)",
    ],
    tips: ["แก้ตัวเลขแล้วคลิกที่อื่นเพื่อบันทึก"],
  },
  {
    id: "dashboard",
    icon: "📊",
    title: "แดชบอร์ดและการแจ้งเตือน",
    subtitle: "Dashboard & Alerts",
    admin: true,
    steps: [
      "หน้า Dashboard แสดงยอดขายวันนี้ จำนวนบิล กำไรวันนี้ ยอดขายเดือนนี้ และกราฟยอดขาย/กำไรรายเดือน",
      "สินค้าใกล้หมดอายุ: แสดงล็อตที่จะหมดอายุภายใน 7 วัน ปุ่มลดราคาจะแสดงราคาก่อนและหลังลดที่ระบบคำนวณจาก % ของหมวดหมู่ ตรวจแล้วกดยืนยัน 1 ครั้ง",
      "สินค้าสต็อกต่ำ: ข้อความใต้ชื่อสินค้าบอกว่าควรทำอะไร “ควรเติมสต็อก” คือยังมีล็อตสำรอง หยิบมาเติมได้ ส่วน “ควรซื้อของเข้าร้านเพิ่ม” คือไม่มีล็อตสำรองแล้ว",
      "สร้างใบสั่งซื้อ: ติ๊กเลือกสินค้าที่ต้องการ แล้วกด “สร้างใบสั่งซื้อ” ระบบจะไปหน้าใบสั่งซื้อ กด “บันทึกเป็นรูป” เพื่อเก็บภาพส่งให้ผู้ขาย",
      "กระดิ่ง 🔔 ที่แถบเมนูแสดงจำนวนรายการที่ต้องดูจากทุกหน้า และจะมีหน้าต่างสรุปเด้งขึ้น 1 ครั้งหลังเข้าสู่ระบบ",
    ],
    tips: ["ถ้าหมวดหมู่ยังไม่ได้ตั้ง % ลดราคา จะไม่มีปุ่มลดราคา ให้ตั้งที่หน้า Categories ก่อน"],
  },
  {
    id: "ai",
    icon: "🤖",
    title: "AI Insights (ผู้ช่วยวิเคราะห์)",
    subtitle: "AI Insights",
    admin: true,
    steps: [
      "อยู่ด้านล่างของหน้า Dashboard มี 2 การ์ด คือ แผนการซื้อของเข้าร้าน และแนะนำการจัดชั้นวาง",
      "กด “วิเคราะห์ / Analyze” ในการ์ดที่ต้องการ รอสักครู่ ผลจะแสดงและถูกบันทึกไว้ กดอีกครั้งเมื่อต้องการข้อมูลล่าสุด",
      "แผนการซื้อของ: แสดงสินค้าที่ควรซื้อ จำนวนที่แนะนำ และของจะหมดในกี่วัน เรียงจากเร่งด่วนที่สุด คำนวณจากยอดขาย 28 วันล่าสุดและสต็อกคงเหลือ",
      "แนะนำการจัดชั้นวาง: แสดงคู่สินค้าที่ลูกค้าซื้อพร้อมกันบ่อย ควรวางไว้ใกล้กัน คิดจากบิลย้อนหลัง 30 วัน",
    ],
    tips: [
      "ตัวเลขทั้งหมดคำนวณโดยระบบจากข้อมูลการขายจริง AI ช่วยสรุปเป็นข้อความเท่านั้น คำแนะนำเป็นแนวทาง เจ้าของร้านเป็นผู้ตัดสินใจ",
      "ต้องมีบิลสะสมมากพอจึงจะแนะนำได้ ถ้าขึ้นว่าข้อมูลไม่พอ ให้รอให้มียอดขายเพิ่มขึ้น",
    ],
  },
  {
    id: "history",
    icon: "📋",
    title: "ประวัติการขาย",
    subtitle: "Sales History",
    admin: true,
    steps: [
      "เปิดหน้า Sales History เพื่อดูสินค้าขายดี 5 อันดับแรก พร้อมจำนวนที่ขาย ราคา และกำไร",
      "ดูประวัติธุรกรรมทั้งหมด ประกอบด้วยเลขที่บิล ราคา วันที่ เวลา และวิธีชำระเงิน",
    ],
  },
  {
    id: "users",
    icon: "👥",
    title: "จัดการผู้ใช้งาน",
    subtitle: "Users",
    admin: true,
    steps: [
      "เปิดหน้า Users เพื่อดูบัญชีทั้งหมดของร้าน",
      "Admin สามารถสร้างบัญชีใหม่ จัดการบัญชี และลบบัญชีที่ไม่ใช้แล้ว",
      "แนะนำให้ใช้บัญชี Cashier กับพนักงานขายหน้าร้าน เพราะเห็นเฉพาะหน้าขาย",
    ],
  },
  {
    id: "troubleshooting",
    icon: "🛠️",
    title: "แก้ปัญหาเบื้องต้น",
    subtitle: "Troubleshooting",
    numbered: false,
    steps: [
      "กล้องเปิดไม่ได้: กดอนุญาตการใช้กล้องในเบราว์เซอร์ ตรวจว่าไม่มีแอปหรือแท็บอื่นใช้กล้องอยู่ และเข้าเว็บผ่าน https:// ถ้ายังไม่ได้ ให้พิมพ์เลขบาร์โค้ดแทน",
      "ขึ้น “ไม่พบสินค้าบาร์โค้ด”: สินค้านี้ยังไม่ได้เพิ่มในระบบ หรือเลขบาร์โค้ดที่บันทึกไว้ไม่ตรงกับที่สแกน ให้ Admin ตรวจที่หน้า Inventory",
      "ขึ้น “หมดสต็อก” หรือ “สต็อกไม่พอ”: ไม่มีสินค้าเหลือพอขาย ให้ Admin กด Restock รับสินค้าเข้า",
      "เห็นเมนูไม่ครบ: บัญชี Cashier เห็นเฉพาะหน้า POS ถ้าต้องการสิทธิ์ Admin ให้ติดต่อผู้ดูแลระบบ",
      "กดวิเคราะห์ AI แล้วขึ้นข้อผิดพลาดหรือข้อมูลไม่พอ: ลองใหม่อีกครั้ง ถ้ายังไม่ได้ให้รอให้มียอดขายสะสมเพิ่ม",
    ],
  },
];

export default function ManualPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setRole((profile?.role ?? "cashier").toLowerCase());
      setLoading(false);
    };
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = role === "admin";
  const q = query.trim().toLowerCase();

  const visible = SECTIONS.filter((s) => isAdmin || !s.admin).filter(
    (s) =>
      q === "" ||
      [s.title, s.subtitle, ...s.steps, ...(s.tips ?? [])].join(" ").toLowerCase().includes(q)
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar role={role} />

      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-5 space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
            คู่มือการใช้งาน{" "}
            <span className="text-gray-400 font-normal text-base">(User Manual)</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {isAdmin ? "สำหรับผู้ดูแลระบบ (Admin)" : "สำหรับพนักงานขาย (Cashier)"}
          </p>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาในคู่มือ เช่น สแกน, ลดราคา, รับสินค้า..."
          className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
        />

        {visible.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {visible.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition"
              >
                {s.icon} {s.title}
              </a>
            ))}
          </div>
        )}

        {visible.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-10">ไม่พบหัวข้อที่ค้นหา</p>
        )}

        {visible.map((s) => (
          <section
            key={s.id}
            id={s.id}
            className="scroll-mt-20 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-50 flex items-center justify-center text-xl">
                {s.icon}
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-gray-800">{s.title}</h2>
                <p className="text-xs text-gray-400">
                  {s.subtitle}
                  {s.admin ? " · Admin only" : ""}
                </p>
              </div>
            </div>

            <ol className="space-y-2">
              {s.steps.map((t, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
                  <span
                    className={`shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center mt-0.5 ${
                      s.numbered === false
                        ? "bg-gray-100 text-gray-500"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {s.numbered === false ? "•" : i + 1}
                  </span>
                  <span className="min-w-0 break-words">{t}</span>
                </li>
              ))}
            </ol>

            {s.tips && (
              <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1">
                <p className="text-xs font-bold text-amber-700">💡 ข้อควรรู้ / Tips</p>
                {s.tips.map((t, i) => (
                  <p key={i} className="text-xs text-amber-800 leading-relaxed">
                    • {t}
                  </p>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}