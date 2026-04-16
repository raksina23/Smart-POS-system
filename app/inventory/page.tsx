"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";

interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
  cost: number;
  stock_qty: number;
  min_stock: number;
  category: string;
  expiration_date: string;
}

export default function InventoryPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching products:", error.message);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบ "${name}" หรือไม่? / Delete this product?`)) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) {
      alert("เกิดข้อผิดพลาด / Error: " + error.message);
      return;
    }

    fetchProducts();
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search)
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar role="Admin" />
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">

        {/* Header */}
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold text-gray-800">
            คลังสินค้า <span className="text-gray-400 font-normal text-lg">(Inventory)</span>
          </h1>
          <button
            onClick={() => router.push("/inventory/add")}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition"
          >
            + เพิ่มสินค้า / Add Product
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="ค้นหาชื่อสินค้าหรือบาร์โค้ด / Search by name or barcode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
        />

        {loading ? (
          <div className="text-center py-10 text-gray-400">
            กำลังโหลดข้อมูล... / Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            ไม่พบสินค้า / No products found
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((product) => {
              const isLowStock = product.stock_qty <= product.min_stock;
              const today = new Date();
              const expDate = new Date(product.expiration_date);
              const daysLeft = Math.ceil(
                (expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
              );
              const isExpiringSoon = daysLeft <= 7 && daysLeft >= 0;

              return (
                <div
                  key={product.id}
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-100"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-800">{product.name}</p>
                        {isLowStock && (
                          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                            สต็อกต่ำ / Low Stock
                          </span>
                        )}
                        {isExpiringSoon && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                            ใกล้หมดอายุ / Expiring Soon
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        บาร์โค้ด / Barcode: {product.barcode} • ราคา / Price: ฿{product.price} • ทุน / Cost: ฿{product.cost}
                      </p>
                      <p className="text-sm text-gray-500">
                        หมวดหมู่ / Category: {product.category}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-semibold px-3 py-1 rounded-full ${
                        isLowStock
                          ? "bg-orange-100 text-orange-600"
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        สต็อก / Stock: {product.stock_qty}
                      </p>
                      {product.expiration_date && (
                        <p className={`text-xs mt-1 font-medium ${
                          isExpiringSoon ? "text-red-500" : "text-gray-400"
                        }`}>
                          EXP: {product.expiration_date}
                          {isExpiringSoon && ` (อีก / In ${daysLeft} วัน / days)`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => router.push(`/inventory/edit/${product.id}`)}
                      className="flex-1 text-sm text-blue-600 border border-blue-200 py-1.5 rounded-lg hover:bg-blue-50 transition"
                    >
                      ✏️ แก้ไข / Edit
                    </button>
                    <button
                      onClick={() => handleDelete(product.id, product.name)}
                      className="flex-1 text-sm text-red-500 border border-red-200 py-1.5 rounded-lg hover:bg-red-50 transition"
                    >
                      🗑️ ลบ / Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}