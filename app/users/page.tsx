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
    if (!form.email) newErrors.email = "กรุณากรอก Email / Please enter an email";
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = "Email ไม่ถูกต้อง / Invalid email";
    if (!form.password) newErrors.password = "กรุณากรอก Password / Please enter a password";
    else if (form.password.length < 6) newErrors.password = "Password ต้องมีอย่างน้อย 6 ตัวอักษร / Password must be at least 6 characters";
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
        // Contains a variable (server error message) — translate the
        // prefix only, don't duplicate the variable itself.
        alert("เกิดข้อผิดพลาด / Error: " + result.error);
        setSaving(false);
        return;
      }

      // Contains a variable (email) — single-language for readability.
      alert(`เพิ่มผู้ใช้ "${form.email}" สำเร็จ!`);
      setForm({ email: "", password: "", role: "cashier" });
      setErrors({});
      setShowForm(false);
      fetchUsers();
    } catch {
      alert("เกิดข้อผิดพลาดที่ไม่คาดคิด / An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    // Contains a variable (email) — single-language.
    if (!confirm(`ต้องการลบผู้ใช้ "${email}" หรือไม่?`)) return;

    const { error } = await supabase.from("profiles").delete().eq("id", id);

    if (error) {
      alert("เกิดข้อผิดพลาด / Error: " + error.message);
      return;
    }
    fetchUsers();
  };

  const handleChangeRole = async (id: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "cashier" : "admin";
    // Contains a variable (newRole) — single-language.
    if (!confirm(`เปลี่ยน role เป็น "${newRole}" หรือไม่?`)) return;

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", id);

    if (error) {
      alert("เกิดข้อผิดพลาด / Error: " + error.message);
      return;
    }
    fetchUsers();
  };

  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar role="admin" />

      <div className="max-w-2xl mx-auto px-3 py-4 sm:px-6 sm:py-6 space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">
              จัดการผู้ใช้งาน
            </h1>
            <p className="text-sm text-gray-400">User Management</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-gray-100 text-gray-500 text-xs px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap">
              {users.length} คน / {users.length} users
            </span>
            <button
              onClick={() => { setShowForm(!showForm); setErrors({}); setShowPassword(false); }}
              className="bg-blue-600 text-white px-3.5 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-700 transition whitespace-nowrap"
            >
              {showForm ? "✕ ยกเลิก / Cancel" : "+ เพิ่มผู้ใช้ / Add User"}
            </button>
          </div>
        </div>

        {/* Add User Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-blue-100 p-4 sm:p-5 shadow-sm">
            <h2 className="text-sm font-bold text-gray-700 mb-4">
              👤 เพิ่มผู้ใช้ใหม่ / Add New User
            </h2>
            <form onSubmit={handleAddUser} className="space-y-3">
              {/* Email */}
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
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="อย่างน้อย 6 ตัวอักษร / At least 6 characters"
                    value={form.password}
                    onChange={(e) => {
                      setForm({ ...form, password: e.target.value });
                      setErrors({ ...errors, password: "" });
                    }}
                    className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-medium"
                  >
                    {showPassword ? "ซ่อน / Hide" : "แสดง / Show"}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                )}
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full sm:w-48 px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                >
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 sm:flex-none bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก... / Saving..." : "💾 บันทึก / Save"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setErrors({}); setShowPassword(false); }}
                  className="flex-1 sm:flex-none border border-gray-300 text-gray-600 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                >
                  ยกเลิก / Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* User List */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            <div className="text-3xl mb-2">⏳</div>
            กำลังโหลดข้อมูล... / Loading...
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            <div className="text-3xl mb-2">👤</div>
            ไม่พบข้อมูลผู้ใช้ / No users found
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {users.map((user) => {
                const isOnlyAdmin = user.role === "admin" && adminCount <= 1;
                const avatarLetter = (user.email ?? "?").charAt(0).toUpperCase();

                return (
                  <div key={user.id} className="p-4 hover:bg-gray-50 transition">

                    {/* Row 1: Avatar + Email + Role badge */}
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm ${
                        user.role === "admin"
                          ? "bg-blue-100 text-blue-600"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {avatarLetter}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-800 text-sm truncate">
                            {user.email}
                          </p>
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full flex-shrink-0 ${
                            user.role === "admin"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          }`}>
                            {user.role === "admin" ? "Admin" : "Cashier"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">
                          ID: {user.id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>

                    {/* Row 2: Action buttons */}
                    <div className="flex gap-2 mt-3 pl-13">
                      <button
                        onClick={() => handleChangeRole(user.id, user.role)}
                        disabled={isOnlyAdmin}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium border transition ${
                          isOnlyAdmin
                            ? "text-gray-300 border-gray-100 cursor-not-allowed bg-gray-50"
                            : "text-blue-500 border-blue-200 hover:bg-blue-50 active:bg-blue-100"
                        }`}
                      >
                        เปลี่ยน Role / Change Role
                      </button>
                      <button
                        onClick={() => handleDelete(user.id, user.email)}
                        disabled={isOnlyAdmin}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium border transition ${
                          isOnlyAdmin
                            ? "text-gray-300 border-gray-100 cursor-not-allowed bg-gray-50"
                            : "text-red-500 border-red-200 hover:bg-red-50 active:bg-red-100"
                        }`}
                      >
                        🗑️ ลบผู้ใช้ / Delete User
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center pb-4">
          ⚠️ ไม่สามารถลบหรือเปลี่ยน Role ของ Admin คนสุดท้ายได้ / Cannot delete or change the role of the last remaining Admin
        </p>
      </div>
    </div>
  );
}