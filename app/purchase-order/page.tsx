"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface PurchaseItem {
  id: string;
  name: string;
  stock_qty: number;
  min_stock: number;
}

export default function PurchaseOrderPage() {
  const router = useRouter();
  const billRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("purchaseOrderItems");
    if (saved) setItems(JSON.parse(saved));
  }, []);

  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH", {
    year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  const handleSaveImage = async () => {
    if (!billRef.current) return;
    setSaving(true);

    try {
      // โหลด html2canvas จาก CDN
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      document.head.appendChild(script);

      script.onload = async () => {
        const html2canvas = (window as any).html2canvas;
        const canvas = await html2canvas(billRef.current, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
        });

        // บันทึกเป็นรูป
        const link = document.createElement("a");
        link.download = `purchase-order-${now.toISOString().split("T")[0]}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        setSaving(false);
      };
    } catch {
      alert("เกิดข้อผิดพลาดในการบันทึกรูป / Error saving image");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6 font-sans">
      <div className="max-w-lg mx-auto space-y-4">

        {/* ปุ่มด้านบน */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium"
          >
            ← กลับ / Back
          </button>
          <button
            onClick={handleSaveImage}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? "กำลังบันทึก..." : "📥 บันทึกเป็นรูป / Save as Image"}
          </button>
        </div>

        {/* ใบสั่งซื้อ — ส่วนนี้จะถูก capture เป็นรูป */}
        <div ref={billRef} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

          {/* Header */}
          <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4">
            <h1 className="text-2xl font-bold text-orange-600">Smart POS</h1>
            <p className="text-gray-500 text-sm mt-1">
              ใบสั่งซื้อสินค้า / Purchase Order
            </p>
            <div className="mt-2 text-xs text-gray-400 space-y-0.5">
              <p>วันที่ / Date: {dateStr}</p>
              <p>เวลา / Time: {timeStr} น.</p>
            </div>
          </div>

          {/* หัวตาราง */}
          <div className="grid grid-cols-12 text-xs font-bold text-gray-400 uppercase mb-2 px-1">
            <span className="col-span-1">#</span>
            <span className="col-span-5">ชื่อสินค้า / Product</span>
            <span className="col-span-2 text-center">คงเหลือ / Stock</span>
            <span className="col-span-2 text-center">ขั้นต่ำ / Min</span>
            <span className="col-span-2 text-center">ต้องซื้อ / Need</span>
          </div>

          {/* รายการสินค้า */}
          <div className="space-y-2">
            {items.map((item, index) => {
              const needToBuy = Math.max(item.min_stock - item.stock_qty, 0);
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-12 items-center bg-orange-50 rounded-lg px-3 py-2.5 text-sm border border-orange-100"
                >
                  <span className="col-span-1 text-gray-400 text-xs">{index + 1}</span>
                  <span className="col-span-5 font-medium text-gray-800">{item.name}</span>
                  <span className="col-span-2 text-center text-red-500 font-bold">{item.stock_qty}</span>
                  <span className="col-span-2 text-center text-gray-500">{item.min_stock}</span>
                  <span className="col-span-2 text-center text-orange-600 font-bold">{needToBuy}</span>
                </div>
              );
            })}
          </div>

          {/* สรุป */}
          <div className="border-t border-dashed border-gray-300 mt-4 pt-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">จำนวนรายการ / Total Items</span>
              <span className="font-bold text-gray-800">{items.length} รายการ</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">จำนวนชิ้นที่ต้องสั่ง / Total Units Needed</span>
              <span className="font-bold text-orange-600">
                {items.reduce((sum, item) => sum + Math.max(item.min_stock - item.stock_qty, 0), 0)} ชิ้น
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 pt-4 border-t border-dashed border-gray-200">
            <p className="text-xs text-gray-400">
              สร้างโดย / Generated by Smart POS
            </p>
            <p className="text-xs text-gray-300 mt-0.5">
              {now.toISOString()}
            </p>
          </div>
        </div>

        {/* ปุ่มด้านล่าง */}
        <div className="flex gap-3 pb-6">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex-1 border border-gray-300 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition text-sm"
          >
            ← กลับหน้าหลัก / Back to Dashboard
          </button>
          <button
            onClick={handleSaveImage}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 text-sm"
          >
            {saving ? "กำลังบันทึก..." : "📥 บันทึกเป็นรูป / Save Image"}
          </button>
        </div>

      </div>
    </div>
  );
}