"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabase";

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  price_sold: number;
  cost_sold: number;
}

interface Order {
  id: string;
  total_amount: number;
  cash_received: number;
  change: number;
  payment_type: string;
  created_at: string;
  order_items: OrderItem[];
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          total_amount,
          cash_received,
          change,
          payment_type,
          created_at,
          order_items (
            id,
            product_name,
            quantity,
            price_sold,
            cost_sold
          )
        `)
        .eq("id", id)
        .single();

      if (error || !data) {
        console.error("Error fetching order:", error?.message);
        alert("ไม่พบข้อมูล order");
        router.push("/history");
        return;
      }

      setOrder(data);
      setLoading(false);
    };

    fetchOrder();
  }, [id]);

  const paymentLabel: Record<string, string> = {
    cash: "เงินสด",
    transfer: "โอนเงิน / QR Code",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar role="Admin" />
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const dateStr = new Date(order.created_at).toLocaleDateString("th-TH");
  const timeStr = new Date(order.created_at).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // คำนวณกำไรรวมของบิลนี้
  const totalProfit = order.order_items.reduce(
    (sum, item) => sum + (item.price_sold - item.cost_sold) * item.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar role="Admin" />
      <div className="max-w-2xl mx-auto p-4 md:p-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/history")}
            className="text-gray-400 hover:text-gray-600 transition text-xl"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-800">รายละเอียดบิล</h1>
        </div>

        {/* Order Info */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4 space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-base font-bold text-gray-800">
              #{order.id.slice(0, 8).toUpperCase()}
            </p>
            <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
              ✓ ชำระแล้ว
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-400">วันที่</p>
              <p className="font-medium text-gray-700">{dateStr}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">เวลา</p>
              <p className="font-medium text-gray-700">{timeStr}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">วิธีชำระ</p>
              <p className="font-medium text-gray-700">
                {paymentLabel[order.payment_type] ?? order.payment_type}
              </p>
            </div>
            {order.payment_type === "cash" && (
              <div>
                <p className="text-xs text-gray-400">เงินทอน</p>
                <p className="font-medium text-gray-700">
                  ฿{order.change.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* รายการสินค้า */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <h2 className="text-sm font-bold text-gray-600 mb-3">
            รายการสินค้า ({order.order_items.length} รายการ)
          </h2>
          <div className="space-y-3">
            {order.order_items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center text-sm py-2 border-b border-gray-50 last:border-0"
              >
                <div>
                  <p className="font-medium text-gray-800">{item.product_name}</p>
                  <p className="text-gray-400 text-xs">
                    ฿{item.price_sold.toFixed(2)} x {item.quantity}
                  </p>
                </div>
                <p className="font-bold text-gray-800">
                  ฿{(item.price_sold * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ยอดรวม + กำไร */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-base font-medium text-gray-600">ยอดขายรวม</span>
            <span className="text-xl font-bold text-blue-600">
              ฿{order.total_amount.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-base font-medium text-gray-600">กำไรบิลนี้</span>
            <span className="text-xl font-bold text-emerald-500">
              ฿{totalProfit.toFixed(2)}
            </span>
          </div>
        </div>

        {/* ปุ่ม */}
        <div className="space-y-3">
          <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">
            🖨️ พิมพ์ใบเสร็จ
          </button>
          <button
            onClick={() => router.push("/history")}
            className="w-full border border-gray-300 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition"
          >
            ← กลับ
          </button>
        </div>

      </div>
    </div>
  );
}