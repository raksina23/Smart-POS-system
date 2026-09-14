"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";

interface StockBatch {
  id: string;
  quantity: number;
  expiration_date: string | null;
  special_price: number | null;
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

interface Category {
  id: string;
  name: string;
  shelf_life_days: number | null;
  discount_percent: number;
}

// --- Helpers: derive stock info from a product's batches ---
const getTotalStock = (p: Product) =>
  p.stock_batches.reduce((sum, b) => sum + b.quantity, 0);

const getActiveBatches = (p: Product) =>
  p.stock_batches
    .filter((b) => b.quantity > 0)
    .sort((a, b) => {
      // oldest / soonest-expiring first, mirrors FEFO sell order
      if (!a.expiration_date) return 1;
      if (!b.expiration_date) return -1;
      return a.expiration_date.localeCompare(b.expiration_date);
    });

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

const toDateInputValue = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// Same formula used on the Dashboard — fixed % per category, floored at
// cost so the store never sells this batch at an actual loss.
const computeCategoryDiscountPrice = (
  price: number,
  cost: number,
  discountPercent: number
) => {
  const rawPrice = Math.round(price * (1 - discountPercent / 100));
  return Math.max(rawPrice, cost);
};

export default function InventoryPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  // Which product cards have their batch list expanded
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // Restock modal state
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState("");
  const [restockExpiry, setRestockExpiry] = useState("");
  const [restockExpiryTouched, setRestockExpiryTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Tracks which batch is currently being confirmed for a discount
  const [applyingBatchId, setApplyingBatchId] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select(
        `id, name, barcode, price, cost, category, min_stock, photo_url,
         stock_batches ( id, quantity, expiration_date, special_price )`
      )
      .order("name");

    if (error) {
      console.error("Error fetching products:", error.message);
    } else {
      setProducts((data as unknown as Product[]) || []);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, shelf_life_days, discount_percent");
    if (!error && data) setCategories(data);
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
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
    setRestockExpiryTouched(false);

    // Auto-calculate expiry from this product's category shelf life, if set
    const cat = categories.find((c) => c.name === product.category);
    if (cat?.shelf_life_days != null) {
      const computed = new Date();
      computed.setDate(computed.getDate() + cat.shelf_life_days);
      setRestockExpiry(toDateInputValue(computed));
    } else {
      setRestockExpiry("");
    }
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

  // Confirms the auto-computed category discount for one batch — same rule
  // as Dashboard: expiring within 7 days, regardless of remaining quantity.
  const confirmBatchDiscount = async (batchId: string, computedPrice: number) => {
    setApplyingBatchId(batchId);
    const { error } = await supabase
      .from("stock_batches")
      .update({ special_price: computedPrice })
      .eq("id", batchId);
    setApplyingBatchId(null);

    if (error) {
      alert("บันทึกราคาพิเศษไม่สำเร็จ / Failed to save special price: " + error.message);
      return;
    }

    fetchProducts();
  };

  // Build a unique, sorted list of categories present in the data
  const categoryNames = Array.from(new Set(products.map((p) => p.category))).sort();

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search);
    const matchesCategory = selectedCategory ? p.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  const restockCategory = restockTarget
    ? categories.find((c) => c.name === restockTarget.category)
    : null;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar role="Admin" />

      <div className="max-w-2xl mx-auto px-3 py-4 sm:px-6 sm:py-6 space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-2xl font-bold text-gray-800 leading-tight">
              คลังสินค้า
            </h1>
            <p className="text-xl text-gray-400">Inventory</p>
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
          {categoryNames.map((cat) => (
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
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((product) => {
              const totalStock = getTotalStock(product);
              const activeBatches = getActiveBatches(product);
              const isLowStock = totalStock <= product.min_stock;
              const nearestExpiry = getNearestExpiry(product);
              const daysLeft = nearestExpiry ? daysUntil(nearestExpiry) : null;
              const isExpiringSoon =
                daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
              const isExpanded = expandedProductId === product.id;
              const categoryDiscount =
                categories.find((c) => c.name === product.category)?.discount_percent ?? 0;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
                >
                  {/* Photo */}
                  <div className="w-full flex justify-center pt-3 pb-1 bg-white">
                    <div className="w-40 h-40 rounded-lg overflow-hidden bg-gray-100">
                      {product.photo_url ? (
                        <img
                          src={product.photo_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">
                          📦
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3 flex-1 flex flex-col">
                    {/* Name + stock */}
                    <div className="flex items-start justify-between gap-1.5">
                      <p className="font-bold text-gray-800 text-sm leading-snug flex-1 min-w-0 truncate">
                        {product.name}
                      </p>
                      <span
                        className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                          isLowStock
                            ? "bg-orange-100 text-orange-600"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {totalStock} ชิ้น
                      </span>
                    </div>

                    {/* Badges */}
                    {(isLowStock || isExpiringSoon || activeBatches.length > 1) && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {isLowStock && (
                          <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">
                            ⚠️ สต็อกต่ำ / Low Stock
                          </span>
                        )}
                        {isExpiringSoon && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                            🕐 ใกล้หมดอายุ / Expiring Soon
                          </span>
                        )}
                        {activeBatches.length > 1 && (
                          <button
                            onClick={() =>
                              setExpandedProductId(isExpanded ? null : product.id)
                            }
                            className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full hover:bg-blue-100"
                          >
                            📦 {activeBatches.length} ล็อต / lots {isExpanded ? "▲" : "▼"}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Meta info */}
                    <div className="mt-2 space-y-0.5">
                      <p className="text-sm text-gray-500">
                        <span className="text-gray-400">บาร์โค้ด / Barcode:</span> {product.barcode}
                      </p>
                      <p className="text-sm text-gray-500">
                        <span className="text-gray-400">หมวดหมู่ / Category:</span> {product.category}
                      </p>
                      <p className="text-sm text-gray-500">
                        <span className="text-gray-400">ราคา / Price:</span>{" "}
                        <span className="font-medium text-gray-700">฿{product.price}</span>
                      </p>
                      <p className="text-sm text-gray-500">
                        <span className="text-gray-400">ทุน / Cost:</span>{" "}
                        <span className="font-medium text-gray-700">฿{product.cost}</span>
                      </p>
                      <p className="text-sm text-gray-500">
                        <span className="text-gray-400">กำไร / Profit:</span>{" "}
                        <span className="font-medium text-green-600">
                          ฿{product.price - product.cost}
                        </span>
                      </p>
                      {nearestExpiry && (
                        <p className={`text-sm font-medium ${isExpiringSoon ? "text-red-500" : "text-gray-400"}`}>
                          EXP ใกล้สุด: {nearestExpiry}
                          {isExpiringSoon && (
                            <>
                              <br />
                              อีก {daysLeft} วัน / {daysLeft}d left
                            </>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Expanded batch list — oldest/soonest-expiring first (FEFO
                        order). Any batch expiring within 7 days gets the
                        category's fixed discount % applied, regardless of
                        remaining quantity — matches the Dashboard rule exactly. */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                        <p className="text-xs font-bold text-gray-500">
                          ล็อตสินค้า / Batches (เรียงตามลำดับขาย FEFO)
                        </p>
                        {activeBatches.map((batch, idx) => {
                          const batchDaysLeft = batch.expiration_date
                            ? daysUntil(batch.expiration_date)
                            : null;
                          const isExpiringSoonBatch =
                            batchDaysLeft !== null && batchDaysLeft <= 7 && batchDaysLeft >= 0;
                          const alreadyDiscounted = batch.special_price != null;
                          const computedPrice = computeCategoryDiscountPrice(
                            product.price,
                            product.cost,
                            categoryDiscount
                          );

                          return (
                            <div
                              key={batch.id}
                              className={`rounded-lg p-2.5 text-xs space-y-1.5 border ${
                                isExpiringSoonBatch
                                  ? "bg-red-50 border-red-200"
                                  : "bg-gray-50 border-gray-100"
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-gray-600">
                                  ล็อต #{idx + 1} {idx === 0 && "(ขายก่อน / sells first)"}
                                </span>
                                <span
                                  className={`font-bold ${
                                    isExpiringSoonBatch ? "text-red-600" : "text-gray-700"
                                  }`}
                                >
                                  {batch.quantity} ชิ้น
                                </span>
                              </div>
                              <p className="text-gray-400">
                                {batch.expiration_date
                                  ? `หมดอายุ: ${batch.expiration_date}`
                                  : "ไม่ระบุวันหมดอายุ / No expiry set"}
                              </p>

                              {isExpiringSoonBatch && (
                                <div className="pt-1">
                                  {alreadyDiscounted ? (
                                    <p className="text-green-600 font-bold">
                                      ✓ ราคาพิเศษแล้ว: ฿{batch.special_price}
                                    </p>
                                  ) : categoryDiscount <= 0 ? (
                                    <p className="text-gray-400 italic">
                                      หมวดหมู่นี้ยังไม่ตั้ง % ลดราคา (ตั้งได้ที่หน้าหมวดหมู่) /
                                      No discount % set for this category yet.
                                    </p>
                                  ) : (
                                    <>
                                      <p className="text-red-600 font-bold mb-1">
                                        🕐 ใกล้หมดอายุ (อีก {batchDaysLeft} วัน) — ระบบแนะนำลด{" "}
                                        {categoryDiscount}% ตามหมวดหมู่
                                      </p>
                                      <div className="flex items-center justify-between bg-white rounded-md px-2 py-1.5 border border-red-200">
                                        <span className="text-gray-400 line-through">
                                          ฿{product.price}
                                        </span>
                                        <span className="font-bold text-red-600">
                                          ฿{computedPrice}
                                        </span>
                                        <button
                                          onClick={() =>
                                            confirmBatchDiscount(batch.id, computedPrice)
                                          }
                                          disabled={applyingBatchId === batch.id}
                                          className="bg-red-600 text-white px-2.5 py-1 rounded-md font-bold hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                                        >
                                          {applyingBatchId === batch.id ? "..." : "ยืนยัน"}
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="border-t border-gray-100 flex flex-col">
                    <button
                      onClick={() => openRestock(product)}
                      className="py-2.5 text-sm font-medium text-green-600 hover:bg-green-50 active:bg-green-100 transition flex items-center justify-center gap-1 border-b border-gray-100"
                    >
                      📥 <span>รับสินค้า / Restock</span>
                    </button>
                    <button
                      onClick={() => router.push(`/inventory/edit/${product.id}`)}
                      className="py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition flex items-center justify-center gap-1 border-b border-gray-100"
                    >
                      ✏️ <span>แก้ไข / Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(product.id, product.name)}
                      className="py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 active:bg-red-100 transition flex items-center justify-center gap-1"
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
                {restockCategory?.shelf_life_days != null && !restockExpiryTouched && (
                  <p className="text-xs text-gray-400 mt-0.5 mb-1">
                    คำนวณอัตโนมัติจากหมวดหมู่ "{restockCategory.name}" (อายุ{" "}
                    {restockCategory.shelf_life_days} วัน) — แก้ไขได้หากต่างจากนี้ /
                    Auto-calculated from category shelf life — adjust if needed.
                  </p>
                )}
                {restockCategory?.shelf_life_days == null && (
                  <p className="text-xs text-gray-400 mt-0.5 mb-1">
                    หมวดหมู่นี้ยังไม่กำหนดอายุสินค้า กรุณาเลือกวันเอง /
                    No shelf life set for this category — please pick manually.
                  </p>
                )}
                <input
                  type="date"
                  value={restockExpiry}
                  onChange={(e) => {
                    setRestockExpiry(e.target.value);
                    setRestockExpiryTouched(true);
                  }}
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
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