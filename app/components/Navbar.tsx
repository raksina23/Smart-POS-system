"use client";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { fetchAlertCounts, AlertCounts } from "../lib/alerts";

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

  // --- Alerts: bell badge + one-time-per-session pop-up ---
  // Only relevant to admin — cashiers don't have access to Inventory/
  // Dashboard anyway, so there's nothing actionable for them to do here.
  const [alertCounts, setAlertCounts] = useState<AlertCounts>({
    expiringCount: 0,
    lowStockCount: 0,
  });
  const [bellOpen, setBellOpen] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  // allowPopup = false → refresh the numbers only, never open the pop-up
  const loadAlerts = useCallback(async (allowPopup = true) => {
    const counts = await fetchAlertCounts();
    setAlertCounts(counts);

    const total = counts.expiringCount + counts.lowStockCount;
    const alreadyShown = sessionStorage.getItem("alertsPopupShown");

    if (allowPopup && total > 0 && !alreadyShown) {
      setShowPopup(true);
      sessionStorage.setItem("alertsPopupShown", "true");
    }
  }, []);

  useEffect(() => {
    if (!isIdAdmin) return;

    loadAlerts();

    // Other pages can trigger a refresh after deleting / restocking with:
    //   window.dispatchEvent(new Event("alerts:refresh"));
    const onRefresh = () => loadAlerts(false);
    window.addEventListener("alerts:refresh", onRefresh);
    return () => window.removeEventListener("alerts:refresh", onRefresh);
  }, [isIdAdmin, loadAlerts]);

  const totalAlerts = alertCounts.expiringCount + alertCounts.lowStockCount;

  const handleNavigate = (path: string) => {
    router.push(path);
    setMenuOpen(false);
    setBellOpen(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("alertsPopupShown"); // fresh popup on next login
    router.push("/");
    setMenuOpen(false);
  };

  const goToDashboard = () => {
    setShowPopup(false);
    setBellOpen(false);
    router.push("/dashboard");
  };

  return (
    <>
      {/* Navbar Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center sticky top-0 z-40">
        <h1 className="text-lg font-bold text-blue-600">Maneewan Shop</h1>

        <div className="flex items-center gap-2">
          {/* Desktop links */}
          <div className="hidden md:flex gap-2 items-center">
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

            {/* Bell — admin only */}
            {isIdAdmin && (
              <div className="relative">
                <button
                  onClick={() => setBellOpen(!bellOpen)}
                  className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-lg"
                  aria-label="การแจ้งเตือน"
                >
                  🔔
                  {totalAlerts > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center px-1">
                      {totalAlerts}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    <div className="p-3 border-b border-gray-100">
                      <p className="text-sm font-bold text-gray-700">การแจ้งเตือน / Alerts</p>
                    </div>
                    {totalAlerts === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">
                        ไม่มีรายการแจ้งเตือน
                      </p>
                    ) : (
                      <div className="p-2 space-y-1">
                        {alertCounts.expiringCount > 0 && (
                          <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-red-50">
                            <span className="text-sm text-red-700">🕐 ใกล้หมดอายุ</span>
                            <span className="text-sm font-bold text-red-600">
                              {alertCounts.expiringCount}
                            </span>
                          </div>
                        )}
                        {alertCounts.lowStockCount > 0 && (
                          <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-orange-50">
                            <span className="text-sm text-orange-700">📦 สต็อกต่ำ</span>
                            <span className="text-sm font-bold text-orange-600">
                              {alertCounts.lowStockCount}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={goToDashboard}
                      className="w-full py-2.5 text-sm font-bold text-blue-600 hover:bg-blue-50 transition border-t border-gray-100"
                    >
                      ดูรายละเอียด / View Dashboard
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition"
            >
              Logout
            </button>
          </div>

          {/* Bell — mobile, shown next to hamburger */}
          {isIdAdmin && (
            <button
              onClick={() => handleNavigate("/dashboard")}
              className="md:hidden relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-lg"
              aria-label="การแจ้งเตือน"
            >
              🔔
              {totalAlerts > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center px-1">
                  {totalAlerts}
                </span>
              )}
            </button>
          )}

          {/* Hamburger button — mobile only */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col justify-center items-center w-9 h-9 rounded-lg hover:bg-gray-100 transition gap-1.5"
            aria-label="เมนู"
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
          <h2 className="font-bold text-blue-600">Maneewan Shop</h2>
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
            isIdAdmin
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

      {/* One-time-per-session pop-up alert */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  🔔 มีรายการที่ต้องดู
                </h2>
                <p className="text-xs text-gray-400">Attention needed</p>
              </div>
              <button
                onClick={() => setShowPopup(false)}
                className="text-gray-300 hover:text-gray-500 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {alertCounts.expiringCount > 0 && (
                <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <span className="text-sm font-medium text-red-700">
                    🕐 สินค้าใกล้หมดอายุ
                  </span>
                  <span className="text-lg font-bold text-red-600">
                    {alertCounts.expiringCount} รายการ
                  </span>
                </div>
              )}
              {alertCounts.lowStockCount > 0 && (
                <div className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                  <span className="text-sm font-medium text-orange-700">
                    📦 สต็อกต่ำ
                  </span>
                  <span className="text-lg font-bold text-orange-600">
                    {alertCounts.lowStockCount} รายการ
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowPopup(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
              >
                ปิด / Dismiss
              </button>
              <button
                onClick={goToDashboard}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700"
              >
                ดูรายละเอียด / View
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}