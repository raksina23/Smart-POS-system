"use client";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { fetchAlertCounts, AlertCounts } from "../lib/alerts";
import { useI18n } from "../lib/i18n";
import { TKey } from "../lib/dictionaries";
import LanguageSwitcher from "./LanguageSwitcher";

type NavLink = { labelKey: TKey; path: string };

const adminLinks: NavLink[] = [
  { labelKey: "nav.dashboard", path: "/dashboard" },
  { labelKey: "nav.inventory", path: "/inventory" },
  { labelKey: "nav.categories", path: "/categories" },
  { labelKey: "nav.pos", path: "/pos" },
  { labelKey: "nav.history", path: "/history" },
  { labelKey: "nav.users", path: "/users" },
  { labelKey: "nav.manual", path: "/manual" },
];

const cashierLinks: NavLink[] = [
  { labelKey: "nav.pos", path: "/pos" },
  { labelKey: "nav.manual", path: "/manual" },
];

function NavIcon({ path, className = "w-4 h-4 shrink-0" }: { path: string; className?: string }) {
  switch (path) {
    case "/dashboard":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" strokeLinecap="round" />
        </svg>
      );
    case "/inventory":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" strokeLinejoin="round" />
          <path d="M3 8l9 5 9-5M12 13v8" strokeLinejoin="round" />
        </svg>
      );
    case "/categories":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" strokeLinejoin="round" />
          <circle cx="7" cy="7" r="1.5" fill="currentColor" />
        </svg>
      );
    case "/pos":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 6h15l-1.5 9h-12z" strokeLinejoin="round" />
          <path d="M6 6L5 3H2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="20" r="1.5" />
          <circle cx="18" cy="20" r="1.5" />
        </svg>
      );
    case "/history":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6M9 16h4" strokeLinecap="round" />
        </svg>
      );
    case "/users":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" strokeLinecap="round" />
          <path d="M16 11a3 3 0 100-6M21 19c0-2.2-1.6-4-4-4.6" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M2 4h7a3 3 0 013 3v13a2 2 0 00-2-2H2V4zM22 4h-7a3 3 0 00-3 3v13a2 2 0 012-2h8V4z" strokeLinejoin="round" />
        </svg>
      );
  }
}

function BellIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon({ className = "w-4 h-4 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BoxIcon({ className = "w-4 h-4 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" strokeLinejoin="round" />
      <path d="M3 8l9 5 9-5M12 13v8" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 5L15 15M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}

export default function Navbar({ role }: { role: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  const isIdAdmin = role?.toLowerCase() === "admin";
  const links = isIdAdmin ? adminLinks : cashierLinks;

  const [alertCounts, setAlertCounts] = useState<AlertCounts>({
    expiringCount: 0,
    lowStockCount: 0,
  });
  const [bellOpen, setBellOpen] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

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
    sessionStorage.removeItem("alertsPopupShown");
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
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center gap-3 sticky top-0 z-40">
        <h1 className="text-lg font-bold text-blue-600 whitespace-nowrap shrink-0">
          Maneewan Shop
        </h1>

        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop links — switch to drawer below 1280px (xl) so 7 admin items never collide with shop name */}
          <div className="hidden xl:flex gap-1.5 items-center">
            {links.map((link) => (
              <button
                key={link.path}
                type="button"
                onClick={() => handleNavigate(link.path)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  pathname === link.path
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {t(link.labelKey)}
              </button>
            ))}

            {/* Bell — admin only */}
            {isIdAdmin && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBellOpen(!bellOpen)}
                  className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition"
                  aria-label={t("nav.alerts")}
                >
                  <BellIcon className="w-5 h-5" />
                  {totalAlerts > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold tabular-nums min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                      {totalAlerts}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    <div className="p-3 border-b border-gray-100">
                      <p className="text-sm font-bold text-gray-700">{t("nav.alerts")}</p>
                    </div>
                    {totalAlerts === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">
                        {t("alerts.none")}
                      </p>
                    ) : (
                      <div className="p-2 space-y-1">
                        {alertCounts.expiringCount > 0 && (
                          <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-red-50">
                            <span className="flex items-center gap-2 text-sm text-red-700">
                              <ClockIcon className="w-4 h-4 shrink-0 text-red-600" />
                              {t("alerts.expiring")}
                            </span>
                            <span className="text-sm font-bold text-red-600 tabular-nums">
                              {alertCounts.expiringCount}
                            </span>
                          </div>
                        )}
                        {alertCounts.lowStockCount > 0 && (
                          <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-orange-50">
                            <span className="flex items-center gap-2 text-sm text-orange-700">
                              <BoxIcon className="w-4 h-4 shrink-0 text-orange-600" />
                              {t("alerts.lowStock")}
                            </span>
                            <span className="text-sm font-bold text-orange-600 tabular-nums">
                              {alertCounts.lowStockCount}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={goToDashboard}
                      className="w-full py-2.5 text-sm font-bold text-blue-600 hover:bg-blue-50 transition border-t border-gray-100"
                    >
                      {t("alerts.viewDashboard")}
                    </button>
                  </div>
                )}
              </div>
            )}

            <LanguageSwitcher />

            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 whitespace-nowrap transition"
            >
              {t("nav.logout")}
            </button>
          </div>

          {/* Bell — mobile & tablet, shown next to hamburger */}
          {isIdAdmin && (
            <button
              type="button"
              onClick={() => handleNavigate("/dashboard")}
              className="xl:hidden relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition"
              aria-label={t("nav.alerts")}
            >
              <BellIcon className="w-5 h-5" />
              {totalAlerts > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold tabular-nums min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                  {totalAlerts}
                </span>
              )}
            </button>
          )}

          {/* Hamburger button — mobile & tablet (< 1280px) */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="xl:hidden flex flex-col justify-center items-center w-9 h-9 rounded-lg hover:bg-gray-100 transition gap-1.5"
            aria-label={t("nav.menu")}
          >
            <span className={`block w-5 h-0.5 bg-gray-600 transition-all duration-300 ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-5 h-0.5 bg-gray-600 transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-0.5 bg-gray-600 transition-all duration-300 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Menu Overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 xl:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile & Tablet Menu Drawer */}
      <div className={`fixed top-0 right-0 h-full w-72 bg-white z-50 shadow-xl flex flex-col transform transition-transform duration-300 xl:hidden ${menuOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
          <h2 className="font-bold text-blue-600 whitespace-nowrap">Maneewan Shop</h2>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            aria-label={t("common.dismiss")}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Role Badge + Language */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2 shrink-0">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${
            isIdAdmin
              ? "bg-blue-100 text-blue-700"
              : "bg-green-100 text-green-700"
          }`}>
            {isIdAdmin ? t("nav.roleAdmin") : t("nav.roleCashier")}
          </span>
          <LanguageSwitcher />
        </div>

        {/* Menu Links */}
        <div className="p-3 space-y-1 flex-1 overflow-y-auto">
          {links.map((link) => (
            <button
              key={link.path}
              type="button"
              onClick={() => handleNavigate(link.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition text-left ${
                pathname === link.path
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <NavIcon path={link.path} className="w-4 h-4 shrink-0" />
              <span>{t(link.labelKey)}</span>
            </button>
          ))}
        </div>

        {/* Logout */}
        <div className="p-3 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{t("nav.logout")}</span>
          </button>
        </div>
      </div>

      {/* One-time-per-session pop-up alert */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
                <BellIcon className="w-5 h-5 text-blue-600 shrink-0" />
                {t("alerts.popupTitle")}
              </h2>
              <button
                type="button"
                onClick={() => setShowPopup(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                aria-label={t("common.dismiss")}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="space-y-2">
              {alertCounts.expiringCount > 0 && (
                <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-red-700">
                    <ClockIcon className="w-4 h-4 shrink-0 text-red-600" />
                    {t("alerts.popupExpiring")}
                  </span>
                  <span className="text-base font-bold text-red-600 tabular-nums">
                    {t("alerts.itemCount", { n: alertCounts.expiringCount })}
                  </span>
                </div>
              )}
              {alertCounts.lowStockCount > 0 && (
                <div className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-orange-700">
                    <BoxIcon className="w-4 h-4 shrink-0 text-orange-600" />
                    {t("alerts.popupLowStock")}
                  </span>
                  <span className="text-base font-bold text-orange-600 tabular-nums">
                    {t("alerts.itemCount", { n: alertCounts.lowStockCount })}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowPopup(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
              >
                {t("common.dismiss")}
              </button>
              <button
                type="button"
                onClick={goToDashboard}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition"
              >
                {t("alerts.viewDetails")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}