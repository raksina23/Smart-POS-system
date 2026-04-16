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

  // state สำหรับเลือกสินค้าที่จะสั่งซื้อ
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
    alert(`ลดราคา "${product.name}" ${percent}% เรียบร้อย! / Discount applied!\nราคาใหม่ / New price: ฿${newPrice}`);
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
      alert("กรุณาเลือกสินค้าที่ต้องการสั่งซื้อ / Please select products to reorder");
      return;
    }
    localStorage.setItem("purchaseOrderItems", JSON.stringify(selected));
    router.push("/purchase-order");
  };

  const maxAmount = Math.max(...monthlyData.map((d) => d.amount), 1);
  const now = new Date();
  const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 font-sans pb-10 text-gray-800">
      <Navbar role="Admin" />

      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex justify-between items-center mt-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              ภาพรวมระบบ <span className="text-gray-400 font-normal text-lg">(Dashboard)</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              อัปเดตล่าสุด / Last updated: {timeStr} น.
            </p>
          </div>
          <span className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm">
            ผู้ดูแลระบบ (Admin)
          </span>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">
            กำลังโหลดข้อมูล... / Loading...
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">ยอดขายวันนี้ / Today's Sales</p>
                <p className="text-2xl font-black text-blue-600">฿{todaySales.toLocaleString()}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">จำนวนบิล / Bills Today</p>
                <p className="text-2xl font-black text-indigo-600">{todayBills}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">กำไรวันนี้ / Today's Profit</p>
                <p className="text-2xl font-black text-emerald-500">฿{todayProfit.toLocaleString()}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">ยอดขายเดือนนี้ / Monthly Sales</p>
                <p className="text-2xl font-black text-blue-800">฿{monthSales.toLocaleString()}</p>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  📊 สถิติยอดขายและกำไรรายเดือน
                  <span className="text-sm font-normal text-gray-400">(Monthly Sales & Profit)</span>
                </h2>
                <div className="flex gap-4 p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="w-3 h-3 bg-blue-500 rounded-full"></span> ยอดขาย / Sales
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="w-3 h-3 bg-emerald-500 rounded-full"></span> กำไร / Profit
                  </div>
                </div>
              </div>

              <div className="relative h-72 w-full mt-4 flex items-end justify-between px-2 pb-6 border-b-2 border-gray-100">
                {monthlyData.map((data, index) => {
                  const salesHeight = (data.amount / maxAmount) * 100;
                  const profitHeight = (data.profit / maxAmount) * 100;
                  return (
                    <div key={index} className="flex flex-col items-center flex-1 group">
                      <div className="flex items-end gap-1.5 h-64 w-full justify-center">
                        <div style={{ height: `${salesHeight}%` }} className="w-5 md:w-10 bg-blue-500 rounded-t-md hover:bg-blue-600 transition-all duration-300 relative">
                          <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-xl">
                            ขาย: ฿{data.amount.toLocaleString()}
                          </span>
                        </div>
                        <div style={{ height: `${profitHeight}%` }} className="w-5 md:w-10 bg-emerald-500 rounded-t-md hover:bg-emerald-600 transition-all duration-300 relative">
                          <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-emerald-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-xl">
                            กำไร: ฿{data.profit.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-gray-500 mt-4 uppercase tracking-tighter">{data.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Alerts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* สินค้าใกล้หมดอายุ */}
              <div className="bg-red-50 border-t-4 border-red-500 p-5 rounded-b-2xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-red-700 font-bold text-lg flex items-center gap-2">
                    <span className="text-xl">⚠️</span>
                    สินค้าใกล้หมดอายุ
                    <span className="text-sm font-normal">(Expiring Soon)</span>
                  </h2>
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {expiringProducts.length} รายการ / items
                  </span>
                </div>

                {expiringProducts.length === 0 ? (
                  <p className="text-sm text-red-400 text-center py-4">
                    ไม่มีสินค้าใกล้หมดอายุ / No expiring products
                  </p>
                ) : (
                  <div className="space-y-3">
                    {expiringProducts.map((item) => (
                      <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-red-100 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-800">{item.name}</p>
                          <p className="text-xs text-gray-500">
                            คงเหลือ / Stock: {item.stock_qty} ชิ้น | ฿{item.price} | อีก / In {item.daysLeft} วัน / days
                          </p>
                        </div>
                        <div className="relative">
                          {discountedItems[item.id] ? (
                            <span className="bg-green-100 text-green-700 border border-green-200 text-xs font-bold px-4 py-2 rounded-lg">
                              ✓ ลด {discountedItems[item.id]}% แล้ว
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => setOpenDropdown(openDropdown === item.id ? null : item.id)}
                                className="bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-red-600 shadow-sm transition-all"
                              >
                                🏷️ ลดราคา / Discount ▾
                              </button>
                              {openDropdown === item.id && (
                                <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden w-36">
                                  {[50, 30, 25].map((percent) => (
                                    <button
                                      key={percent}
                                      onClick={() => handleApplyDiscount(item.id, percent)}
                                      className="w-full text-left px-4 py-2 text-sm font-bold text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                                    >
                                      ลด / Off {percent}%
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* สินค้าสต็อกต่ำ */}
              <div className="bg-orange-50 border-t-4 border-orange-500 p-5 rounded-b-2xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-orange-700 font-bold text-lg flex items-center gap-2">
                    <span className="text-xl">📦</span>
                    สินค้าสต๊อกต่ำ
                    <span className="text-sm font-normal">(Low Stock)</span>
                  </h2>
                  <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {lowStockProducts.length} รายการ / items
                  </span>
                </div>

                {lowStockProducts.length === 0 ? (
                  <p className="text-sm text-orange-400 text-center py-4">
                    สต็อกสินค้าปกติทุกรายการ / All stock levels normal
                  </p>
                ) : (
                  <>
                    {/* ปุ่มเลือกทั้งหมด */}
                    <div className="flex justify-between items-center mb-3">
                      <button
                        onClick={selectAll}
                        className="text-xs text-orange-600 font-bold hover:underline"
                      >
                        เลือกทั้งหมด / Select All
                      </button>
                      {selectedCount > 0 && (
                        <span className="text-xs text-orange-500 font-medium">
                          เลือกแล้ว {selectedCount} รายการ / {selectedCount} selected
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {lowStockProducts.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => toggleSelect(item.id)}
                          className={`bg-white p-4 rounded-xl shadow-sm border cursor-pointer transition-all ${
                            selectedItems[item.id]
                              ? "border-orange-400 ring-2 ring-orange-200"
                              : "border-orange-100 hover:border-orange-300"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              {/* Checkbox */}
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                selectedItems[item.id]
                                  ? "bg-orange-500 border-orange-500"
                                  : "border-gray-300"
                              }`}>
                                {selectedItems[item.id] && (
                                  <span className="text-white text-xs font-bold">✓</span>
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-gray-800">{item.name}</p>
                                <p className="text-xs font-bold text-orange-600">
                                  เหลือเพียง / Only {item.stock_qty} ชิ้น (ขั้นต่ำ / Min: {item.min_stock})
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* ปุ่มสร้างใบสั่งซื้อ */}
                    <button
                      onClick={handleCreatePurchaseOrder}
                      disabled={selectedCount === 0}
                      className={`w-full mt-4 font-bold py-3 rounded-xl text-sm transition ${
                        selectedCount > 0
                          ? "bg-orange-500 text-white hover:bg-orange-600"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      📋 สร้างใบสั่งซื้อ / Create Purchase Order ({selectedCount})
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