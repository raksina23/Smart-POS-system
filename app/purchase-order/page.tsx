"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import { useI18n } from "../lib/i18n";

interface PurchaseItem {
  id: string;
  name: string;
  stock_qty: number;
  min_stock: number;
}

// วันที่ตามเวลาท้องถิ่น (ไม่ใช่ UTC) สำหรับใช้ในชื่อไฟล์
const toLocalDateString = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function DownloadIcon({ className = "w-4 h-4 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 4v11m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PurchaseOrderPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const billRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [saving, setSaving] = useState(false);
  // ใช้แสดงรูปให้กดค้างบันทึกเอง (เบราว์เซอร์ใน LINE / Facebook)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("purchaseOrderItems");
    if (saved) setItems(JSON.parse(saved));
    setNow(new Date());
  }, []);

  const dateStr = now
    ? now.toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";
  const timeStr = now
    ? now.toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const totalUnitsNeeded = items.reduce(
    (sum, item) => sum + Math.max(item.min_stock - item.stock_qty, 0),
    0
  );

  const handleSaveImage = async () => {
    if (!billRef.current) return;
    setSaving(true);

    try {
      // ถ่ายรูป 2 รอบ: รอบแรกอุ่นเครื่อง (Safari มักให้รูปว่างในรอบแรก)
      await toPng(billRef.current, { cacheBust: true });
      const dataUrl = await toPng(billRef.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });

      const fileName = `purchase-order-${toLocalDateString(now ?? new Date())}.png`;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: "image/png" });

      // วิธี 1: เมนูแชร์ (มือถือส่วนใหญ่) → เลือก "บันทึกรูปภาพ" ได้
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: t("purchaseOrder.shareTitle"),
          });
          return;
        } catch (err) {
          if ((err as Error)?.name === "AbortError") return; // ผู้ใช้กดยกเลิก
          // แชร์ไม่สำเร็จ → ไปวิธีถัดไป
        }
      }

      // วิธี 2: ดาวน์โหลดตรงๆ (เดสก์ท็อป / Android)
      const isInAppBrowser = /Line|FBAN|FBAV|Instagram/i.test(
        navigator.userAgent
      );
      if (!isInAppBrowser) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = fileName;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }

      // วิธี 3: แสดงรูปให้กดค้างแล้วบันทึกเอง (LINE / Facebook in-app)
      setPreviewUrl(dataUrl);
    } catch (err) {
      console.error(err);
      alert(t("purchaseOrder.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 font-sans text-gray-800">
      <div className="max-w-lg mx-auto space-y-4">

        {/* ปุ่มด้านบน */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-gray-500 hover:text-gray-800 flex items-center gap-1 text-sm font-medium transition"
          >
            {t("purchaseOrder.back")}
          </button>
          <button
            type="button"
            onClick={handleSaveImage}
            disabled={saving || items.length === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <DownloadIcon />
            <span>
              {saving ? t("purchaseOrder.saving") : t("purchaseOrder.saveAsImage")}
            </span>
          </button>
        </div>

        {/* ใบสั่งซื้อ — ส่วนนี้จะถูก capture เป็นรูป */}
        <div
          ref={billRef}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          {/* Header */}
          <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4">
            <h1 className="text-2xl font-bold text-orange-600 tracking-tight">
              Smart POS
            </h1>
            <p className="text-gray-600 text-sm font-medium mt-1">
              {t("purchaseOrder.title")}
            </p>
            <div className="mt-2 text-xs text-gray-400 space-y-0.5 tabular-nums">
              <p>{t("purchaseOrder.date", { date: dateStr })}</p>
              <p>{t("purchaseOrder.time", { time: timeStr })}</p>
            </div>
          </div>

          {/* หัวตาราง */}
          <div className="grid grid-cols-12 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-3">
            <span className="col-span-1">#</span>
            <span className="col-span-5">{t("purchaseOrder.colProduct")}</span>
            <span className="col-span-2 text-center">{t("purchaseOrder.colStock")}</span>
            <span className="col-span-2 text-center">{t("purchaseOrder.colMin")}</span>
            <span className="col-span-2 text-center">{t("purchaseOrder.colNeed")}</span>
          </div>

          {/* รายการสินค้า */}
          <div className="space-y-2">
            {items.map((item, index) => {
              const needToBuy = Math.max(item.min_stock - item.stock_qty, 0);
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-12 items-center bg-orange-50/80 rounded-xl px-3 py-2.5 text-sm border border-orange-100"
                >
                  <span className="col-span-1 text-gray-400 text-xs tabular-nums">
                    {index + 1}
                  </span>
                  <span className="col-span-5 font-medium text-gray-800 pr-1 leading-snug break-words">
                    {item.name}
                  </span>
                  <span className="col-span-2 text-center text-red-500 font-bold tabular-nums">
                    {item.stock_qty}
                  </span>
                  <span className="col-span-2 text-center text-gray-500 tabular-nums">
                    {item.min_stock}
                  </span>
                  <span className="col-span-2 text-center text-orange-600 font-bold tabular-nums">
                    {needToBuy}
                  </span>
                </div>
              );
            })}
          </div>

          {/* สรุป */}
          <div className="border-t border-dashed border-gray-300 mt-4 pt-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t("purchaseOrder.totalItems")}</span>
              <span className="font-bold text-gray-800 tabular-nums">
                {t("alerts.itemCount", { n: items.length })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                {t("purchaseOrder.totalUnitsNeeded")}
              </span>
              <span className="font-bold text-orange-600 tabular-nums">
                {t("purchaseOrder.unitCount", { n: totalUnitsNeeded })}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 pt-4 border-t border-dashed border-gray-200">
            <p className="text-xs text-gray-400">
              {t("purchaseOrder.generatedBy")}
            </p>
            <p className="text-[11px] text-gray-300 mt-0.5 font-mono tabular-nums">
              {now ? now.toISOString() : ""}
            </p>
          </div>
        </div>

        {/* ปุ่มด้านล่าง */}
        <div className="flex gap-3 pb-6">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex-1 bg-white border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition text-sm"
          >
            {t("purchaseOrder.backToDashboard")}
          </button>
          <button
            type="button"
            onClick={handleSaveImage}
            disabled={saving || items.length === 0}
            className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm inline-flex items-center justify-center gap-2"
          >
            <DownloadIcon />
            <span>
              {saving ? t("purchaseOrder.saving") : t("purchaseOrder.saveImage")}
            </span>
          </button>
        </div>
      </div>

      {/* Modal แสดงรูปให้กดค้างบันทึก (LINE / Facebook in-app browser) */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <p className="text-sm text-center font-medium text-gray-700 mb-2.5">
              {t("purchaseOrder.holdToSaveHint")}
            </p>
            <img
              src={previewUrl}
              alt={t("purchaseOrder.imageAlt")}
              className="w-full rounded-xl border border-gray-200"
            />
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="mt-3 w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition"
            >
              {t("purchaseOrder.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}