"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useI18n } from "../lib/i18n";

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

async function deductStockFEFO(productId: string, qtyToDeduct: number) {
  const { data: batches, error } = await supabase
    .from("stock_batches")
    .select("id, quantity, expiration_date")
    .eq("product_id", productId)
    .gt("quantity", 0)
    .order("expiration_date", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`ไม่สามารถอ่านข้อมูลล็อตสินค้าได้: ${error.message}`);
  }

  let remaining = qtyToDeduct;

  for (const batch of batches ?? []) {
    if (remaining <= 0) break;

    const deductFromThisBatch = Math.min(batch.quantity, remaining);
    const newQuantity = batch.quantity - deductFromThisBatch;

    const { error: updateError } = await supabase
      .from("stock_batches")
      .update({ quantity: newQuantity })
      .eq("id", batch.id);

    if (updateError) {
      throw new Error(`ไม่สามารถตัดสต็อกได้: ${updateError.message}`);
    }

    remaining -= deductFromThisBatch;
  }

  if (remaining > 0) {
    console.warn(
      `สต็อกไม่พอสำหรับสินค้า ${productId}: ขาดอีก ${remaining} ชิ้น`
    );
  }
}

export default function ReceiptPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [cashReceived, setCashReceived] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("pending");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const savedCart = localStorage.getItem("cart");
    const savedTotal = localStorage.getItem("totalPrice");
    if (savedCart) setCart(JSON.parse(savedCart));
    if (savedTotal) setTotal(parseFloat(savedTotal));
    setNow(new Date());
  }, []);

  // คำนวณเงินทอนทันทีที่พิมพ์ ไม่ต้องกดปุ่มคำนวณเพิ่ม และการ์ดไม่กระตุกขึ้นลง
  const parsedReceived = parseFloat(cashReceived);
  const hasCashInput = cashReceived.trim() !== "" && !isNaN(parsedReceived);
  const isCashEnough = hasCashInput && parsedReceived >= total;
  const change = isCashEnough ? parsedReceived - total : null;

  const canConfirm =
    paymentMethod === "transfer" ||
    (paymentMethod === "cash" && isCashEnough);

  const handleConfirmPayment = async () => {
    if (!paymentMethod) {
      alert(t("receipt.selectPaymentFirst"));
      return;
    }
    if (paymentMethod === "cash" && !isCashEnough) {
      alert(t("receipt.insufficientAmount"));
      return;
    }

    setPaymentStatus("saving");

    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          total_amount: total,
          cash_received: paymentMethod === "cash" ? parsedReceived : total,
          change: paymentMethod === "cash" ? (change ?? 0) : 0,
          payment_type: paymentMethod,
        })
        .select()
        .single();

      if (orderError || !order) {
        alert(t("receipt.saveOrderError", { message: orderError?.message ?? "" }));
        setPaymentStatus("pending");
        return;
      }

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
        alert(t("receipt.saveItemsError", { message: itemsError.message }));
        setPaymentStatus("pending");
        return;
      }

      for (const item of cart) {
        await deductStockFEFO(item.id, item.qty);
      }

      setOrderId(order.id);
      setPaymentStatus("paid");
      localStorage.removeItem("cart");
      localStorage.removeItem("totalPrice");
    } catch (err) {
      console.error(err);
      alert(t("receipt.unexpectedError"));
      setPaymentStatus("pending");
    }
  };

  const handleSellMore = () => {
    router.push("/pos");
  };

  const handleCancelOrder = () => {
    if (confirm(t("receipt.confirmCancelOrder"))) {
      localStorage.removeItem("cart");
      localStorage.removeItem("totalPrice");
      router.push("/pos");
    }
  };

  const dateStr = now ? now.toLocaleDateString(locale) : "";
  const timeStr = now
    ? now.toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const paymentLabels: Record<string, string> = {
    cash: t("receipt.paymentCash"),
    transfer: t("receipt.paymentTransfer"),
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-sm w-full p-6">

        {/* Header: ลดขนาดชื่อร้านให้พอดี เพื่อไม่ให้แย่งสายตาจากยอดรวม */}
        <div className="text-center mb-5">
          <h1 className="text-lg font-bold text-gray-800">Smart POS</h1>
          <p className="text-gray-400 text-xs mt-0.5">{t("receipt.subtitle")}</p>
          <div className="mt-2 text-xs text-gray-400 tabular-nums space-y-0.5">
            <p>{t("receipt.dateTime", { date: dateStr, time: timeStr })}</p>
            {orderId && (
              <p className="font-mono text-gray-400">
                #{orderId.slice(0, 8).toUpperCase()}
              </p>
            )}
          </div>

          {/* แสดงป้ายสถานะเฉพาะตอนจ่ายเงินสำเร็จแล้ว ลดป้ายเหลืองที่เกินจำเป็น */}
          {paymentStatus === "paid" && (
            <div className="mt-3">
              <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-3.5 py-1.5 rounded-full">
                {t("receipt.statusPaid", { method: paymentLabels[paymentMethod!] })}
              </span>
            </div>
          )}
        </div>

        {/* รายการสินค้า */}
        <div className="border-t border-dashed border-gray-200 py-4">
          {cart.length === 0 ? (
            <p className="text-center text-gray-400 text-sm">{t("receipt.noItems")}</p>
          ) : (
            <div className="space-y-2.5 max-h-56 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between items-baseline gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-800 truncate">{item.name}</p>
                    <p className="text-gray-400 text-xs tabular-nums">
                      ฿{item.price.toFixed(2)} x {item.qty}
                    </p>
                  </div>
                  <p className="font-medium text-gray-800 tabular-nums shrink-0">
                    ฿{(item.price * item.qty).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ยอดรวม: ทำให้เป็นจุดเด่นที่สุดบนใบเสร็จ */}
        <div className="border-t border-dashed border-gray-200 pt-4">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-medium text-gray-600">{t("receipt.total")}</span>
            <span className="text-2xl font-bold text-blue-600 tabular-nums">
              ฿{total.toFixed(2)}
            </span>
          </div>
        </div>

        {/* ส่วนชำระเงิน */}
        {paymentStatus !== "paid" && (
          <div className="mt-5 space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">
                {t("receipt.selectPaymentMethod")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "cash", label: t("receipt.methodCash") },
                  { key: "transfer", label: t("receipt.methodTransfer") },
                ].map((method) => (
                  <button
                    key={method.key}
                    type="button"
                    disabled={paymentStatus === "saving"}
                    onClick={() => {
                      setPaymentMethod(method.key as PaymentMethod);
                      setCashReceived("");
                    }}
                    className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition ${
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
              <div className="space-y-2.5">
                <label className="text-xs font-medium text-gray-500 block">
                  {t("receipt.cashReceivedLabel")}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  disabled={paymentStatus === "saving"}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-right font-semibold text-base tabular-nums focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder={t("receipt.enterAmountPlaceholder")}
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                />

                {/* แสดงสถานะเงินทอนตลอดเวลาในความสูงคงที่ การ์ดไม่กระตุก */}
                <div
                  className={`flex justify-between items-center text-sm px-4 py-2.5 rounded-xl tabular-nums ${
                    isCashEnough
                      ? "bg-green-50 text-green-700 font-semibold"
                      : hasCashInput
                      ? "bg-red-50 text-red-600 font-medium"
                      : "bg-gray-50 text-gray-400"
                  }`}
                >
                  <span>
                    {hasCashInput && !isCashEnough
                      ? t("receipt.insufficientAmount")
                      : t("receipt.change")}
                  </span>
                  <span className="font-bold">
                    ฿{(change ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {paymentMethod === "transfer" && (
              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 space-y-2">
                <p className="font-semibold text-xs text-blue-600">
                  {t("receipt.paymentDetailsTitle")}
                </p>
                <div className="space-y-0.5 text-xs text-blue-900">
                  <p>{t("receipt.bankName")}</p>
                  <p className="font-mono font-semibold text-sm">123-4-56789-0</p>
                  <p>{t("receipt.accountName")}</p>
                </div>
                <p className="font-bold text-blue-700 pt-1 border-t border-blue-100 tabular-nums">
                  {t("receipt.amountDue", { amount: total.toFixed(2) })}
                </p>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={!canConfirm || paymentStatus === "saving"}
                className={`w-full font-bold py-3 rounded-xl text-base transition ${
                  canConfirm && paymentStatus !== "saving"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                {paymentStatus === "saving"
                  ? t("receipt.statusSaving")
                  : t("receipt.confirmPayment")}
              </button>

              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={paymentStatus === "saving"}
                className="w-full text-gray-400 hover:text-gray-600 font-medium py-2 rounded-xl transition text-xs"
              >
                {t("receipt.cancelOrder")}
              </button>
            </div>
          </div>
        )}

        {/* หลังจ่ายเงินแล้ว */}
        {paymentStatus === "paid" && (
          <div className="mt-4 space-y-3">
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5 tabular-nums">
              <div className="flex justify-between text-gray-600">
                <span>{t("receipt.paymentMethodSummary")}</span>
                <span className="font-semibold text-gray-800">
                  {paymentLabels[paymentMethod!]}
                </span>
              </div>
              {paymentMethod === "cash" && change !== null && (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>{t("receipt.receivedSummary")}</span>
                    <span className="font-semibold text-gray-800">
                      ฿{parsedReceived.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-green-700 pt-1 border-t border-gray-200/70">
                    <span className="font-medium">{t("receipt.change")}</span>
                    <span className="font-bold">฿{change.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleSellMore}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition"
            >
              {t("receipt.sellMore")}
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-5">
          {t("receipt.thankYou")}
        </p>
      </div>
    </div>
  );
}