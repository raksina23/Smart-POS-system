"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useI18n } from "../lib/i18n";
import { bkkDate } from "../lib/dates";

interface CartItem {
  id: string;
  name: string;
  price: number;
  regularPrice?: number;
  lineTotal?: number;
  cost?: number;
  qty: number;
  barcode: string;
  stock_qty: number;
  hasDiscount?: boolean;
}

interface DeductedSlice {
  quantity: number;
  price_sold: number;
}

type PaymentMethod = "cash" | "transfer" | null;
type PaymentStatus = "pending" | "saving" | "paid";

// Deducts stock in FEFO order from non-expired batches only, and returns the
// exact unit prices sold per batch slice so order_items matches POS pricing.
async function deductStockFEFO(
  productId: string,
  qtyToDeduct: number,
  regularPrice: number
): Promise<DeductedSlice[]> {
  const todayBkk = bkkDate(0);

  const { data: batches, error } = await supabase
    .from("stock_batches")
    .select("id, quantity, expiration_date, special_price")
    .eq("product_id", productId)
    .gt("quantity", 0)
    .or(`expiration_date.is.null,expiration_date.gte.${todayBkk}`)
    .order("expiration_date", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`ไม่สามารถอ่านข้อมูลล็อตสินค้าได้: ${error.message}`);
  }

  let remaining = qtyToDeduct;
  const slicesByPrice = new Map<number, number>();

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

    const unitPrice = batch.special_price ?? regularPrice;
    slicesByPrice.set(
      unitPrice,
      (slicesByPrice.get(unitPrice) ?? 0) + deductFromThisBatch
    );

    remaining -= deductFromThisBatch;
  }

  if (remaining > 0) {
    console.warn(
      `สต็อกไม่พอสำหรับสินค้า ${productId}: ขาดอีก ${remaining} ชิ้น`
    );
    slicesByPrice.set(
      regularPrice,
      (slicesByPrice.get(regularPrice) ?? 0) + remaining
    );
  }

  return Array.from(slicesByPrice.entries()).map(([price_sold, quantity]) => ({
    price_sold,
    quantity,
  }));
}

export default function ReceiptPage() {
  const { t, locale } = useI18n();
  const isEn = locale.startsWith("en");
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
  const isCashEnough =
    hasCashInput && Number.isFinite(parsedReceived) && parsedReceived >= total;
  const change = isCashEnough ? parsedReceived - total : null;

  const canConfirm =
    cart.length > 0 &&
    (paymentMethod === "transfer" ||
      (paymentMethod === "cash" && isCashEnough));

  const handleConfirmPayment = async () => {
    if (cart.length === 0) return;

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
      // 1. ดึงราคาปกติและต้นทุนจริงล่าสุดจากตาราง products เพื่อให้กำไรใน Dashboard ถูกต้อง
      const productIds = Array.from(new Set(cart.map((item) => item.id)));
      const { data: productRows, error: productsError } = await supabase
        .from("products")
        .select("id, price, cost")
        .in("id", productIds);

      if (productsError) {
        alert(t("receipt.saveOrderError", { message: productsError.message }));
        setPaymentStatus("pending");
        return;
      }

      const productMap = new Map<string, { price: number; cost: number }>();
      for (const p of productRows ?? []) {
        productMap.set(p.id, { price: p.price ?? 0, cost: p.cost ?? 0 });
      }

      // 2. สร้างหัวบิลในตาราง orders
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

      // 3. ตัดสต็อกแบบ FEFO (เฉพาะล็อตที่ยังไม่หมดอายุ) และแตก order_items ตามราคาขายจริงของแต่ละล็อต
      const orderItems: {
        order_id: string;
        product_id: string;
        product_name: string;
        quantity: number;
        price_sold: number;
        cost_sold: number;
      }[] = [];

      for (const item of cart) {
        const dbProduct = productMap.get(item.id);
        const regularPrice = dbProduct?.price ?? item.regularPrice ?? item.price;
        const costSold = dbProduct?.cost ?? item.cost ?? 0;

        const slices = await deductStockFEFO(item.id, item.qty, regularPrice);
        for (const slice of slices) {
          orderItems.push({
            order_id: order.id,
            product_id: item.id,
            product_name: item.name,
            quantity: slice.quantity,
            price_sold: slice.price_sold,
            cost_sold: costSold,
          });
        }
      }

      // 4. บันทึกรายการสินค้าลง order_items
      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        alert(t("receipt.saveItemsError", { message: itemsError.message }));
        setPaymentStatus("pending");
        return;
      }

      setOrderId(order.id);
      setPaymentStatus("paid");
      localStorage.removeItem("cart");
      localStorage.removeItem("totalPrice");
      window.dispatchEvent(new Event("alerts:refresh"));
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
              {cart.map((item) => {
                const itemTotal = item.lineTotal ?? item.price * item.qty;
                return (
                  <div key={item.id} className="flex justify-between items-baseline gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-gray-800 truncate">{item.name}</p>
                        {item.hasDiscount && (
                          <span className="shrink-0 bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {isEn ? "Special" : "ราคาพิเศษ"}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-xs tabular-nums">
                        ฿{item.price.toFixed(2)} x {item.qty}
                      </p>
                    </div>
                    <p className="font-medium text-gray-800 tabular-nums shrink-0">
                      ฿{itemTotal.toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ยอดรวม */}
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