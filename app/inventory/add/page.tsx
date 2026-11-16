"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabase";
import { useI18n } from "../../lib/i18n";
import { TKey } from "../../lib/dictionaries";

interface Category {
  id: string;
  name: string;
  shelf_life_days: number | null;
}

type FieldError = {
  key: TKey;
  vars?: Record<string, string | number>;
};

function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function AddProductPage() {
  const { t } = useI18n();
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    barcode: "",
    price: "",
    cost: "",
    stock: "",
    minStock: "",
    category: "",
    expDate: "",
  });

  const [errors, setErrors] = useState<Record<string, FieldError | undefined>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [expDateTouched, setExpDateTouched] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, shelf_life_days")
        .order("name", { ascending: true });

      if (!error && data) setCategories(data);
      setLoadingCategories(false);
    };
    fetchCategories();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));

    if (name === "expDate") {
      setExpDateTouched(true);
    }

    if (name === "category") {
      const selected = categories.find((c) => c.name === value);
      if (!expDateTouched && selected?.shelf_life_days != null) {
        const computed = new Date();
        computed.setDate(computed.getDate() + selected.shelf_life_days);
        setForm((prev) => ({
          ...prev,
          category: value,
          expDate: toDateInputValue(computed),
        }));
        return;
      }
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrors({ ...errors, photo: { key: "addProduct.errPhotoType" } });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors({ ...errors, photo: { key: "addProduct.errPhotoSize" } });
      return;
    }

    setErrors({ ...errors, photo: undefined });
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const validate = () => {
    const newErrors: Record<string, FieldError> = {};
    if (!form.name) newErrors.name = { key: "addProduct.errNameRequired" };
    if (!form.barcode) newErrors.barcode = { key: "addProduct.errBarcodeRequired" };
    if (!form.price || isNaN(Number(form.price)))
      newErrors.price = { key: "addProduct.errPriceInvalid" };
    if (!form.cost || isNaN(Number(form.cost)))
      newErrors.cost = { key: "addProduct.errCostInvalid" };
    if (!form.stock || isNaN(Number(form.stock)))
      newErrors.stock = { key: "addProduct.errStockInvalid" };
    if (!form.minStock || isNaN(Number(form.minStock)))
      newErrors.minStock = { key: "addProduct.errMinStockInvalid" };
    if (!form.category) newErrors.category = { key: "addProduct.errCategoryRequired" };
    if (!form.expDate) newErrors.expDate = { key: "addProduct.errExpDateRequired" };
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    let photoUrl: string | null = null;

    if (photoFile) {
      setUploading(true);
      const fileExt = photoFile.name.split(".").pop();
      const fileName = `${form.barcode || Date.now()}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("product-photos")
        .upload(fileName, photoFile, {
          cacheControl: "3600",
          upsert: false,
        });

      setUploading(false);

      if (uploadError) {
        alert(t("addProduct.uploadFailed", { message: uploadError.message }));
        return;
      }

      const { data: urlData } = supabase.storage
        .from("product-photos")
        .getPublicUrl(fileName);

      photoUrl = urlData.publicUrl;
    }

    const { data: newProduct, error: productError } = await supabase
      .from("products")
      .insert({
        name: form.name,
        barcode: form.barcode,
        price: Number(form.price),
        cost: Number(form.cost),
        min_stock: Number(form.minStock),
        category: form.category,
        photo_url: photoUrl,
      })
      .select()
      .single();

    if (productError || !newProduct) {
      alert(t("addProduct.saveError", { message: productError?.message ?? "" }));
      return;
    }

    const { error: batchError } = await supabase.from("stock_batches").insert({
      product_id: newProduct.id,
      quantity: Number(form.stock),
      expiration_date: form.expDate,
    });

    if (batchError) {
      alert(t("addProduct.batchSaveFailed", { message: batchError.message }));
      router.push("/inventory");
      return;
    }

    alert(t("addProduct.saveSuccess", { name: form.name }));
    router.push("/inventory");
  };

  const selectedCategory = categories.find((c) => c.name === form.category);

  const inputClass =
    "w-full min-w-0 px-4 py-3 sm:py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-base sm:text-sm";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar role="Admin" />
      <div className="max-w-2xl mx-auto p-4 md:p-6">

        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => router.push("/inventory")}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12.5 15L7.5 10L12.5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-800">
            {t("addProduct.title")}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* รูปสินค้า */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <h2 className="text-sm font-bold text-gray-600">
              {t("addProduct.photoSection")}
            </h2>

            {photoPreview ? (
              <div className="relative w-32 h-32">
                <img
                  src={photoPreview}
                  alt={t("addProduct.photoPreviewAlt")}
                  className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute -top-2 -right-2 bg-gray-900 hover:bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow transition"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4L12 12M12 4L4 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-32 h-32 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-400 transition text-gray-400 text-xs gap-1.5">
                <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 7h3l2-2h6l2 2h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                <span className="font-medium">{t("addProduct.addPhoto")}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            )}
            {errors.photo && (
              <p className="text-red-500 text-xs">{t(errors.photo.key, errors.photo.vars)}</p>
            )}
          </div>

          {/* ข้อมูลทั่วไป */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <h2 className="text-sm font-bold text-gray-600">
              {t("addProduct.generalInfoSection")}
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("addProduct.nameLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder={t("addProduct.namePlaceholder")}
                className={inputClass}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{t(errors.name.key, errors.name.vars)}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("addProduct.barcodeLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                name="barcode"
                value={form.barcode}
                onChange={handleChange}
                placeholder={t("addProduct.barcodePlaceholder")}
                className={`${inputClass} font-mono`}
              />
              {errors.barcode && (
                <p className="text-red-500 text-xs mt-1">{t(errors.barcode.key, errors.barcode.vars)}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("addProduct.categoryLabel")} <span className="text-red-500">*</span>
              </label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                disabled={loadingCategories}
                className={`${inputClass} bg-white`}
              >
                <option value="">
                  {loadingCategories ? t("common.loading") : t("addProduct.selectCategory")}
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.shelf_life_days != null
                      ? t("addProduct.categoryShelfLife", {
                          name: cat.name,
                          days: cat.shelf_life_days,
                        })
                      : cat.name}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-red-500 text-xs mt-1">{t(errors.category.key, errors.category.vars)}</p>
              )}
              {categories.length === 0 && !loadingCategories && (
                <p className="text-xs text-amber-600 mt-1">
                  {t("addProduct.noCategoriesHint")}
                </p>
              )}
            </div>
          </div>

          {/* ราคา */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <h2 className="text-sm font-bold text-gray-600">
              {t("addProduct.pricingSection")}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("addProduct.priceLabel")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  name="price"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  step="any"
                  className={`${inputClass} tabular-nums`}
                />
                {errors.price && (
                  <p className="text-red-500 text-xs mt-1">{t(errors.price.key, errors.price.vars)}</p>
                )}
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("addProduct.costLabel")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  name="cost"
                  value={form.cost}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  step="any"
                  className={`${inputClass} tabular-nums`}
                />
                {errors.cost && (
                  <p className="text-red-500 text-xs mt-1">{t(errors.cost.key, errors.cost.vars)}</p>
                )}
              </div>
            </div>

            {Number(form.price) > 0 && form.cost && (
              <div className="bg-green-50 rounded-lg px-4 py-2 text-sm tabular-nums">
                <span className="text-green-700 font-medium">
                  {t("addProduct.estProfit", {
                    amount: (Number(form.price) - Number(form.cost)).toFixed(2),
                  })}
                </span>
                <span className="text-green-600 ml-2">
                  ({(((Number(form.price) - Number(form.cost)) / Number(form.price)) * 100).toFixed(1)}%)
                </span>
              </div>
            )}
          </div>

          {/* Stock */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <h2 className="text-sm font-bold text-gray-600">
              {t("addProduct.initialStockSection")}
            </h2>
            <p className="text-xs text-gray-400 -mt-2">
              {t("addProduct.initialStockHint")}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("addProduct.initialStockLabel")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  name="stock"
                  value={form.stock}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  className={`${inputClass} tabular-nums`}
                />
                {errors.stock && (
                  <p className="text-red-500 text-xs mt-1">{t(errors.stock.key, errors.stock.vars)}</p>
                )}
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("addProduct.minStockLabel")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  name="minStock"
                  value={form.minStock}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  className={`${inputClass} tabular-nums`}
                />
                {errors.minStock && (
                  <p className="text-red-500 text-xs mt-1">{t(errors.minStock.key, errors.minStock.vars)}</p>
                )}
              </div>
            </div>
          </div>

          {/* วันหมดอายุ */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="text-sm font-bold text-gray-600 mb-1">
              {t("addProduct.expDateSection")}
            </h2>
            {selectedCategory?.shelf_life_days != null ? (
              <p className="text-xs text-gray-400 mb-3">
                {t("addProduct.autoExpiryHint", {
                  category: selectedCategory.name,
                  days: selectedCategory.shelf_life_days,
                })}
              </p>
            ) : (
              <p className="text-xs text-gray-400 mb-3">
                {t("addProduct.noShelfLifeHint")}
              </p>
            )}
            <input
              type="date"
              name="expDate"
              value={form.expDate}
              onChange={handleChange}
              className={`${inputClass} tabular-nums`}
            />
            {errors.expDate && (
              <p className="text-red-500 text-xs mt-1">{t(errors.expDate.key, errors.expDate.vars)}</p>
            )}
          </div>

          {/* ปุ่ม */}
          <div className="flex gap-3 pb-6">
            <button
              type="button"
              onClick={() => router.push("/inventory")}
              className="flex-1 border border-gray-300 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
            >
              {uploading ? t("addProduct.uploading") : t("addProduct.saveProduct")}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}