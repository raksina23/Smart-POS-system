"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { bkkDate, daysLeftFrom } from "../lib/dates";
import AiInsights from "../components/AiInsights";
import { useI18n } from "../lib/i18n";
import { TKey } from "../lib/dictionaries";

interface ExpiringProduct {
  id: string; // stock_batches.id
  product_id: string;
  name: string;
  category: string;
  stock_qty: number; // this BATCH's quantity
  price: number;
  cost: number;
  expiration_date: string;
  daysLeft: number;
  special_price: number | null; // already-applied discount, if any
}

interface LowStockProduct {
  id: string;
  name: string;
  stock_qty: number;
  min_stock: number;
  activeBatchCount: number;
}

interface CategoryDiscount {
  name: string;
  discount_percent: number;
}

interface MonthlyData {
  monthKey: TKey;
  amount: number;
  profit: number;
}

interface DashboardStatsRpc {
  todaySales: number;
  todayBills: number;
  todayProfit: number;
  monthSales: number;
  monthly: { month: number; amount: number; profit: number }[];
}

// Computes the discounted price for a batch, based on its category's fixed
// discount %. Floors at cost so the store never sells at a loss on this item.
function computeCategoryDiscountPrice(price: number, cost: number, discountPercent: number) {
  const rawPrice = Math.round(price * (1 - discountPercent / 100));
  return Math.max(rawPrice, cost);
}

const getRestockAction = (activeBatchCount: number): { labelKey: TKey; color: string } =>
  activeBatchCount >= 2
    ? { labelKey: "dashboard.restockFromBackup", color: "text-orange-600" }
    : { labelKey: "dashboard.buyMoreStock", color: "text-red-600" };

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const isEn = locale.startsWith("en");

  const [expiringProducts, setExpiringProducts] = useState<ExpiringProduct[]>([]);
  const [categoryDiscounts, setCategoryDiscounts] = useState<Record<string, number>>({});
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [todaySales, setTodaySales] = useState(0);
  const [todayBills, setTodayBills] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  const [loading, setLoading] = useState(true);

  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    await Promise.all([
      fetchCategoryDiscounts(),
      fetchExpiringProducts(),
      fetchLowStockProducts(),
      fetchOrderStats(),
    ]);
    setLoading(false);
  };

  const fetchCategoryDiscounts = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("name, discount_percent");
    if (!error && data) {
      const map: Record<string, number> = {};
      (data as CategoryDiscount[]).forEach((c) => {
        map[c.name] = c.discount_percent ?? 0;
      });
      setCategoryDiscounts(map);
    }
  };

  const fetchExpiringProducts = async () => {
    const { data, error } = await supabase
      .from("stock_batches")
      .select(`
        id,
        product_id,
        quantity,
        expiration_date,
        special_price,
        products!inner ( name, price, cost, category, is_active )
      `)
      .eq("products.is_active", true)
      .gt("quantity", 0)
      .lte("expiration_date", bkkDate(7))
      .order("expiration_date");

    if (!error && data) {
      const mapped = data.map((b: any) => {
        const daysLeft = daysLeftFrom(b.expiration_date);
        return {
          id: b.id,
          product_id: b.product_id,
          name: b.products?.name ?? "",
          category: b.products?.category ?? "",
          price: b.products?.price ?? 0,
          cost: b.products?.cost ?? 0,
          stock_qty: b.quantity,
          expiration_date: b.expiration_date,
          daysLeft,
          special_price: b.special_price ?? null,
        };
      });
      setExpiringProducts(mapped);
    }
  };

  const fetchLowStockProducts = async () => {
    const todayBkk = bkkDate(0);
    const { data: allProducts } = await supabase
      .from("products")
      .select(`id, name, min_stock, stock_batches ( quantity, expiration_date )`)
      .eq("is_active", true);

    if (allProducts) {
      const withTotals = (allProducts as any[]).map((p) => {
        const batches: { quantity: number; expiration_date: string | null }[] =
          p.stock_batches ?? [];
        const sellableBatches = batches.filter(
          (b) => b.quantity > 0 && (!b.expiration_date || b.expiration_date >= todayBkk)
        );
        const stock_qty = sellableBatches.reduce((sum, b) => sum + b.quantity, 0);
        const activeBatchCount = sellableBatches.length;
        return {
          id: p.id,
          name: p.name,
          min_stock: p.min_stock ?? 0,
          stock_qty,
          activeBatchCount,
        };
      });

      const low = withTotals.filter((p) => p.stock_qty <= p.min_stock);
      setLowStockProducts(low);
    }
  };

  const fetchOrderStats = async () => {
    const todayStr = bkkDate(0); // "YYYY-MM-DD" in Asia/Bangkok
    const [, monthStr] = todayStr.split("-");
    const thisMonth = Number(monthStr) - 1; // 0-indexed

    const monthKeys: TKey[] = [
      "dashboard.monthJan",
      "dashboard.monthFeb",
      "dashboard.monthMar",
      "dashboard.monthApr",
      "dashboard.monthMay",
      "dashboard.monthJun",
      "dashboard.monthJul",
      "dashboard.monthAug",
      "dashboard.monthSep",
      "dashboard.monthOct",
      "dashboard.monthNov",
      "dashboard.monthDec",
    ];

    const { data, error } = await supabase.rpc("get_dashboard_stats");

    if (error || !data) {
      console.error("Error fetching dashboard stats:", error?.message);
      return;
    }

    const stats = data as DashboardStatsRpc;
    setTodaySales(Number(stats.todaySales ?? 0));
    setTodayBills(Number(stats.todayBills ?? 0));
    setTodayProfit(Number(stats.todayProfit ?? 0));
    setMonthSales(Number(stats.monthSales ?? 0));

    const monthMap: Record<number, { amount: number; profit: number }> = {};
    (stats.monthly ?? []).forEach((row) => {
      monthMap[row.month] = {
        amount: Number(row.amount ?? 0),
        profit: Number(row.profit ?? 0),
      };
    });

    const yearToDate: MonthlyData[] = [];
    for (let m = 0; m <= thisMonth; m++) {
      const monthNum = m + 1;
      yearToDate.push({
        monthKey: monthKeys[m],
        amount: monthMap[monthNum]?.amount ?? 0,
        profit: monthMap[monthNum]?.profit ?? 0,
      });
    }

    setMonthlyData(yearToDate);
  };

  const handleApplyDiscount = async (batch: ExpiringProduct) => {
    if (batch.daysLeft < 0) return;
    setApplyingId(batch.id);

    const percent = categoryDiscounts[batch.category] ?? 0;
    const newPrice = computeCategoryDiscountPrice(batch.price, batch.cost, percent);

    const { error } = await supabase
      .from("stock_batches")
      .update({ special_price: newPrice })
      .eq("id", batch.id);

    setApplyingId(null);

    if (error) {
      alert(t("dashboard.applyDiscountError", { message: error.message }));
      return;
    }

    fetchExpiringProducts();
  };

  const handleDiscardExpired = async (batch: ExpiringProduct) => {
    const confirmMsg = isEn
      ? `Discard "${batch.name}" (${batch.stock_qty} units) and remove this expired batch from stock?`
      : `ยืนยันการตัดทิ้ง "${batch.name}" จำนวน ${batch.stock_qty} ชิ้น ออกจากสต็อก (ล็อตหมดอายุ)?`;

    if (!confirm(confirmMsg)) return;

    setDiscardingId(batch.id);

    const { error } = await supabase
      .from("stock_batches")
      .update({ quantity: 0 })
      .eq("id", batch.id);

    setDiscardingId(null);

    if (error) {
      alert(
        isEn
          ? `Failed to discard batch: ${error.message}`
          : `ตัดสต็อกหมดอายุไม่สำเร็จ: ${error.message}`
      );
      return;
    }

    await Promise.all([fetchExpiringProducts(), fetchLowStockProducts()]);
  };

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectAll = () => {
    const all: Record<string, boolean> = {};
    lowStockProducts.forEach((p) => (all[p.id] = true));
    setSelectedItems(all);
  };

  const selectedCount = Object.values(selectedItems).filter(Boolean).length;

  const handleCreatePurchaseOrder = () => {
    const selected = lowStockProducts.filter((p) => selectedItems[p.id]);
    if (selected.length === 0) {
      alert(t("dashboard.selectItemsToOrder"));
      return;
    }
    localStorage.setItem("purchaseOrderItems", JSON.stringify(selected));
    router.push("/purchase-order");
  };

  const maxAmount = Math.max(...monthlyData.map((d) => d.amount), 1);
  const now = new Date();
  const timeStr = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-16 text-gray-800">
      <Navbar role="Admin" />

      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 space-y-4 md:space-y-6">

        {/* ─── Header ─── */}
        <div className="flex flex-wrap items-start justify-between gap-2 mt-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">
              {t("dashboard.title")}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
              {t("dashboard.lastUpdated", { time: timeStr })}
            </p>
          </div>
          <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-sm whitespace-nowrap">
            {t("dashboard.roleAdmin")}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            {t("dashboard.loading")}
          </div>
        ) : (
          <>
            {/* ─── Summary Cards ─── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <SummaryCard
                label={t("dashboard.todaySales")}
                value={`฿${todaySales.toLocaleString(locale, { maximumFractionDigits: 0 })}`}
                color="text-blue-600"
              />
              <SummaryCard
                label={t("dashboard.billsToday")}
                value={String(todayBills)}
                color="text-indigo-600"
              />
              <SummaryCard
                label={t("dashboard.todayProfit")}
                value={`฿${todayProfit.toLocaleString(locale, { maximumFractionDigits: 0 })}`}
                color="text-emerald-600"
              />
              <SummaryCard
                label={t("dashboard.monthlySales")}
                value={`฿${monthSales.toLocaleString(locale, { maximumFractionDigits: 0 })}`}
                color="text-blue-800"
              />
            </div>

            {/* ─── Bar Chart ─── */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
                <h2 className="text-base sm:text-lg font-bold text-gray-800">
                  {t("dashboard.monthlyChartTitle")}
                </h2>
                <div className="flex gap-3 px-3 py-1.5 bg-gray-50 rounded-lg self-start sm:self-auto">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                    <span>{t("dashboard.legendSales")}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                    <span>{t("dashboard.legendProfit")}</span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <div
                  className="relative flex items-end justify-between gap-1.5 border-b border-gray-100 h-56 sm:h-64 pb-7 pt-8"
                  style={{ minWidth: "520px" }}
                >
                  {monthlyData.map((data, index) => {
                    const salesPct =
                      data.amount > 0 ? Math.max((data.amount / maxAmount) * 100, 2) : 0;
                    const profitPct =
                      data.profit > 0 ? Math.max((data.profit / maxAmount) * 100, 2) : 0;
                    return (
                      <div key={index} className="flex flex-col items-center flex-1 group min-w-0 h-full">
                        <div className="flex items-end gap-1 w-full justify-center h-full">
                          <div
                            style={{ height: `${salesPct}%` }}
                            className="w-3.5 sm:w-5 md:w-6 bg-blue-500 rounded-t-md hover:bg-blue-600 transition-all duration-300 relative"
                          >
                            <span className="hidden sm:block absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] tabular-nums px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-md">
                              ฿{data.amount.toLocaleString(locale, { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div
                            style={{ height: `${profitPct}%` }}
                            className="w-3.5 sm:w-5 md:w-6 bg-emerald-500 rounded-t-md hover:bg-emerald-600 transition-all duration-300 relative"
                          >
                            <span className="hidden sm:block absolute -top-8 left-1/2 -translate-x-1/2 bg-emerald-900 text-white text-[10px] tabular-nums px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-md">
                              ฿{data.profit.toLocaleString(locale, { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] sm:text-xs font-semibold text-gray-500 mt-2 whitespace-nowrap">
                          {t(data.monthKey)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ─── Alert Panels ─── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

              {/* สินค้าใกล้หมดอายุ / หมดอายุแล้ว */}
              <div className="bg-red-50/70 border border-red-200/80 p-4 sm:p-5 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-red-700 font-bold text-base sm:text-lg flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{t("alerts.popupExpiring")}</span>
                  </h2>
                  <span className="bg-red-500 text-white text-xs font-bold tabular-nums px-2.5 py-1 rounded-full shrink-0">
                    {t("alerts.itemCount", { n: expiringProducts.length })}
                  </span>
                </div>

                {expiringProducts.length === 0 ? (
                  <p className="text-sm text-red-400 text-center py-4">
                    {t("dashboard.noExpiring")}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {expiringProducts.map((item) => {
                      const isExpired = item.daysLeft < 0;
                      const percent = categoryDiscounts[item.category] ?? 0;
                      const discountedPrice = computeCategoryDiscountPrice(
                        item.price,
                        item.cost,
                        percent
                      );
                      const alreadyApplied = item.special_price != null;

                      return (
                        <div
                          key={item.id}
                          className={`p-3 sm:p-4 rounded-xl border ${
                            isExpired
                              ? "bg-red-50/60 border-red-200"
                              : "bg-white border-red-100"
                          }`}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-bold text-gray-800 text-sm sm:text-base truncate">
                                {item.name}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                                {t("dashboard.batchQty", { n: item.stock_qty })}
                                {" · "}
                                {t("dashboard.categoryLabel", { category: item.category })}
                                {" · "}
                                {isExpired ? (
                                  <span className="font-bold text-red-700">
                                    {isEn
                                      ? `Expired ${Math.abs(item.daysLeft)}d ago`
                                      : `หมดอายุแล้ว ${Math.abs(item.daysLeft)} วัน`}
                                  </span>
                                ) : item.daysLeft === 0 ? (
                                  <span className="font-bold text-red-600">
                                    {isEn ? "Expires today" : "หมดอายุวันนี้"}
                                  </span>
                                ) : (
                                  <>
                                    {t("dashboard.expiresPrefix")}{" "}
                                    <span className="font-bold text-red-600">
                                      {t("dashboard.daysLeft", { n: item.daysLeft })}
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>
                            <div className="shrink-0 self-start sm:self-auto">
                              {isExpired ? (
                                <button
                                  type="button"
                                  onClick={() => handleDiscardExpired(item)}
                                  disabled={discardingId === item.id}
                                  className="flex items-center gap-1.5 bg-gray-800 text-white text-xs font-bold tabular-nums px-3 py-1.5 rounded-lg hover:bg-gray-900 transition-all disabled:opacity-50"
                                >
                                  <span>
                                    {discardingId === item.id
                                      ? t("dashboard.saving")
                                      : isEn
                                      ? `Discard (${item.stock_qty})`
                                      : `ตัดทิ้ง / นำออก (${item.stock_qty})`}
                                  </span>
                                </button>
                              ) : alreadyApplied ? (
                                <span className="bg-green-100 text-green-700 border border-green-200 text-xs font-bold tabular-nums px-3 py-1.5 rounded-lg inline-block">
                                  {t("dashboard.specialPrice", { price: item.special_price! })}
                                </span>
                              ) : percent <= 0 ? (
                                <span className="text-xs text-gray-400 italic">
                                  {t("dashboard.noCategoryDiscount")}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleApplyDiscount(item)}
                                  disabled={applyingId === item.id}
                                  className="flex items-center gap-2 bg-red-500 text-white text-xs font-bold tabular-nums px-3 py-1.5 rounded-lg hover:bg-red-600 transition-all disabled:opacity-50"
                                >
                                  <span className="line-through opacity-75">฿{item.price}</span>
                                  <span>฿{discountedPrice}</span>
                                  <span>
                                    {applyingId === item.id
                                      ? t("dashboard.saving")
                                      : t("dashboard.confirmDiscount", { percent })}
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* สินค้าสต็อกต่ำ */}
              <div className="bg-orange-50/70 border border-orange-200/80 p-4 sm:p-5 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-orange-700 font-bold text-base sm:text-lg flex items-center gap-2">
                    <svg className="w-5 h-5 text-orange-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" strokeLinejoin="round" />
                      <path d="M3 8l9 5 9-5M12 13v8" strokeLinejoin="round" />
                    </svg>
                    <span>{t("alerts.popupLowStock")}</span>
                  </h2>
                  <span className="bg-orange-500 text-white text-xs font-bold tabular-nums px-2.5 py-1 rounded-full shrink-0">
                    {t("alerts.itemCount", { n: lowStockProducts.length })}
                  </span>
                </div>

                {lowStockProducts.length === 0 ? (
                  <p className="text-sm text-orange-400 text-center py-4">
                    {t("dashboard.stockNormal")}
                  </p>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-3">
                      <button
                        type="button"
                        onClick={selectAll}
                        className="text-xs text-orange-600 font-bold hover:underline"
                      >
                        {t("dashboard.selectAll")}
                      </button>
                      {selectedCount > 0 && (
                        <span className="text-xs text-orange-600 font-medium tabular-nums">
                          {t("dashboard.selectedCount", { n: selectedCount })}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      {lowStockProducts.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => toggleSelect(item.id)}
                          className={`bg-white p-3 sm:p-4 rounded-xl border cursor-pointer transition-all ${
                            selectedItems[item.id]
                              ? "border-orange-400 ring-2 ring-orange-200"
                              : "border-orange-100 hover:border-orange-300"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                selectedItems[item.id]
                                  ? "bg-orange-500 border-orange-500"
                                  : "border-gray-300"
                              }`}
                            >
                              {selectedItems[item.id] && (
                                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4">
                                  <path d="M3.5 8.5L6.5 11.5L12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-800 text-sm sm:text-base truncate">
                                {item.name}
                              </p>
                              <p className="text-xs font-bold text-orange-600 tabular-nums">
                                {t("dashboard.stockLeft", { n: item.stock_qty })}{" "}
                                <span className="font-normal text-gray-400">
                                  ({t("dashboard.minStock", { n: item.min_stock })} ·{" "}
                                  {item.activeBatchCount === 0
                                    ? t("dashboard.noBackupLot")
                                    : t("dashboard.oneLotLeft")}
                                  )
                                </span>
                              </p>
                              <p className={`text-xs font-semibold mt-0.5 ${getRestockAction(item.activeBatchCount).color}`}>
                                {t(getRestockAction(item.activeBatchCount).labelKey)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleCreatePurchaseOrder}
                      disabled={selectedCount === 0}
                      className={`w-full mt-4 font-bold py-3 rounded-xl text-sm tabular-nums transition ${
                        selectedCount > 0
                          ? "bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.99]"
                          : "bg-white/70 text-gray-400 border border-gray-200 cursor-not-allowed"
                      }`}
                    >
                      {t("dashboard.createPurchaseOrder", { n: selectedCount })}
                    </button>
                  </>
                )}
              </div>

            </div>
            <AiInsights />
          </>
        )}
      </div>
    </div>
  );
}

/* ── Helper Component ── */
function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white p-3 sm:p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 leading-snug">
        {label}
      </p>
      <p className={`text-lg sm:text-2xl font-bold tabular-nums ${color} leading-tight`}>
        {value}
      </p>
    </div>
  );
}