"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "../../../components/Navbar";
import { supabase } from "../../../lib/supabase";
import { useI18n } from "../../../lib/i18n";
import { TKey } from "../../../lib/dictionaries";

interface Category {
  id: string;
  name: string;
  shelf_life_days: number | null;
}

type FieldError = {
  key: TKey;
  vars?: Record<string, string | number>;
};

export default function EditProductPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    barcode: "",
    price: "",
    cost: "",
    minStock: "",
    category: "",
  });

  const [errors, setErrors] = useState<Record<string, FieldError | undefined>>({});

  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

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

  useEffect(() => {
    const fetchProduct = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, barcode, price, cost, min_stock, category, photo_url")
        .eq("id", id)
        .single();

      if (error || !data) {
        alert(t("editProduct.notFound"));
        router.push("/inventory");
        return;
      }

      setForm({
        name: data.name ?? "",
        barcode: data.barcode ?? "",
        price: String(data.price ?? ""),
        cost: String(data.cost ?? ""),
        minStock: String(data.min_stock ?? ""),
        category: data.category ?? "",
      });

      setExistingPhotoUrl(data.photo_url ?? null);
      setPhotoPreview(data.photo_url ?? null);

      setLoading(false);
    };

    fetchProduct();
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrors({ ...errors, photo: { key: "editProduct.errPhotoType" } });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors({ ...errors, photo: { key: "editProduct.errPhotoSize" } });
      return;
    }

    setErrors({ ...errors, photo: undefined });
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoRemoved(false);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoRemoved(true);
  };

  const validate = () => {
    const newErrors: Record<string, FieldError> = {};
    if (!form.name) newErrors.name = { key: "editProduct.errNameRequired" };
    if (!form.barcode) newErrors.barcode = { key: "editProduct.errBarcodeRequired" };
    if (!form.price || isNaN(Number(form.price)))
      newErrors.price = { key: "editProduct.errPriceInvalid" };
    if (!form.cost || isNaN(Number(form.cost)))
      newErrors.cost = { key: "editProduct.errCostInvalid" };
    if (!form.minStock || isNaN(Number(form.minStock)))
      newErrors.minStock = { key: "editProduct.errMinStockInvalid" };
    if (!form.category) newErrors.category = { key: "editProduct.errCategoryRequired" };
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);

    let photoUrl: string | null = existingPhotoUrl;

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
        setSaving(false);
        alert(t("editProduct.uploadFailed", { message: uploadError.message }));
        return;
      }

      const { data: urlData } = supabase.storage
        .from("product-photos")
        .getPublicUrl(fileName);

      photoUrl = urlData.publicUrl;
    } else if (photoRemoved) {
      photoUrl = null;
    }

    const { error } = await supabase
      .from("products")
      .update({
        name: form.name,
        barcode: form.barcode,
        price: Number(form.price),
        cost: Number(form.cost),
        min_stock: Number(form.minStock),
        category: form.category,
        photo_url: photoUrl,
      })
      .eq("id", id);

    setSaving(false);

    if (error) {
      alert(t("editProduct.saveError", { message: error.message }));
      return;
    }

    alert(t("editProduct.updateSuccess", { name: form.name }));
    router.push("/inventory");
  };

  // Shared input style: full-width, 16px text on mobile (prevents iOS
  // auto-zoom), taller touch target on mobile, compact on larger screens.
  const inputClass =
    "w-full min-w-0 px-4 py-3 sm:py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base sm:text-sm";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar role="Admin" />
        <div className="text-center py-20 text-gray-400">
          {t("editProduct.loadingData")}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar role="Admin" />
      <div className="max-w-2xl mx-auto p-4 md:p-6">

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/inventory")}
            className="text-gray-400 hover:text-gray-600 transition text-xl"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-800">
            {t("editProduct.title")}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <h2 className="text-sm font-bold text-gray-600">
              {t("editProduct.photoSection")}
            </h2>

            {photoPreview ? (
              <div className="relative w-32 h-32">
                <img
                  src={photoPreview}
                  alt={t("editProduct.photoPreviewAlt")}
                  className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center shadow"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition text-gray-400 text-xs gap-1">
                <span className="text-2xl">📷</span>
                <span>{t("editProduct.addPhoto")}</span>
                <input
                  type="file"
                  accept="image/*"
                  // capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            )}
            {errors.photo && (
              <p className="text-red-500 text-xs">{t(errors.photo.key, errors.photo.vars)}</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <h2 className="text-sm font-bold text-gray-600">
              {t("editProduct.generalInfoSection")}
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("editProduct.nameLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className={inputClass}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{t(errors.name.key, errors.name.vars)}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("editProduct.barcodeLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                name="barcode"
                value={form.barcode}
                onChange={handleChange}
                className={inputClass}
              />
              {errors.barcode && (
                <p className="text-red-500 text-xs mt-1">{t(errors.barcode.key, errors.barcode.vars)}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("editProduct.categoryLabel")} <span className="text-red-500">*</span>
              </label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                disabled={loadingCategories}
                className={`${inputClass} bg-white`}
              >
                <option value="">
                  {loadingCategories ? t("common.loading") : t("editProduct.selectCategory")}
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.shelf_life_days != null
                      ? t("editProduct.categoryShelfLife", {
                          name: cat.name,
                          days: cat.shelf_life_days,
                        })
                      : cat.name}
                  </option>
                ))}
                {/* keep the product's current category selectable even if it
                    was later deleted/renamed in the categories table */}
                {form.category && !categories.some((c) => c.name === form.category) && (
                  <option value={form.category}>
                    {t("editProduct.categoryNotFound", { name: form.category })}
                  </option>
                )}
              </select>
              {errors.category && (
                <p className="text-red-500 text-xs mt-1">{t(errors.category.key, errors.category.vars)}</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <h2 className="text-sm font-bold text-gray-600">
              {t("editProduct.pricingSection")}
            </h2>

            {/* 1 คอลัมน์บนมือถือ, 2 คอลัมน์ตั้งแต่ sm ขึ้นไป */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("editProduct.priceLabel")} <span className="text-red-500">*</span>
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
                  className={inputClass}
                />
                {errors.price && (
                  <p className="text-red-500 text-xs mt-1">{t(errors.price.key, errors.price.vars)}</p>
                )}
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("editProduct.costLabel")} <span className="text-red-500">*</span>
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
                  className={inputClass}
                />
                {errors.cost && (
                  <p className="text-red-500 text-xs mt-1">{t(errors.cost.key, errors.cost.vars)}</p>
                )}
              </div>
            </div>

            {Number(form.price) > 0 && form.cost && (
              <div className="bg-green-50 rounded-lg px-4 py-2 text-sm">
                <span className="text-green-700 font-medium">
                  {t("editProduct.estProfit", {
                    amount: (Number(form.price) - Number(form.cost)).toFixed(2),
                  })}
                </span>
                <span className="text-green-500 ml-2">
                  ({(((Number(form.price) - Number(form.cost)) / Number(form.price)) * 100).toFixed(1)}%)
                </span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <h2 className="text-sm font-bold text-gray-600">
              {t("editProduct.minStockSection")}
            </h2>
            <p className="text-xs text-gray-400 -mt-2">
              {t("editProduct.minStockHint")}
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("editProduct.minStockLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                name="minStock"
                value={form.minStock}
                onChange={handleChange}
                placeholder="0"
                min="0"
                className={inputClass}
              />
              {errors.minStock && (
                <p className="text-red-500 text-xs mt-1">{t(errors.minStock.key, errors.minStock.vars)}</p>
              )}
            </div>
          </div>

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
              disabled={saving}
              className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving || uploading ? t("editProduct.saving") : t("editProduct.saveChanges")}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}