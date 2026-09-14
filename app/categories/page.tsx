"use client";
import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";

interface Category {
  id: string;
  name: string;
  shelf_life_days: number | null;
  discount_percent: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newDays, setNewDays] = useState("");
  const [newDiscount, setNewDiscount] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const fetchCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      setError("โหลดหมวดหมู่ไม่สำเร็จ / Failed to load categories: " + error.message);
    } else {
      setCategories(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const updateShelfLife = async (id: string, value: string) => {
    setSavingId(id);
    const days = value.trim() === "" ? null : Number(value);

    const { error } = await supabase
      .from("categories")
      .update({ shelf_life_days: days })
      .eq("id", id);

    setSavingId(null);

    if (error) {
      alert("บันทึกไม่สำเร็จ / Failed to save: " + error.message);
      return;
    }

    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, shelf_life_days: days } : c))
    );
  };

  const updateDiscountPercent = async (id: string, value: string) => {
    setSavingId(id);
    const percent = value.trim() === "" ? 0 : Number(value);

    if (isNaN(percent) || percent < 0 || percent > 100) {
      setSavingId(null);
      alert("กรุณากรอกเปอร์เซ็นต์ระหว่าง 0-100 / Please enter a percentage between 0-100");
      return;
    }

    const { error } = await supabase
      .from("categories")
      .update({ discount_percent: percent })
      .eq("id", id);

    setSavingId(null);

    if (error) {
      alert("บันทึกไม่สำเร็จ / Failed to save: " + error.message);
      return;
    }

    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, discount_percent: percent } : c))
    );
  };

  const handleAddCategory = async () => {
    setError("");
    if (!newName.trim()) {
      setError("กรุณากรอกชื่อหมวดหมู่ / Please enter a category name");
      return;
    }

    const discountValue = newDiscount.trim() === "" ? 0 : Number(newDiscount);
    if (isNaN(discountValue) || discountValue < 0 || discountValue > 100) {
      setError("กรุณากรอกเปอร์เซ็นต์ลดราคาระหว่าง 0-100 / Discount % must be between 0-100");
      return;
    }

    setAdding(true);
    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: newName.trim(),
        shelf_life_days: newDays.trim() === "" ? null : Number(newDays),
        discount_percent: discountValue,
      })
      .select()
      .single();

    setAdding(false);

    if (error) {
      setError("เพิ่มหมวดหมู่ไม่สำเร็จ / Failed to add: " + error.message);
      return;
    }

    setCategories((prev) =>
      [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
    );
    setNewName("");
    setNewDays("");
    setNewDiscount("");
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`ลบหมวดหมู่ "${name}"? / Delete category "${name}"?`)) return;

    const { error } = await supabase.from("categories").delete().eq("id", id);

    if (error) {
      alert(
        "ลบไม่สำเร็จ (อาจมีสินค้าใช้หมวดหมู่นี้อยู่) / Failed to delete (products may still reference it): " +
          error.message
      );
      return;
    }

    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar role="Admin" />
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">
          จัดการหมวดหมู่ <span className="text-gray-400 font-normal text-lg">(Categories)</span>
        </h1>
        <p className="text-sm text-gray-400 mb-6">
          กำหนด "อายุสินค้า (วัน)" และ "% ลดราคาเมื่อใกล้หมดอายุ" ต่อหมวดหมู่ — ระบบใช้ค่าเหล่านี้คำนวณวันหมดอายุอัตโนมัติตอนรับสินค้า และคำนวณราคาลดอัตโนมัติเมื่อสินค้าใกล้หมดอายุ /
          Set a shelf-life (days) and discount % per category — used to auto-calculate expiry dates when restocking, and auto-calculate discounted prices when a batch is expiring soon.
        </p>

        {/* เพิ่มหมวดหมู่ใหม่ */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 space-y-3">
          <h2 className="text-sm font-bold text-gray-600">เพิ่มหมวดหมู่ใหม่ / Add Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_100px_auto] gap-3">
            <input
              type="text"
              placeholder="ชื่อหมวดหมู่ / Category name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <input
              type="number"
              placeholder="อายุ (วัน)"
              min="0"
              value={newDays}
              onChange={(e) => setNewDays(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <input
              type="number"
              placeholder="ลด %"
              min="0"
              max="100"
              value={newDiscount}
              onChange={(e) => setNewDiscount(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <button
              onClick={handleAddCategory}
              disabled={adding}
              className="bg-blue-600 text-white font-bold px-5 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 whitespace-nowrap"
            >
              {adding ? "กำลังเพิ่ม..." : "+ เพิ่ม"}
            </button>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <p className="text-xs text-gray-400">
            เว้นว่างช่องอายุ = ไม่คำนวณวันหมดอายุอัตโนมัติ (พนักงานเลือกวันเอง) · เว้นว่างช่องลด % = ไม่มีส่วนลดอัตโนมัติสำหรับหมวดหมู่นี้ /
            Leave shelf-life blank to skip auto-expiry calculation · leave discount blank for no automatic discount on this category.
          </p>
        </div>

        {/* รายการหมวดหมู่ */}
        {loading ? (
          <p className="text-center text-gray-400 py-10">กำลังโหลด... / Loading...</p>
        ) : categories.length === 0 ? (
          <p className="text-center text-gray-400 py-10">ยังไม่มีหมวดหมู่ / No categories yet</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 divide-y">
            {/* Header row for clarity on desktop */}
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-gray-50 text-xs font-bold text-gray-400 uppercase">
              <span className="flex-1">หมวดหมู่ / Category</span>
              <span className="w-28 text-right">อายุ (วัน) / Shelf life</span>
              <span className="w-24 text-right">ลด % / Discount</span>
              <span className="w-10"></span>
            </div>

            {categories.map((cat) => (
              <div key={cat.id} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 p-4">
                <span className="flex-1 font-medium text-gray-800 text-sm">{cat.name}</span>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400 md:hidden">อายุ (วัน):</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="ไม่กำหนด"
                    defaultValue={cat.shelf_life_days ?? ""}
                    onBlur={(e) => updateShelfLife(cat.id, e.target.value)}
                    className="w-24 md:w-28 px-3 py-1.5 border rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <span className="text-xs text-gray-400 md:hidden">วัน</span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400 md:hidden">ลด %:</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={cat.discount_percent ?? 0}
                    onBlur={(e) => updateDiscountPercent(cat.id, e.target.value)}
                    className="w-20 md:w-24 px-3 py-1.5 border rounded-lg text-sm text-right focus:ring-2 focus:ring-pink-400 outline-none"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-2 md:w-10">
                  {savingId === cat.id && (
                    <span className="text-xs text-blue-500 whitespace-nowrap">บันทึก...</span>
                  )}
                  <button
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    className="text-gray-300 hover:text-red-500 text-sm px-2"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}