"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabase";

export default function AddProductPage() {
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

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrors({ ...errors, photo: "กรุณาเลือกไฟล์รูปภาพ / Please select an image file" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors({ ...errors, photo: "ขนาดไฟล์ต้องไม่เกิน 5MB / File must be under 5MB" });
      return;
    }

    setErrors({ ...errors, photo: "" });
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name) newErrors.name = "กรุณากรอกชื่อสินค้า / Please enter product name";
    if (!form.barcode) newErrors.barcode = "กรุณากรอกบาร์โค้ด / Please enter barcode";
    if (!form.price || isNaN(Number(form.price)))
      newErrors.price = "กรุณากรอกราคาขายให้ถูกต้อง / Invalid selling price";
    if (!form.cost || isNaN(Number(form.cost)))
      newErrors.cost = "กรุณากรอกราคาทุนให้ถูกต้อง / Invalid cost price";
    if (!form.stock || isNaN(Number(form.stock)))
      newErrors.stock = "กรุณากรอกจำนวน stock ให้ถูกต้อง / Invalid stock quantity";
    if (!form.minStock || isNaN(Number(form.minStock)))
      newErrors.minStock = "กรุณากรอกจำนวนขั้นต่ำให้ถูกต้อง / Invalid minimum stock";
    if (!form.category) newErrors.category = "กรุณาเลือกหมวดหมู่ / Please select category";
    if (!form.expDate) newErrors.expDate = "กรุณาเลือกวันหมดอายุ / Please select expiry date";
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

    // Upload photo first, if one was selected
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
        alert("อัปโหลดรูปไม่สำเร็จ / Photo upload failed: " + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("product-photos")
        .getPublicUrl(fileName);

      photoUrl = urlData.publicUrl;
    }

    // 1. Create the product itself — no stock_qty / expiration_date anymore,
    // those live on stock_batches now. .select().single() gets back the
    // new row (including its generated id) so we can attach a batch to it.
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
      alert("เกิดข้อผิดพลาด / Error: " + productError?.message);
      return;
    }

    // 2. Create its first stock batch, using the quantity/expiry the user
    // entered above. Every future shipment adds another batch via Restock
    // on the inventory page instead of coming back here.
    const { error: batchError } = await supabase.from("stock_batches").insert({
      product_id: newProduct.id,
      quantity: Number(form.stock),
      expiration_date: form.expDate,
    });

    if (batchError) {
      alert(
        "บันทึกสินค้าแล้ว แต่เพิ่มสต็อกเริ่มต้นไม่สำเร็จ / Product saved, but adding initial stock failed: " +
          batchError.message
      );
      router.push("/inventory");
      return;
    }

    alert(`บันทึกสินค้า "${form.name}" สำเร็จ! / Product saved successfully!`);
    router.push("/inventory");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar role="Admin" />
      <div className="max-w-2xl mx-auto p-4 md:p-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/inventory")}
            className="text-gray-400 hover:text-gray-600 transition text-xl"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-800">
            เพิ่มสินค้าใหม่ <span className="text-gray-400 font-normal text-lg">(Add Product)</span>
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* รูปสินค้า */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <h2 className="text-sm font-bold text-gray-600">
              รูปสินค้า / Product Photo
            </h2>

            {photoPreview ? (
              <div className="relative w-32 h-32">
                <img
                  src={photoPreview}
                  alt="Preview"
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
                <span>เพิ่มรูป / Add Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            )}
            {errors.photo && <p className="text-red-500 text-xs">{errors.photo}</p>}
          </div>

          {/* ข้อมูลทั่วไป */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <h2 className="text-sm font-bold text-gray-600">
              ข้อมูลทั่วไป / General Info
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อสินค้า / Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="เช่น / e.g. น้ำเปล่าตราสิงห์ 600ml"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                บาร์โค้ด / Barcode <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="barcode"
                value={form.barcode}
                onChange={handleChange}
                placeholder="เช่น / e.g. 8850999000033"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
              {errors.barcode && <p className="text-red-500 text-xs mt-1">{errors.barcode}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                หมวดหมู่ / Category <span className="text-red-500">*</span>
              </label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
              >
                <option value="">เลือกหมวดหมู่ / Select category</option>
                <option value="เครื่องดื่ม">เครื่องดื่ม (Beverages)</option>
                <option value="เครื่องปรุง">เครื่องปรุง (Condiments)</option>
                <option value="ขนม">ขนม (Snacks)</option>
                <option value="เบ็ดเตล็ด">เบ็ดเตล็ด (Miscellaneous)</option>
                <option value="เครื่องสำอาง">เครื่องสำอาง (Cosmetics)</option>
                <option value="ลูกอม">ลูกอม (Candy)</option>
              </select>
              {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
            </div>
          </div>

          {/* ราคา */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <h2 className="text-sm font-bold text-gray-600">ราคา / Pricing</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ราคาขาย / Selling Price (฿) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="price"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
                {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ราคาทุน / Cost Price (฿) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="cost"
                  value={form.cost}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
                {errors.cost && <p className="text-red-500 text-xs mt-1">{errors.cost}</p>}
              </div>
            </div>

            {form.price && form.cost && (
              <div className="bg-green-50 rounded-lg px-4 py-2 text-sm">
                <span className="text-green-700 font-medium">
                  กำไรโดยประมาณ / Est. Profit: ฿{(Number(form.price) - Number(form.cost)).toFixed(2)}
                </span>
                <span className="text-green-500 ml-2">
                  ({(((Number(form.price) - Number(form.cost)) / Number(form.price)) * 100).toFixed(1)}%)
                </span>
              </div>
            )}
          </div>

          {/* Stock — this becomes the product's FIRST batch, not a product field */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <h2 className="text-sm font-bold text-gray-600">
              สต็อกเริ่มต้น / Initial Stock Batch
            </h2>
            <p className="text-xs text-gray-400 -mt-2">
              การรับสินค้าครั้งต่อไปให้ใช้ปุ่ม "รับสินค้า" ในหน้าคลังสินค้า /
              Future shipments are added via the "Restock" button on the inventory page, not here.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  จำนวนเริ่มต้น / Initial Stock <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="stock"
                  value={form.stock}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
                {errors.stock && <p className="text-red-500 text-xs mt-1">{errors.stock}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  จำนวนขั้นต่ำ / Minimum Stock <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="minStock"
                  value={form.minStock}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
                {errors.minStock && <p className="text-red-500 text-xs mt-1">{errors.minStock}</p>}
              </div>
            </div>
          </div>

          {/* วันหมดอายุ ของล็อตเริ่มต้น */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="text-sm font-bold text-gray-600 mb-3">
              วันหมดอายุของล็อตนี้ / This Batch's Expiry Date
            </h2>
            <input
              type="date"
              name="expDate"
              value={form.expDate}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            {errors.expDate && <p className="text-red-500 text-xs mt-1">{errors.expDate}</p>}
          </div>

          {/* ปุ่ม */}
          <div className="flex gap-3 pb-6">
            <button
              type="button"
              onClick={() => router.push("/inventory")}
              className="flex-1 border border-gray-300 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition"
            >
              ยกเลิก / Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
            >
              {uploading ? "กำลังอัปโหลดรูป... / Uploading..." : "บันทึกสินค้า / Save Product"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}