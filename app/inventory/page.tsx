"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { useI18n } from "../lib/i18n";

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

function BoxIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" strokeLinejoin="round" />
      <path d="M3 8l9 5 9-5M12 13v8" strokeLinejoin="round" />
    </svg>
  );
}

function RestockIcon({ className = "w-4 h-4 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 4v11m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EditIcon({ className = "w-4 h-4 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function InventoryPage() {
  const { t } = useI18n();
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
      .eq("is_active", true)
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
    if (!confirm(t("inventory.confirmDelete", { name }))) return;

    const { error } = await supabase
      .from("products")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      alert(t("inventory.errorMessage", { message: error.message }));
      return;
    }

    fetchProducts();
    window.dispatchEvent(new Event("alerts:refresh"));
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
      alert(t("inventory.invalidQty"));
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
      alert(t("inventory.errorMessage", { message: error.message }));
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
      alert(t("inventory.saveSpecialPriceError", { message: error.message }));
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
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      <Navbar role="Admin" />

      <div className="max-w-2xl mx-auto px-3 py-4 sm:px-6 sm:py-6 space-y-3.5">

        {/* Header */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">
              {t("nav.inventory")}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => router.push("/inventory/add")}
            className="hidden sm:flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-700 transition"
          >
            {t("inventory.addProduct")}
          </button>
        </div>

        {/* Search + Mobile Add button row */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={t("inventory.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-base sm:text-sm bg-white"
          />
          <button
            type="button"
            onClick={() => router.push("/inventory/add")}
            className="sm:hidden flex-shrink-0 bg-blue-600 text-white w-11 h-11 rounded-xl shadow-sm hover:bg-blue-700 active:scale-95 transition flex items-center justify-center"
            aria-label={t("inventory.addProductAria")}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            type="button"
            onClick={() => setSelectedCategory("")}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition whitespace-nowrap ${
              selectedCategory === ""
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t("inventory.filterAll")}
          </button>
          {categoryNames.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition whitespace-nowrap ${
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
          <p className="text-sm text-gray-500 px-1 tabular-nums">
            {filtered.length === 1
              ? t("inventory.foundCountOne", { n: filtered.length })
              : t("inventory.foundCount", { n: filtered.length })}
          </p>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            {t("common.loading")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm flex flex-col items-center">
            <BoxIcon className="w-10 h-10 text-gray-300 mb-2.5" />
            {t("inventory.noProducts")}
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
                  <div className="w-full flex justify-center pt-3 px-3 pb-1 bg-white">
                    <div className="w-full aspect-square max-w-[160px] rounded-xl overflow-hidden bg-gray-100">
                      {product.photo_url ? (
                        <img
                          src={product.photo_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <BoxIcon className="w-9 h-9" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3 sm:p-3.5 flex-1 flex flex-col">
                    {/* Name + stock */}
                    <div className="flex items-start justify-between gap-1.5">
                      <p className="font-bold text-gray-800 text-sm sm:text-base leading-snug flex-1 min-w-0 line-clamp-2">
                        {product.name}
                      </p>
                      <span
                        className={`flex-shrink-0 text-xs font-bold tabular-nums px-2 py-0.5 rounded-full whitespace-nowrap ${
                          isLowStock
                            ? "bg-orange-100 text-orange-600"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {t("inventory.stockUnit", { n: totalStock })}
                      </span>
                    </div>

                    {/* Badges */}
                    {(isLowStock || isExpiringSoon || activeBatches.length > 1) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {isLowStock && (
                          <span className="text-xs font-semibold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                            {t("inventory.lowStock")}
                          </span>
                        )}
                        {isExpiringSoon && (
                          <span className="text-xs font-semibold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                            {t("inventory.expiringSoon")}
                          </span>
                        )}
                        {activeBatches.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedProductId(isExpanded ? null : product.id)
                            }
                            className="text-xs font-semibold tabular-nums bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full hover:bg-blue-100 transition"
                          >
                            {t("inventory.batchCount", {
                              n: activeBatches.length,
                              arrow: isExpanded ? "▲" : "▼",
                            })}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Meta info */}
                    <div className="mt-2.5 space-y-1">
                      <p className="text-sm text-gray-500 break-all">
                        <span className="text-gray-400">{t("inventory.barcodeLabel")}</span>{" "}
                        <span className="font-mono tabular-nums">{product.barcode}</span>
                      </p>
                      <p className="text-sm text-gray-500">
                        <span className="text-gray-400">{t("inventory.categoryLabel")}</span>{" "}
                        {product.category}
                      </p>
                      <p className="text-sm text-gray-500 tabular-nums">
                        <span className="text-gray-400">{t("inventory.priceLabel")}</span>{" "}
                        <span className="font-semibold text-gray-800">฿{product.price}</span>
                      </p>
                      <p className="text-sm text-gray-500 tabular-nums">
                        <span className="text-gray-400">{t("inventory.costLabel")}</span>{" "}
                        <span className="font-semibold text-gray-800">฿{product.cost}</span>
                      </p>
                      <p className="text-sm text-gray-500 tabular-nums">
                        <span className="text-gray-400">{t("inventory.profitLabel")}</span>{" "}
                        <span className="font-bold text-emerald-600">
                          ฿{product.price - product.cost}
                        </span>
                      </p>
                      {nearestExpiry && (
                        <p
                          className={`text-sm font-medium tabular-nums pt-0.5 ${
                            isExpiringSoon ? "text-red-600 font-bold" : "text-gray-400"
                          }`}
                        >
                          {t("inventory.nearestExpiry", { date: nearestExpiry })}
                          {isExpiringSoon && (
                            <>
                              <br />
                              {t("inventory.daysLeft", { n: daysLeft! })}
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
                        <p className="text-xs sm:text-sm font-bold text-gray-600">
                          {t("inventory.batchesHeader")}
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
                              className={`rounded-xl p-2.5 text-xs sm:text-sm space-y-1.5 border ${
                                isExpiringSoonBatch
                                  ? "bg-red-50/80 border-red-200"
                                  : "bg-gray-50 border-gray-100"
                              }`}
                            >
                              <div className="flex justify-between items-center gap-1">
                                <span className="font-semibold text-gray-700">
                                  {t("inventory.batchNumber", { n: idx + 1 })}{" "}
                                  {idx === 0 && t("inventory.sellsFirst")}
                                </span>
                                <span
                                  className={`font-bold tabular-nums shrink-0 ${
                                    isExpiringSoonBatch ? "text-red-600" : "text-gray-800"
                                  }`}
                                >
                                  {t("inventory.stockUnit", { n: batch.quantity })}
                                </span>
                              </div>
                              <p className="text-gray-500 tabular-nums">
                                {batch.expiration_date
                                  ? t("inventory.batchExpiry", { date: batch.expiration_date })
                                  : t("inventory.noExpiry")}
                              </p>

                              {isExpiringSoonBatch && (
                                <div className="pt-1">
                                  {alreadyDiscounted ? (
                                    <p className="text-green-700 font-bold tabular-nums">
                                      {t("inventory.alreadyDiscounted", {
                                        price: batch.special_price!,
                                      })}
                                    </p>
                                  ) : categoryDiscount <= 0 ? (
                                    <p className="text-gray-400 italic">
                                      {t("inventory.noCategoryDiscount")}
                                    </p>
                                  ) : (
                                    <>
                                      <p className="text-red-600 font-bold mb-1.5 tabular-nums">
                                        {t("inventory.expiringDiscountHint", {
                                          days: batchDaysLeft!,
                                          percent: categoryDiscount,
                                        })}
                                      </p>
                                      <div className="flex flex-wrap items-center justify-between gap-1.5 bg-white rounded-lg px-2.5 py-1.5 border border-red-200 tabular-nums">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-gray-400 line-through">
                                            ฿{product.price}
                                          </span>
                                          <span className="font-bold text-red-600">
                                            ฿{computedPrice}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            confirmBatchDiscount(batch.id, computedPrice)
                                          }
                                          disabled={applyingBatchId === batch.id}
                                          className="bg-red-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-red-600 disabled:opacity-50 whitespace-nowrap transition"
                                        >
                                          {applyingBatchId === batch.id
                                            ? "..."
                                            : t("inventory.confirm")}
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
                      type="button"
                      onClick={() => openRestock(product)}
                      className="py-2.5 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 transition flex items-center justify-center gap-1.5 border-b border-gray-100"
                    >
                      <RestockIcon />
                      <span>{t("inventory.restock")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/inventory/edit/${product.id}`)}
                      className="py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition flex items-center justify-center gap-1.5 border-b border-gray-100"
                    >
                      <EditIcon />
                      <span>{t("inventory.edit")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(product.id, product.name)}
                      className="py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 active:bg-red-100 transition flex items-center justify-center gap-1.5"
                    >
                      <TrashIcon />
                      <span>{t("inventory.delete")}</span>
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
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-xl">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">
                {t("inventory.restockModalTitle")}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">{restockTarget.name}</p>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-sm text-gray-700 font-semibold">
                  {t("inventory.quantityReceived")}
                </label>
                <input
                  type="number"
                  min={1}
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="mt-1.5 w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-base sm:text-sm tabular-nums"
                  placeholder={t("inventory.quantityPlaceholder")}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 font-semibold">
                  {t("inventory.batchExpiryLabel")}
                </label>
                {restockCategory?.shelf_life_days != null && !restockExpiryTouched && (
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5 mb-1.5 leading-relaxed">
                    {t("inventory.autoExpiryHint", {
                      category: restockCategory.name,
                      days: restockCategory.shelf_life_days,
                    })}
                  </p>
                )}
                {restockCategory?.shelf_life_days == null && (
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5 mb-1.5 leading-relaxed">
                    {t("inventory.noShelfLifeHint")}
                  </p>
                )}
                <input
                  type="date"
                  value={restockExpiry}
                  onChange={(e) => {
                    setRestockExpiry(e.target.value);
                    setRestockExpiryTouched(true);
                  }}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-base sm:text-sm tabular-nums"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRestockTarget(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={submitRestock}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {submitting ? t("inventory.saving") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}