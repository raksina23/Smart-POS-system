"use client";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

export default function Navbar({ role }: { role: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const adminLinks = [
    { label: "Dashboard", path: "/dashboard", icon: "📊" },
    { label: "Inventory", path: "/inventory", icon: "📦" },
    { label: "POS", path: "/pos", icon: "🛒" }, 
    { label: "Sales History", path: "/history", icon: "📋" },
    { label: "Users", path: "/users", icon: "👥" },
  ];

  const cashierLinks = [
    { label: "POS", path: "/pos", icon: "🛒" },
  ];
  const isIdAdmin = role?.toLowerCase() === "admin";
  const links = isIdAdmin ? adminLinks : cashierLinks;

  const handleNavigate = (path: string) => {
    router.push(path);
    setMenuOpen(false);
  };

  const handleLogout = () => {
    router.push("/");
    setMenuOpen(false);
  };

  return (
    <>
      {/* Navbar Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center sticky top-0 z-40">
        <h1 className="text-lg font-bold text-blue-600">Smart POS</h1>

        <div className="flex items-center gap-2">
          {/* Desktop links */}
          <div className="hidden md:flex gap-2">
            {links.map((link) => (
              <button
                key={link.path}
                onClick={() => handleNavigate(link.path)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  pathname === link.path
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition"
            >
              Logout
            </button>
          </div>

          {/* Hamburger button — mobile only */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col justify-center items-center w-9 h-9 rounded-lg hover:bg-gray-100 transition gap-1.5"
          >
            <span className={`block w-5 h-0.5 bg-gray-600 transition-all duration-300 ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-5 h-0.5 bg-gray-600 transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-0.5 bg-gray-600 transition-all duration-300 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-30 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div className={`fixed top-0 right-0 h-full w-64 bg-white z-50 shadow-xl transform transition-transform duration-300 md:hidden ${menuOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-bold text-blue-600">Smart POS</h2>
          <button
            onClick={() => setMenuOpen(false)}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Role Badge */}
        <div className="px-4 py-3 border-b border-gray-100">
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${
            role === "admin"
              ? "bg-blue-100 text-blue-700"
              : "bg-green-100 text-green-700"
          }`}>
            {isIdAdmin ? "👑 Admin" : "💳 Cashier"}
          </span>
        </div>

        {/* Menu Links */}
        <div className="p-3 space-y-1">
          {links.map((link) => (
            <button
              key={link.path}
              onClick={() => handleNavigate(link.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition text-left ${
                pathname === link.path
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </button>
          ))}
        </div>

        {/* Logout */}
        <div className="absolute bottom-6 left-0 right-0 px-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}