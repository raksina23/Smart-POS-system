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
  photo_url: string | null;
}

export default function InventoryPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

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

    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      alert("เกิดข้อผิดพลาด / Error: " + error.message);
      return;
    }

    fetchProducts();
  };

  // Build a unique, sorted list of categories present in the data
  const categories = Array.from(new Set(products.map((p) => p.category))).sort();

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search);
    const matchesCategory = selectedCategory ? p.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar role="Admin" />

      <div className="max-w-2xl mx-auto px-3 py-4 sm:px-6 sm:py-6 space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">
              คลังสินค้า
            </h1>
            <p className="text-sm text-gray-400">Inventory</p>
          </div>
          {/* Desktop: show button here */}
          <button
            onClick={() => router.push("/inventory/add")}
            className="hidden sm:flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition"
          >
            + เพิ่มสินค้า / Add
          </button>
        </div>

        {/* Search + Mobile Add button row */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="ค้นหาชื่อ / บาร์โค้ด..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
          />
          {/* Mobile: compact + button */}
          <button
            onClick={() => router.push("/inventory/add")}
            className="sm:hidden flex-shrink-0 bg-blue-600 text-white w-11 h-11 rounded-xl text-xl font-bold shadow-sm hover:bg-blue-700 transition flex items-center justify-center"
            aria-label="เพิ่มสินค้า"
          >
            +
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setSelectedCategory("")}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition whitespace-nowrap ${
              selectedCategory === ""
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            ทั้งหมด / All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Count */}
        {!loading && (
          <p className="text-xs text-gray-400 px-1">
            พบ {filtered.length} รายการ / {filtered.length} item{filtered.length !== 1 ? "s" : ""}
          </p>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            <div className="text-3xl mb-2">⏳</div>
            กำลังโหลด... / Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            <div className="text-3xl mb-2">📦</div>
            ไม่พบสินค้า / No products found
          </div>
        ) : (
          <div className="space-y-2.5">
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
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  {/* Card body */}
                  <div className="p-4 flex gap-3">
                    {/* Photo thumbnail */}
                    <div className="flex-shrink-0">
                      {product.photo_url ? (
                        <img
                          src={product.photo_url}
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded-lg border border-gray-100"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 text-xl">
                          📦
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Row 1: Name + Stock badge */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-gray-800 text-base leading-snug flex-1 min-w-0 truncate">
                          {product.name}
                        </p>
                        <span
                          className={`flex-shrink-0 text-sm font-semibold px-3 py-0.5 rounded-full whitespace-nowrap ${
                            isLowStock
                              ? "bg-orange-100 text-orange-600"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {product.stock_qty} ชิ้น
                        </span>
                      </div>

                      {/* Badges */}
                      {(isLowStock || isExpiringSoon) && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {isLowStock && (
                            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                              ⚠️ สต็อกต่ำ / Low Stock
                            </span>
                          )}
                          {isExpiringSoon && (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                              🕐 ใกล้หมดอายุ / Expiring Soon
                            </span>
                          )}
                        </div>
                      )}

                      {/* Row 2: Meta info */}
                      <div className="mt-2 space-y-0.5">
                        <p className="text-xs text-gray-500">
                          <span className="text-gray-400">Barcode:</span> {product.barcode}
                          <span className="mx-1.5 text-gray-300">•</span>
                          <span className="text-gray-400">หมวด:</span> {product.category}
                        </p>
                        <p className="text-xs text-gray-500">
                          <span className="text-gray-400">ราคา:</span>{" "}
                          <span className="font-medium text-gray-700">฿{product.price}</span>
                          <span className="mx-1.5 text-gray-300">•</span>
                          <span className="text-gray-400">ทุน:</span>{" "}
                          <span className="font-medium text-gray-700">฿{product.cost}</span>
                          <span className="mx-1.5 text-gray-300">•</span>
                          <span className="text-gray-400">กำไร:</span>{" "}
                          <span className="font-medium text-green-600">
                            ฿{product.price - product.cost}
                          </span>
                        </p>
                        {product.expiration_date && (
                          <p className={`text-xs font-medium ${isExpiringSoon ? "text-red-500" : "text-gray-400"}`}>
                            EXP: {product.expiration_date}
                            {isExpiringSoon && ` · อีก ${daysLeft} วัน / ${daysLeft}d left`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex border-t border-gray-100">
                    <button
                      onClick={() => router.push(`/inventory/edit/${product.id}`)}
                      className="flex-1 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition flex items-center justify-center gap-1"
                    >
                      ✏️ <span>แก้ไข / Edit</span>
                    </button>
                    <div className="w-px bg-gray-100" />
                    <button
                      onClick={() => handleDelete(product.id, product.name)}
                      className="flex-1 py-3 text-sm font-medium text-red-500 hover:bg-red-50 active:bg-red-100 transition flex items-center justify-center gap-1"
                    >
                      🗑️ <span>ลบ / Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom padding for mobile scroll */}
        <div className="h-4" />
      </div>
    </div>
  );
}