"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";

interface OrderItem {
  product_name: string;
  quantity: number;
  price_sold: number;
}

interface Order {
  id: string;
  total_amount: number;
  payment_type: string;
  created_at: string;
  order_items: OrderItem[];
}

export default function SalesHistoryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          total_amount,
          payment_type,
          created_at,
          order_items (
            product_name,
            quantity,
            price_sold
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching orders:", error.message);
      } else {
        setOrders(data || []);
      }
      setLoading(false);
    };

    fetchOrders();
  }, []);

  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
  orders.forEach((order) => {
    order.order_items.forEach((item) => {
      if (productSales[item.product_name]) {
        productSales[item.product_name].qty += item.quantity;
        productSales[item.product_name].revenue += item.quantity * item.price_sold;
      } else {
        productSales[item.product_name] = {
          name: item.product_name,
          qty: item.quantity,
          revenue: item.quantity * item.price_sold,
        };
      }
    });
  });

  const top5 = Object.values(productSales)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const maxQty = top5[0]?.qty || 1;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("th-TH");
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  };

  const paymentLabel: Record<string, string> = {
    cash: "เงินสด (Cash)",
    transfer: "โอนเงิน / QR Code (Transfer)",
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar role="Admin" />
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">

        <h1 className="text-2xl font-bold text-gray-800">
          ประวัติการขาย <span className="text-gray-400 font-normal text-lg">(Sales History)</span>
        </h1>

        {loading ? (
          <div className="text-center py-20 text-gray-400">
            กำลังโหลดข้อมูล... / Loading...
          </div>
        ) : (
          <>
            {/* Top 5 */}
            {top5.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-lg font-bold text-gray-800 mb-4">
                  🏆 Top 5 สินค้าขายดี
                  <span className="text-sm font-normal text-gray-400 ml-2">(Best Selling Products)</span>
                </h2>
                <div className="space-y-3">
                  {top5.map((product, index) => (
                    <div key={product.name} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        index === 0 ? "bg-amber-100 text-amber-700" :
                        index === 1 ? "bg-gray-100 text-gray-600" :
                        index === 2 ? "bg-orange-100 text-orange-700" :
                        "bg-gray-50 text-gray-400"
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {product.name}
                          </p>
                          <p className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {product.qty} ชิ้น / pcs
                          </p>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              index === 0 ? "bg-amber-400" :
                              index === 1 ? "bg-gray-400" :
                              index === 2 ? "bg-orange-400" :
                              "bg-blue-300"
                            }`}
                            style={{ width: `${(product.qty / maxQty) * 100}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-sm font-bold text-blue-600 flex-shrink-0">
                        ฿{product.revenue.toFixed(0)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* รายการ Order */}
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-3">
                รายการทั้งหมด <span className="text-sm font-normal text-gray-400">(All Orders)</span>
              </h2>

              {orders.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  ยังไม่มีรายการขาย / No orders yet
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                  <div className="divide-y divide-gray-100">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        onClick={() => router.push(`/history/${order.id}`)}
                        className="p-4 flex justify-between items-center hover:bg-gray-50 cursor-pointer gap-2 active:bg-gray-100 transition"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(order.created_at)} • {formatTime(order.created_at)}
                          </p>
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full mt-1 inline-block">
                            {paymentLabel[order.payment_type] ?? order.payment_type}
                          </span>
                        </div>
                        <div className="text-right flex-shrink-0 flex items-center gap-2">
                          <div>
                            <p className="font-bold text-blue-600 text-lg">
                              ฿{order.total_amount.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {order.order_items.length} รายการ / items
                            </p>
                          </div>
                          <span className="text-gray-300 text-lg">›</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}