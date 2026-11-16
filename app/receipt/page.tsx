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

/**
 * Deducts `qtyToDeduct` units of a product from its stock_batches,
 * taking from the batch with the SOONEST expiration date first (FEFO —
 * First Expired, First Out). If that batch doesn't have enough, the
 * remainder spills over into the next-soonest batch, and so on.
 * Batches with no expiration_date are treated as "never expires" and
 * are only used last, after every dated batch is exhausted.
 */
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
    // Every batch was exhausted but there still wasn't enough stock —
    // this shouldn't normally happen since POS checks stock before
    // checkout, but could occur from a race condition (two sales at
    // once). We don't block the sale here, but this is worth logging
    // and reviewing rather than silently ignoring.
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
  const [change, setChange] = useState<number | null>(null);
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

  const handleCalculateChange = () => {
    const received = parseFloat(cashReceived);
    if (isNaN(received) || received < total) {
      alert(t("receipt.insufficientAmount"));
      return;
    }
    setChange(received - total);
  };

  const handleConfirmPayment = async () => {
    if (!paymentMethod) {
      alert(t("receipt.selectPaymentFirst"));
      return;
    }
    if (paymentMethod === "cash" && change === null) {
      alert(t("receipt.calculateChangeFirst"));
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
        alert(t("receipt.saveOrderError", { message: orderError?.message ?? "" }));
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
        alert(t("receipt.saveItemsError", { message: itemsError.message }));
        setPaymentStatus("pending");
        return;
      }

      // 3. ตัดสต็อกแบบ FEFO (First Expired, First Out) — หักจากล็อตที่หมดอายุ
      // เร็วที่สุดก่อน แทนที่จะลด stock_qty ตรงๆ บน products (ไม่มีคอลัมน์นี้แล้ว)
      for (const item of cart) {
        await deductStockFEFO(item.id, item.qty);
      }

      // 4. สำเร็จ
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

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-blue-600">Smart POS</h1>
          <p className="text-gray-500 text-sm">{t("receipt.subtitle")}</p>
          <div className="mt-3 text-xs text-gray-400 space-y-1">
            <p>{t("receipt.dateTime", { date: dateStr, time: timeStr })}</p>
            {orderId && (
              <p className="text-gray-300">#{orderId.slice(0, 8).toUpperCase()}</p>
            )}
          </div>

          {/* Payment Status Badge */}
          <div className="mt-3">
            {paymentStatus === "paid" ? (
              <span className="bg-green-100 text-green-700 text-sm font-bold px-4 py-1.5 rounded-full">
                {t("receipt.statusPaid", { method: paymentLabels[paymentMethod!] })}
              </span>
            ) : paymentStatus === "saving" ? (
              <span className="bg-blue-100 text-blue-700 text-sm font-bold px-4 py-1.5 rounded-full">
                {t("receipt.statusSaving")}
              </span>
            ) : (
              <span className="bg-yellow-100 text-yellow-700 text-sm font-bold px-4 py-1.5 rounded-full">
                {t("receipt.statusPending")}
              </span>
            )}
          </div>
        </div>

        {/* รายการสินค้า */}
        <div className="border-t border-dashed border-gray-300 pt-4 mb-4">
          {cart.length === 0 ? (
            <p className="text-center text-gray-400 text-sm">{t("receipt.noItems")}</p>
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
            <span>{t("receipt.total")}</span>
            <span className="text-blue-600">฿{total.toFixed(2)}</span>
          </div>
        </div>

        {/* ส่วนชำระเงิน */}
        {paymentStatus === "pending" && (
          <div className="mt-4 space-y-4">

            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">
                {t("receipt.selectPaymentMethod")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "cash", label: t("receipt.methodCash") },
                  { key: "transfer", label: t("receipt.methodTransfer") },
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
                  {t("receipt.cashReceivedLabel")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder={t("receipt.enterAmountPlaceholder")}
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
                    {t("receipt.calculate")}
                  </button>
                </div>
                {change !== null && (
                  <div className="flex justify-between font-medium text-green-600 bg-green-50 px-4 py-2 rounded-lg">
                    <span>{t("receipt.change")}</span>
                    <span>฿{change.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === "transfer" && (
              <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 space-y-3">
                <p className="font-bold">{t("receipt.paymentDetailsTitle")}</p>
                <div className="space-y-1">
                  <p className="font-medium text-blue-800">{t("receipt.bankTransferHeader")}</p>
                  <p>{t("receipt.bankName")}</p>
                  <p>{t("receipt.accountNo")}</p>
                  <p>{t("receipt.accountName")}</p>
                </div>
                <p className="font-bold text-blue-800 text-center">
                  {t("receipt.amountDue", { amount: total.toFixed(2) })}
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
              {t("receipt.confirmPayment")}
            </button>

            <button
              onClick={handleCancelOrder}
              className="w-full border border-gray-300 text-gray-500 font-medium py-2.5 rounded-xl hover:bg-gray-50 transition text-sm"
            >
              {t("receipt.cancelOrder")}
            </button>
          </div>
        )}

        {/* กำลังบันทึก */}
        {paymentStatus === "saving" && (
          <div className="mt-6 text-center text-blue-500 font-medium text-sm py-4">
            {t("receipt.savingData")}
          </div>
        )}

        {/* หลังจ่ายเงินแล้ว */}
        {paymentStatus === "paid" && (
          <div className="mt-4 space-y-3">
            <div className="bg-green-50 rounded-xl p-4 text-sm space-y-1">
              <div className="flex justify-between text-green-700">
                <span>{t("receipt.paymentMethodSummary")}</span>
                <span className="font-bold">{paymentLabels[paymentMethod!]}</span>
              </div>
              {paymentMethod === "cash" && change !== null && (
                <>
                  <div className="flex justify-between text-green-700">
                    <span>{t("receipt.receivedSummary")}</span>
                    <span className="font-bold">
                      ฿{parseFloat(cashReceived).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-green-700">
                    <span>{t("receipt.change")}</span>
                    <span className="font-bold">฿{change.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleSellMore}
              className="w-full border border-gray-300 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition"
            >
              {t("receipt.sellMore")}
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-4">
          {t("receipt.thankYou")}
        </p>
      </div>
    </div>
  );
}