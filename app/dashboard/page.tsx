"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";

interface ExpiringProduct {
  id: string;
  name: string;
  stock_qty: number;
  price: number;
  expiration_date: string;
  daysLeft: number;
}

interface LowStockProduct {
  id: string;
  name: string;
  stock_qty: number;
  min_stock: number;
}

interface MonthlyData {
  month: string;
  amount: number;
  profit: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [expiringProducts, setExpiringProducts] = useState<ExpiringProduct[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [todaySales, setTodaySales] = useState(0);
  const [todayBills, setTodayBills] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  const [loading, setLoading] = useState(true);

  const [discountedItems, setDiscountedItems] = useState<Record<string, number>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    await Promise.all([
      fetchExpiringProducts(),
      fetchLowStockProducts(),
      fetchOrderStats(),
    ]);
    setLoading(false);
  };

  const fetchExpiringProducts = async () => {
    const today = new Date();
    const in7Days = new Date();
    in7Days.setDate(today.getDate() + 7);

    const { data, error } = await supabase
      .from("products")
      .select("id, name, stock_qty, price, expiration_date")
      .lte("expiration_date", in7Days.toISOString().split("T")[0])
      .gte("expiration_date", today.toISOString().split("T")[0])
      .order("expiration_date");

    if (!error && data) {
      const mapped = data.map((p) => {
        const exp = new Date(p.expiration_date);
        const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { ...p, daysLeft };
      });
      setExpiringProducts(mapped);
    }
  };

  const fetchLowStockProducts = async () => {
    const { data: allProducts } = await supabase
      .from("products")
      .select("id, name, stock_qty, min_stock");

    if (allProducts) {
      const low = allProducts.filter((p) => p.stock_qty <= p.min_stock);
      setLowStockProducts(low);
    }
  };

  const fetchOrderStats = async () => {
    const { data: orders, error } = await supabase
      .from("orders")
      .select(`
        id,
        total_amount,
        created_at,
        order_items (
          quantity,
          price_sold,
          cost_sold
        )
      `);

    if (error || !orders) return;

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();

    let tSales = 0, tBills = 0, tProfit = 0, mSales = 0;
    const monthMap: Record<string, { amount: number; profit: number }> = {};

    orders.forEach((order) => {
      const orderDate = new Date(order.created_at);
      const orderDateStr = order.created_at.split("T")[0];
      const orderMonth = orderDate.getMonth();
      const orderYear = orderDate.getFullYear();

      const orderProfit = order.order_items.reduce(
        (sum: number, item: { quantity: number; price_sold: number; cost_sold: number }) =>
          sum + (item.price_sold - item.cost_sold) * item.quantity,
        0
      );

      if (orderDateStr === todayStr) {
        tSales += order.total_amount;
        tBills += 1;
        tProfit += orderProfit;
      }

      if (orderMonth === thisMonth && orderYear === thisYear) {
        mSales += order.total_amount;
      }

      const monthKey = `${orderYear}-${String(orderMonth + 1).padStart(2, "0")}`;
      if (!monthMap[monthKey]) monthMap[monthKey] = { amount: 0, profit: 0 };
      monthMap[monthKey].amount += order.total_amount;
      monthMap[monthKey].profit += orderProfit;
    });

    setTodaySales(tSales);
    setTodayBills(tBills);
    setTodayProfit(tProfit);
    setMonthSales(mSales);

    const thMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const last6: MonthlyData[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      last6.push({
        month: thMonths[d.getMonth()],
        amount: monthMap[key]?.amount ?? 0,
        profit: monthMap[key]?.profit ?? 0,
      });
    }

    setMonthlyData(last6);
  };

  const handleApplyDiscount = async (id: string, percent: number) => {
    const product = expiringProducts.find((p) => p.id === id);
    if (!product) return;

    const newPrice = Math.round(product.price * (1 - percent / 100));

    const { error } = await supabase
      .from("products")
      .update({ price: newPrice })
      .eq("id", id);

    if (error) {
      alert("เกิดข้อผิดพลาด / Error: " + error.message);
      return;
    }

    setDiscountedItems({ ...discountedItems, [id]: percent });
    setOpenDropdown(null);
    alert(`ลดราคา "${product.name}" ${percent}% เรียบร้อย!\nราคาใหม่: ฿${newPrice}`);
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
      alert("กรุณาเลือกสินค้าที่ต้องการสั่งซื้อ");
      return;
    }
    localStorage.setItem("purchaseOrderItems", JSON.stringify(selected));
    router.push("/purchase-order");
  };

  const maxAmount = Math.max(...monthlyData.map((d) => d.amount), 1);
  const now = new Date();
  const timeStr = now.toLocaleTimeString("th-TH", { 
  hour: "2-digit", 
  minute: "2-digit",
  timeZone: "Asia/Bangkok"
  });

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-16 text-gray-800">
      <Navbar role="Admin" />

      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 space-y-4 md:space-y-6">

        {/* ─── Header ─── */}
        <div className="flex flex-wrap items-start justify-between gap-2 mt-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">
              ภาพรวมระบบ{" "}
              <span className="text-gray-400 font-normal text-base sm:text-lg">
                (Dashboard)
              </span>
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              อัปเดตล่าสุด: {timeStr} น.
            </p>
          </div>
          <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-sm whitespace-nowrap">
            ผู้ดูแลระบบ (Admin)
          </span>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            กำลังโหลดข้อมูล...
          </div>
        ) : (
          <>
            {/* ─── Summary Cards ─── */}
            {/* บนมือถือ: 2×2, บน tablet ขึ้นไป: 4 คอลัมน์ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <SummaryCard
                label="ยอดขายวันนี้"
                sublabel="Today's Sales"
                value={`฿${todaySales.toLocaleString()}`}
                color="text-blue-600"
              />
              <SummaryCard
                label="จำนวนบิล"
                sublabel="Bills Today"
                value={String(todayBills)}
                color="text-indigo-600"
              />
              <SummaryCard
                label="กำไรวันนี้"
                sublabel="Today's Profit"
                value={`฿${todayProfit.toLocaleString()}`}
                color="text-emerald-500"
              />
              <SummaryCard
                label="ยอดขายเดือนนี้"
                sublabel="Monthly Sales"
                value={`฿${monthSales.toLocaleString()}`}
                color="text-blue-800"
              />
            </div>

            {/* ─── Bar Chart ─── */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Chart header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
                <h2 className="text-base sm:text-lg font-bold flex flex-wrap items-center gap-1.5">
                  📊 สถิติยอดขายและกำไรรายเดือน
                  <span className="text-xs sm:text-sm font-normal text-gray-400">
                    (Monthly)
                  </span>
                </h2>
                <div className="flex gap-3 p-2 bg-gray-50 rounded-lg self-start sm:self-auto">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" /> ยอดขาย
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" /> กำไร
                  </div>
                </div>
              </div>

              {/* Chart bars — ใช้ min-w เพื่อให้ scroll แนวนอนบนมือถือแทนการบีบ */}
              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                {/* ใช้ px fixed height แทน % เพื่อให้แท่งกราฟแสดงได้ถูกต้อง */}
                <div
                  className="relative flex items-end justify-between gap-1 border-b-2 border-gray-100"
                  style={{ minWidth: "320px", height: "220px", paddingBottom: "28px" }}
                >
                  {monthlyData.map((data, index) => {
                    const chartHeight = 192; // 220px - 28px padding
                    const salesH = Math.round((data.amount / maxAmount) * chartHeight);
                    const profitH = Math.round((data.profit / maxAmount) * chartHeight);
                    return (
                      <div key={index} className="flex flex-col items-center flex-1 group min-w-0">
                        <div
                          className="flex items-end gap-1 w-full justify-center"
                          style={{ height: `${chartHeight}px` }}
                        >
                          {/* Sales bar */}
                          <div
                            style={{ height: `${salesH}px` }}
                            className="w-4 sm:w-8 md:w-10 bg-blue-500 rounded-t-md hover:bg-blue-600 transition-all duration-300 relative"
                          >
                            <span className="hidden sm:block absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-xl">
                              ฿{data.amount.toLocaleString()}
                            </span>
                          </div>
                          {/* Profit bar */}
                          <div
                            style={{ height: `${profitH}px` }}
                            className="w-4 sm:w-8 md:w-10 bg-emerald-500 rounded-t-md hover:bg-emerald-600 transition-all duration-300 relative"
                          >
                            <span className="hidden sm:block absolute -top-9 left-1/2 -translate-x-1/2 bg-emerald-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-xl">
                              ฿{data.profit.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold text-gray-500 mt-2 tracking-tighter">
                          {data.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ─── Alert Panels ─── */}
            {/* stack บนมือถือ, side-by-side บน md ขึ้นไป */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

              {/* สินค้าใกล้หมดอายุ */}
              <div className="bg-red-50 border-t-4 border-red-500 p-4 sm:p-5 rounded-b-2xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-red-700 font-bold text-base sm:text-lg flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>
                      สินค้าใกล้หมดอายุ{" "}
                      <span className="text-xs font-normal hidden sm:inline">(Expiring Soon)</span>
                    </span>
                  </h2>
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shrink-0">
                    {expiringProducts.length} รายการ
                  </span>
                </div>

                {expiringProducts.length === 0 ? (
                  <p className="text-sm text-red-400 text-center py-4">
                    ไม่มีสินค้าใกล้หมดอายุ
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {expiringProducts.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-red-100"
                      >
                        {/* แบ่ง 2 แถวบนมือถือแทน flex row เดียว */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-bold text-gray-800 text-sm sm:text-base truncate">
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              คงเหลือ {item.stock_qty} ชิ้น · ฿{item.price} · อีก{" "}
                              <span className="font-bold text-red-600">{item.daysLeft} วัน</span>
                            </p>
                          </div>
                          <div className="relative self-start sm:self-auto shrink-0">
                            {discountedItems[item.id] ? (
                              <span className="bg-green-100 text-green-700 border border-green-200 text-xs font-bold px-3 py-1.5 rounded-lg inline-block">
                                ✓ ลด {discountedItems[item.id]}% แล้ว
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() =>
                                    setOpenDropdown(openDropdown === item.id ? null : item.id)
                                  }
                                  className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-600 shadow-sm transition-all"
                                >
                                  🏷️ ลดราคา ▾
                                </button>
                                {openDropdown === item.id && (
                                  <div className="absolute left-0 sm:right-0 sm:left-auto mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden w-32">
                                    {[50, 30, 25].map((percent) => (
                                      <button
                                        key={percent}
                                        onClick={() => handleApplyDiscount(item.id, percent)}
                                        className="w-full text-left px-4 py-2 text-sm font-bold text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                                      >
                                        ลด {percent}%
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* สินค้าสต็อกต่ำ */}
              <div className="bg-orange-50 border-t-4 border-orange-500 p-4 sm:p-5 rounded-b-2xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-orange-700 font-bold text-base sm:text-lg flex items-center gap-1.5">
                    <span>📦</span>
                    <span>
                      สินค้าสต๊อกต่ำ{" "}
                      <span className="text-xs font-normal hidden sm:inline">(Low Stock)</span>
                    </span>
                  </h2>
                  <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shrink-0">
                    {lowStockProducts.length} รายการ
                  </span>
                </div>

                {lowStockProducts.length === 0 ? (
                  <p className="text-sm text-orange-400 text-center py-4">
                    สต็อกสินค้าปกติทุกรายการ
                  </p>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-3">
                      <button
                        onClick={selectAll}
                        className="text-xs text-orange-600 font-bold hover:underline"
                      >
                        เลือกทั้งหมด
                      </button>
                      {selectedCount > 0 && (
                        <span className="text-xs text-orange-500 font-medium">
                          เลือกแล้ว {selectedCount} รายการ
                        </span>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      {lowStockProducts.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => toggleSelect(item.id)}
                          className={`bg-white p-3 sm:p-4 rounded-xl shadow-sm border cursor-pointer transition-all ${
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
                                <span className="text-white text-xs font-bold">✓</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-800 text-sm sm:text-base truncate">
                                {item.name}
                              </p>
                              <p className="text-xs font-bold text-orange-600">
                                เหลือ {item.stock_qty} ชิ้น{" "}
                                <span className="font-normal text-gray-400">
                                  (ขั้นต่ำ {item.min_stock})
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleCreatePurchaseOrder}
                      disabled={selectedCount === 0}
                      className={`w-full mt-4 font-bold py-3 rounded-xl text-sm transition ${
                        selectedCount > 0
                          ? "bg-orange-500 text-white hover:bg-orange-600 active:scale-95"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      📋 สร้างใบสั่งซื้อ ({selectedCount} รายการ)
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Helper Component ── */
function SummaryCard({
  label,
  sublabel,
  value,
  color,
}: {
  label: string;
  sublabel: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white p-3 sm:p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      {/* label บนมือถือแสดงแค่ภาษาไทย, บน sm ขึ้นไปแสดงทั้งคู่ */}
      <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 leading-snug">
        {label}
        <span className="hidden sm:inline"> / {sublabel}</span>
      </p>
      <p className={`text-lg sm:text-2xl font-black ${color} leading-tight`}>{value}</p>
    </div>
  );
}