"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";

interface StockBatch {
  id: string;
  quantity: number;
  expiration_date: string | null;
}

interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
  cost: number;
  min_stock: number;
  category: string;
  photo_url: string | null;
  stock_batches: StockBatch[];
}

// --- Helpers: derive stock info from a product's batches ---
const getTotalStock = (p: Product) =>
  p.stock_batches.reduce((sum, b) => sum + b.quantity, 0);

const getActiveBatches = (p: Product) =>
  p.stock_batches.filter((b) => b.quantity > 0);

const getNearestExpiry = (p: Product): string | null => {
  const active = getActiveBatches(p).filter((b) => b.expiration_date);
  if (active.length === 0) return null;
  return active.reduce(
    (min, b) => (b.expiration_date! < min ? b.expiration_date! : min),
    active[0].expiration_date!
  );
};

const daysUntil = (dateStr: string) => {
  const today = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export default function InventoryPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  // Restock modal state
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState("");
  const [restockExpiry, setRestockExpiry] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select(
        `id, name, barcode, price, cost, category, min_stock, photo_url,
         stock_batches ( id, quantity, expiration_date )`
      )
      .order("name");

    if (error) {
      console.error("Error fetching products:", error.message);
    } else {
      setProducts((data as unknown as Product[]) || []);
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

  const openRestock = (product: Product) => {
    setRestockTarget(product);
    setRestockQty("");
    setRestockExpiry("");
  };

  const submitRestock = async () => {
    if (!restockTarget) return;
    const qty = parseInt(restockQty, 10);
    if (!qty || qty <= 0) {
      alert("กรุณาระบุจำนวนที่ถูกต้อง / Please enter a valid quantity");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("stock_batches").insert({
      product_id: restockTarget.id,
      quantity: qty,
      expiration_date: restockExpiry || null,
    });
    setSubmitting(false);

    if (error) {
      alert("เกิดข้อผิดพลาด / Error: " + error.message);
      return;
    }

    setRestockTarget(null);
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
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition whitespace-nowrap ${
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
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition whitespace-nowrap ${
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
          <p className="text-sm text-gray-400 px-1">
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
              const totalStock = getTotalStock(product);
              const activeBatches = getActiveBatches(product);
              const isLowStock = totalStock <= product.min_stock;
              const nearestExpiry = getNearestExpiry(product);
              const daysLeft = nearestExpiry ? daysUntil(nearestExpiry) : null;
              const isExpiringSoon =
                daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  {/* Card body */}
                  <div className="p-4 flex gap-3">
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
                          {totalStock} ชิ้น / pcs
                        </span>
                      </div>

                      {/* Badges */}
                      {(isLowStock || isExpiringSoon || activeBatches.length > 1) && (
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
                          {activeBatches.length > 1 && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                              📦 {activeBatches.length} ล็อต / lots
                            </span>
                          )}
                        </div>
                      )}

                      {/* Row 2: Meta info */}
                      <div className="mt-2 space-y-0.5">
                        <p className="text-sm text-gray-500">
                          <span className="text-gray-400">Barcode:</span> {product.barcode}
                          <span className="mx-1.5 text-gray-300">•</span>
                          <span className="text-gray-400">หมวด:</span> {product.category}
                        </p>
                        <p className="text-sm text-gray-500">
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
                        {nearestExpiry && (
                          <p className={`text-sm font-medium ${isExpiringSoon ? "text-red-500" : "text-gray-400"}`}>
                            EXP ใกล้สุด: {nearestExpiry}
                            {isExpiringSoon && ` · อีก ${daysLeft} วัน / ${daysLeft}d left`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex border-t border-gray-100">
                    <button
                      onClick={() => openRestock(product)}
                      className="flex-1 py-3 text-sm font-medium text-green-600 hover:bg-green-50 active:bg-green-100 transition flex items-center justify-center gap-1"
                    >
                      📥 <span>รับสินค้า / Restock</span>
                    </button>
                    <div className="w-px bg-gray-100" />
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

      {/* Restock modal */}
      {restockTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">รับสินค้าเข้า / Restock</h2>
              <p className="text-sm text-gray-400">{restockTarget.name}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 font-medium">
                  จำนวนที่รับเข้า / Quantity received
                </label>
                <input
                  type="number"
                  min={1}
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="mt-1 w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="เช่น 50"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 font-medium">
                  วันหมดอายุของล็อตนี้ / This batch's expiration date
                </label>
                <input
                  type="date"
                  value={restockExpiry}
                  onChange={(e) => setRestockExpiry(e.target.value)}
                  className="mt-1 w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setRestockTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
              >
                ยกเลิก / Cancel
              </button>
              <button
                onClick={submitRestock}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "กำลังบันทึก..." : "บันทึก / Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}