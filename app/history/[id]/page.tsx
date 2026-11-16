"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabase";
import { useI18n } from "../../lib/i18n";

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
  order_items: OrderItem[] | null;
}

// Supabase returns `timestamp without time zone` in UTC without a trailing 'Z'.
// Normalize it as UTC first so `Asia/Bangkok` conversion is always accurate.
function parseUtcDate(dateStr: string): Date {
  const trimmed = dateStr.trim();
  const hasTimeZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const normalized = hasTimeZone
    ? trimmed
    : `${trimmed.replace(" ", "T")}Z`;
  return new Date(normalized);
}

export default function OrderDetailPage() {
  const { t, locale } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;

  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [role, setRole] = useState<string>("cashier");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const initPage = async () => {
      setLoading(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/");
        return;
      }

      const [profileRes, orderRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single(),
        supabase
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
          .single(),
      ]);

      if (!profileRes.error && profileRes.data?.role) {
        setRole(profileRes.data.role.toLowerCase());
      }

      if (orderRes.error || !orderRes.data) {
        console.error("Error fetching order:", orderRes.error?.message);
        alert(tRef.current("orderDetail.notFound"));
        router.push("/history");
        return;
      }

      setOrder(orderRes.data as Order);
      setLoading(false);
    };

    initPage();
  }, [id, router]);

  const paymentLabel: Record<string, string> = {
    cash: t("orderDetail.paymentCash"),
    transfer: t("orderDetail.paymentTransfer"),
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar role={role} />
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const parsedCreatedAt = parseUtcDate(order.created_at);
  const dateStr = parsedCreatedAt.toLocaleDateString(locale, {
    timeZone: "Asia/Bangkok",
  });
  const timeStr = parsedCreatedAt.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });

  const items = order.order_items ?? [];
  const totalProfit = items.reduce(
    (sum, item) =>
      sum + ((item.price_sold ?? 0) - (item.cost_sold ?? 0)) * item.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar role={role} />
      <div className="max-w-2xl mx-auto p-4 md:p-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => router.push("/history")}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12.5 15L7.5 10L12.5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-800">
            {t("orderDetail.title")}
          </h1>
        </div>

        {/* Order Info */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-base font-bold font-mono text-gray-800">
              #{order.id.slice(0, 8).toUpperCase()}
            </p>
            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3.5 8.5L6.5 11.5L12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("orderDetail.statusPaid")}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm pt-3 border-t border-gray-100 tabular-nums">
            <div>
              <p className="text-xs text-gray-400">{t("orderDetail.dateLabel")}</p>
              <p className="font-medium text-gray-700 mt-0.5">{dateStr}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">{t("orderDetail.timeLabel")}</p>
              <p className="font-medium text-gray-700 mt-0.5">{timeStr}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">{t("orderDetail.paymentMethodLabel")}</p>
              <p className="font-medium text-gray-700 mt-0.5">
                {paymentLabel[order.payment_type] ?? order.payment_type}
              </p>
            </div>
            {order.payment_type === "cash" && (
              <div>
                <p className="text-xs text-gray-400">{t("orderDetail.changeLabel")}</p>
                <p className="font-medium text-gray-700 mt-0.5">
                  ฿{(order.change ?? 0).toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* รายการสินค้า */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <h2 className="text-sm font-bold text-gray-600 mb-3">
            {items.length === 1
              ? t("orderDetail.itemsHeaderOne", { n: items.length })
              : t("orderDetail.itemsHeader", { n: items.length })}
          </h2>
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-baseline text-sm py-2 border-b border-gray-50 last:border-0"
              >
                <div>
                  <p className="font-medium text-gray-800">{item.product_name}</p>
                  <p className="text-gray-400 text-xs tabular-nums">
                    ฿{item.price_sold.toFixed(2)} x {item.quantity}
                  </p>
                </div>
                <p className="font-bold text-gray-800 tabular-nums">
                  ฿{(item.price_sold * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ยอดรวม + กำไร */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6 space-y-2.5 tabular-nums">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-medium text-gray-600">
              {t("orderDetail.totalSales")}
            </span>
            <span className="text-xl font-bold text-blue-600">
              ฿{(order.total_amount ?? 0).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-baseline pt-2.5 border-t border-gray-100">
            <span className="text-sm font-medium text-gray-600">
              {t("orderDetail.profit")}
            </span>
            <span className="text-lg font-bold text-emerald-600">
              ฿{totalProfit.toFixed(2)}
            </span>
          </div>
        </div>

        {/* ปุ่ม */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => router.push("/history")}
            className="w-full border border-gray-300 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition"
          >
            {t("orderDetail.back")}
          </button>
        </div>

      </div>
    </div>
  );
}