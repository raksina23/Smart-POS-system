"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "../../../components/Navbar";
import { supabase } from "../../../lib/supabase";

export default function EditProductPage() {
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

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchProduct = async () => {
      // Note: stock_qty / expiration_date are no longer read here — they
      // live on stock_batches now and are managed via Restock, not Edit.
      const { data, error } = await supabase
        .from("products")
        .select("id, name, barcode, price, cost, min_stock, category")
        .eq("id", id)
        .single();

      if (error || !data) {
        alert("ไม่พบสินค้า / Product not found");
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

      setLoading(false);
    };

    fetchProduct();
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name) newErrors.name = "กรุณากรอกชื่อสินค้า / Please enter product name";
    if (!form.barcode) newErrors.barcode = "กรุณากรอกบาร์โค้ด / Please enter barcode";
    if (!form.price || isNaN(Number(form.price)))
      newErrors.price = "กรุณากรอกราคาขายให้ถูกต้อง / Invalid selling price";
    if (!form.cost || isNaN(Number(form.cost)))
      newErrors.cost = "กรุณากรอกราคาทุนให้ถูกต้อง / Invalid cost price";
    if (!form.minStock || isNaN(Number(form.minStock)))
      newErrors.minStock = "กรุณากรอกจำนวนขั้นต่ำให้ถูกต้อง / Invalid minimum stock";
    if (!form.category) newErrors.category = "กรุณาเลือกหมวดหมู่ / Please select category";
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

    // stock_qty / expiration_date are intentionally NOT updated here —
    // changing quantity or expiry now happens through Restock on the
    // inventory page, which creates/adjusts stock_batches rows instead.
    const { error } = await supabase
      .from("products")
      .update({
        name: form.name,
        barcode: form.barcode,
        price: Number(form.price),
        cost: Number(form.cost),
        min_stock: Number(form.minStock),
        category: form.category,
      })
      .eq("id", id);

    setSaving(false);

    if (error) {
      alert("เกิดข้อผิดพลาด / Error: " + error.message);
      return;
    }

    alert(`แก้ไขสินค้า "${form.name}" สำเร็จ! / Product updated successfully!`);
    router.push("/inventory");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar role="Admin" />
        <div className="text-center py-20 text-gray-400">
          กำลังโหลดข้อมูล... / Loading...
        </div>
      </div>
    );
  }

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
            แก้ไขสินค้า <span className="text-gray-400 font-normal text-lg">(Edit Product)</span>
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ข้อมูลทั่วไป */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <h2 className="text-sm font-bold text-gray-600">ข้อมูลทั่วไป / General Info</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อสินค้า / Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
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

          {/* จำนวนขั้นต่ำ — stock quantity itself is no longer editable here */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <h2 className="text-sm font-bold text-gray-600">จำนวนขั้นต่ำ / Minimum Stock</h2>
            <p className="text-xs text-gray-400 -mt-2">
              จำนวนสต็อกปัจจุบันจัดการผ่านปุ่ม "รับสินค้า" ในหน้าคลังสินค้า /
              Current stock quantity is managed via the "Restock" button on the inventory page.
            </p>

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
              disabled={saving}
              className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก... / Saving..." : "บันทึกการแก้ไข / Save Changes"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}