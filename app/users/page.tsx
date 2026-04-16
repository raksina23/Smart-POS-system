"use client";
import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";

interface User {
  id: string;
  email: string;
  role: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", role: "cashier" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, role")
      .order("role");

    if (error) {
      console.error("Error fetching users:", error.message);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.email) newErrors.email = "กรุณากรอก Email";
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = "Email ไม่ถูกต้อง";
    if (!form.password) newErrors.password = "กรุณากรอก Password";
    else if (form.password.length < 6) newErrors.password = "Password ต้องมีอย่างน้อย 6 ตัวอักษร";
    return newErrors;
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = await res.json();

      if (!res.ok) {
        alert("เกิดข้อผิดพลาด: " + result.error);
        setSaving(false);
        return;
      }

      alert(`เพิ่มผู้ใช้ "${form.email}" สำเร็จ!`);
      setForm({ email: "", password: "", role: "cashier" });
      setErrors({});
      setShowForm(false);
      fetchUsers();
    } catch {
      alert("เกิดข้อผิดพลาดที่ไม่คาดคิด");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`ต้องการลบผู้ใช้ "${email}" หรือไม่?`)) return;

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id);

    if (error) {
      alert("เกิดข้อผิดพลาด: " + error.message);
      return;
    }

    fetchUsers();
  };

  const handleChangeRole = async (id: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "cashier" : "admin";
    if (!confirm(`เปลี่ยน role เป็น "${newRole}" หรือไม่?`)) return;

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", id);

    if (error) {
      alert("เกิดข้อผิดพลาด: " + error.message);
      return;
    }

    fetchUsers();
  };

  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 font-sans">
      <Navbar role="admin" />
      <div className="max-w-4xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold text-gray-800">
            จัดการผู้ใช้งาน (Users)
          </h1>
          <div className="flex items-center gap-3">
            <span className="bg-gray-100 text-gray-600 text-sm px-3 py-1.5 rounded-lg font-medium">
              ทั้งหมด {users.length} คน
            </span>
            <button
              onClick={() => { setShowForm(!showForm); setErrors({}); setShowPassword(false); }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition"
            >
              {showForm ? "✕ ยกเลิก" : "+ เพิ่มผู้ใช้"}
            </button>
          </div>
        </div>

        {/* ฟอร์มเพิ่มผู้ใช้ */}
        {showForm && (
          <div className="bg-white rounded-xl border border-blue-100 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-gray-700 mb-4">เพิ่มผู้ใช้ใหม่</h2>
            <form onSubmit={handleAddUser} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="example@email.com"
                    value={form.email}
                    onChange={(e) => {
                      setForm({ ...form, email: e.target.value });
                      setErrors({ ...errors, email: "" });
                    }}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                      value={form.password}
                      onChange={(e) => {
                        setForm({ ...form, password: e.target.value });
                        setErrors({ ...errors, password: "" });
                      }}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm pr-16"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-medium"
                    >
                      {showPassword ? "ซ่อน" : "แสดง"}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full md:w-48 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                >
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setErrors({}); setShowPassword(false); }}
                  className="border border-gray-300 text-gray-600 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        )}

        {/* User List */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-20 text-gray-400">ไม่พบข้อมูลผู้ใช้</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {users.map((user) => {
                const isOnlyAdmin = user.role === "admin" && adminCount <= 1;
                const avatarLetter = (user.email ?? "?").charAt(0).toUpperCase();

                return (
                  <div
                    key={user.id}
                    className="p-4 flex justify-between items-center hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        user.role === "admin"
                          ? "bg-blue-100 text-blue-600"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {avatarLetter}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{user.email}</p>
                        <p className="text-xs text-gray-400 font-mono">
                          {user.id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                        user.role === "admin"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {user.role === "admin" ? "Admin" : "Cashier"}
                      </span>

                      <button
                        onClick={() => handleChangeRole(user.id, user.role)}
                        disabled={isOnlyAdmin}
                        className={`text-xs px-3 py-1 rounded-lg border transition ${
                          isOnlyAdmin
                            ? "text-gray-300 border-gray-100 cursor-not-allowed"
                            : "text-blue-500 border-blue-200 hover:bg-blue-50"
                        }`}
                      >
                        เปลี่ยน Role
                      </button>

                      <button
                        onClick={() => handleDelete(user.id, user.email)}
                        disabled={isOnlyAdmin}
                        className={`text-xs px-3 py-1 rounded-lg border transition ${
                          isOnlyAdmin
                            ? "text-gray-300 border-gray-100 cursor-not-allowed"
                            : "text-red-500 border-red-200 hover:bg-red-50"
                        }`}
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          หมายเหตุ: ไม่สามารถลบหรือเปลี่ยน Role ของ Admin คนสุดท้ายได้
        </p>
      </div>
    </div>
  );
}