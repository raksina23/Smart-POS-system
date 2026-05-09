"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

interface CartItem {
  id: string;
  name: string;
  price: number;
  cost: number;
  qty: number;
  barcode: string;
  stock_qty: number;
}

type PaymentMethod = "cash" | "transfer" | null;
type PaymentStatus = "pending" | "saving" | "paid";

export default function ReceiptPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [cashReceived, setCashReceived] = useState("");
  const [change, setChange] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("pending");
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const savedCart = localStorage.getItem("cart");
    const savedTotal = localStorage.getItem("totalPrice");
    if (savedCart) setCart(JSON.parse(savedCart));
    if (savedTotal) setTotal(parseFloat(savedTotal));
  }, []);

  const handleCalculateChange = () => {
    const received = parseFloat(cashReceived);
    if (isNaN(received) || received < total) {
      alert("จำนวนเงินที่รับไม่เพียงพอ");
      return;
    }
    setChange(received - total);
  };

  const handleConfirmPayment = async () => {
    if (!paymentMethod) {
      alert("กรุณาเลือกวิธีการชำระเงินก่อน");
      return;
    }
    if (paymentMethod === "cash" && change === null) {
      alert("กรุณากรอกจำนวนเงินที่รับและคำนวณเงินทอนก่อน");
      return;
    }

    setPaymentStatus("saving");

    try {
      // 1. บันทึก orders
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          total_amount: total,
          cash_received: paymentMethod === "cash" ? parseFloat(cashReceived) : total,
          change: paymentMethod === "cash" ? (change ?? 0) : 0,
          payment_type: paymentMethod,
        })
        .select()
        .single();

      if (orderError || !order) {
        alert("เกิดข้อผิดพลาดในการบันทึกออเดอร์: " + orderError?.message);
        setPaymentStatus("pending");
        return;
      }

      // 2. บันทึก order_items
      const orderItems = cart.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.qty,
        price_sold: item.price,
        cost_sold: item.cost ?? 0,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        alert("เกิดข้อผิดพลาดในการบันทึกรายการสินค้า: " + itemsError.message);
        setPaymentStatus("pending");
        return;
      }

      // 3. ลด stock_qty ทีละรายการ
      for (const item of cart) {
        await supabase
          .from("products")
          .update({ stock_qty: item.stock_qty - item.qty })
          .eq("id", item.id);
      }

      // 4. สำเร็จ
      setOrderId(order.id);
      setPaymentStatus("paid");
      localStorage.removeItem("cart");
      localStorage.removeItem("totalPrice");

    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดที่ไม่คาดคิด");
      setPaymentStatus("pending");
    }
  };

  const handleSellMore = () => {
    router.push("/pos");
  };

  const handleCancelOrder = () => {
    if (confirm("ต้องการยกเลิกการสั่งซื้อหรือไม่?")) {
      localStorage.removeItem("cart");
      localStorage.removeItem("totalPrice");
      router.push("/pos");
    }
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH");
  const timeStr = now.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const paymentLabels: Record<string, string> = {
    cash: "เงินสด",
    transfer: "โอนเงิน/QR Code",
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-sm w-full p-6">

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-blue-600">Smart POS</h1>
          <p className="text-gray-500 text-sm">ระบบจัดการหน้าร้านอัจฉริยะ</p>
          <div className="mt-3 text-xs text-gray-400 space-y-1">
            <p>วันที่: {dateStr} เวลา: {timeStr}</p>
            {orderId && (
              <p className="text-gray-300">#{orderId.slice(0, 8).toUpperCase()}</p>
            )}
          </div>

          {/* Payment Status Badge */}
          <div className="mt-3">
            {paymentStatus === "paid" ? (
              <span className="bg-green-100 text-green-700 text-sm font-bold px-4 py-1.5 rounded-full">
                ✓ ชำระเงินแล้ว — {paymentLabels[paymentMethod!]}
              </span>
            ) : paymentStatus === "saving" ? (
              <span className="bg-blue-100 text-blue-700 text-sm font-bold px-4 py-1.5 rounded-full">
                ⏳ กำลังบันทึก...
              </span>
            ) : (
              <span className="bg-yellow-100 text-yellow-700 text-sm font-bold px-4 py-1.5 rounded-full">
                ⏳ รอชำระเงิน
              </span>
            )}
          </div>
        </div>

        {/* รายการสินค้า */}
        <div className="border-t border-dashed border-gray-300 pt-4 mb-4">
          {cart.length === 0 ? (
            <p className="text-center text-gray-400 text-sm">ไม่มีรายการสินค้า</p>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <div>
                    <p className="text-gray-800">{item.name}</p>
                    <p className="text-gray-400">
                      ฿{item.price.toFixed(2)} x {item.qty}
                    </p>
                  </div>
                  <p className="font-medium text-gray-800">
                    ฿{(item.price * item.qty).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ยอดรวม */}
        <div className="border-t border-dashed border-gray-300 pt-4">
          <div className="flex justify-between font-bold text-lg">
            <span>ยอดรวม</span>
            <span className="text-blue-600">฿{total.toFixed(2)}</span>
          </div>
        </div>

        {/* ส่วนชำระเงิน */}
        {paymentStatus === "pending" && (
          <div className="mt-4 space-y-4">

            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">
                เลือกวิธีชำระเงิน
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "cash", label: "💵 เงินสด" },
                  { key: "transfer", label: "🏦 โอนเงิน/QR" },
                ].map((method) => (
                  <button
                    key={method.key}
                    onClick={() => {
                      setPaymentMethod(method.key as PaymentMethod);
                      setCashReceived("");
                      setChange(null);
                    }}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition ${
                      paymentMethod === method.key
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === "cash" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 block">
                  รับเงิน (บาท)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="กรอกจำนวนเงิน"
                    value={cashReceived}
                    onChange={(e) => {
                      setCashReceived(e.target.value);
                      setChange(null);
                    }}
                  />
                  <button
                    onClick={handleCalculateChange}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                  >
                    คำนวณ
                  </button>
                </div>
                {change !== null && (
                  <div className="flex justify-between font-medium text-green-600 bg-green-50 px-4 py-2 rounded-lg">
                    <span>เงินทอน</span>
                    <span>฿{change.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === "transfer" && (
              <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 space-y-3">
                <p className="font-bold">ช่องทางชำระเงิน</p>
                <div className="space-y-1">
                  <p className="font-medium text-blue-800">🏦 โอนเงิน</p>
                  <p>ธนาคาร: กสิกรไทย</p>
                  <p>เลขบัญชี: 123-4-56789-0</p>
                  <p>ชื่อบัญชี: ร้านอัจฉริยะ</p>
                </div>
                {/* <div className="border-t border-blue-200 pt-3 space-y-1">
                  <p className="font-medium text-blue-800">📱 QR Code</p>
                  <div className="flex justify-center">
                    <div className="w-28 h-28 bg-white border-2 border-blue-200 rounded-xl flex items-center justify-center">
                      <p className="text-xs text-gray-400 text-center">QR Code<br />(จำลอง)</p>
                    </div>
                  </div>
                </div> */}
                <p className="font-bold text-blue-800 text-center">
                  ยอดที่ต้องชำระ: ฿{total.toFixed(2)}
                </p>
              </div>
            )}

            <button
              onClick={handleConfirmPayment}
              disabled={!paymentMethod}
              className={`w-full font-bold py-3 rounded-xl text-lg transition ${
                paymentMethod
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              ยืนยันการชำระเงิน
            </button>

            <button
              onClick={handleCancelOrder}
              className="w-full border border-gray-300 text-gray-500 font-medium py-2.5 rounded-xl hover:bg-gray-50 transition text-sm"
            >
              ยกเลิกออเดอร์
            </button>
          </div>
        )}

        {/* กำลังบันทึก */}
        {paymentStatus === "saving" && (
          <div className="mt-6 text-center text-blue-500 font-medium text-sm py-4">
            ⏳ กำลังบันทึกข้อมูล...
          </div>
        )}

        {/* หลังจ่ายเงินแล้ว */}
        {paymentStatus === "paid" && (
          <div className="mt-4 space-y-3">
            <div className="bg-green-50 rounded-xl p-4 text-sm space-y-1">
              <div className="flex justify-between text-green-700">
                <span>วิธีชำระ</span>
                <span className="font-bold">{paymentLabels[paymentMethod!]}</span>
              </div>
              {paymentMethod === "cash" && change !== null && (
                <>
                  <div className="flex justify-between text-green-700">
                    <span>รับเงิน</span>
                    <span className="font-bold">
                      ฿{parseFloat(cashReceived).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-green-700">
                    <span>เงินทอน</span>
                    <span className="font-bold">฿{change.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">
              พิมพ์ใบเสร็จ
            </button>
            <button
              onClick={handleSellMore}
              className="w-full border border-gray-300 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition"
            >
              ขายต่อ
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-4">
          ขอบคุณที่ใช้บริการ
        </p>
      </div>
    </div>
  );
}