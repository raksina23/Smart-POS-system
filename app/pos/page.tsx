"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import BarcodeScanner from "../components/BarcodeScanner";
import { useI18n } from "../lib/i18n";
import { TKey } from "../lib/dictionaries";

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  barcode: string;
  stock_qty: number;
}

type Msg = { key: TKey; vars?: Record<string, string | number> } | null;

export default function POSPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [error, setError] = useState<Msg>(null);

  const [role, setRole] = useState<string>("");
  const [loadingRole, setLoadingRole] = useState(true);
  const [loading, setLoading] = useState(false);

  // --- scanner state ---
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    const checkAuthAndRole = async () => {
      setLoadingRole(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error("User not logged in");
        router.push("/");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError.message);
        setRole("cashier");
      } else {
        setRole(profile.role.toLowerCase());
      }

      setLoadingRole(false);
    };

    checkAuthAndRole();
  }, [router]);

  const totalPrice = cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  const addToCart = useCallback(async (barcode: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: product, error: dbError } = await supabase
        .from("products")
        .select(`*, stock_batches ( quantity )`)
        .eq("barcode", barcode.trim())
        .eq("is_active", true)
        .single();

      if (dbError || !product) {
        setError({ key: "pos.notFound", vars: { barcode } });
        setLoading(false);
        return;
      }

      const totalStock = (product.stock_batches ?? []).reduce(
        (sum: number, b: { quantity: number }) => sum + b.quantity,
        0
      );

      if (totalStock <= 0) {
        setError({ key: "pos.outOfStock", vars: { name: product.name } });
        setLoading(false);
        return;
      }

      const cartProduct: CartItem = {
        id: product.id,
        name: product.name,
        price: product.price,
        barcode: product.barcode,
        stock_qty: totalStock,
        qty: 1,
      };

      setCart((prev) => {
        const existing = prev.find((item) => item.barcode === barcode);
        if (existing) {
          if (existing.qty + 1 > totalStock) {
            setError({ key: "pos.notEnoughStock" });
            return prev;
          }
          return prev.map((item) =>
            item.barcode === barcode
              ? { ...item, qty: item.qty + 1 }
              : item
          );
        }
        return [...prev, cartProduct];
      });
    } catch {
      setError({ key: "pos.dbError" });
    } finally {
      setLoading(false);
      setBarcodeInput("");
    }
  }, []);

  const handleBarcodeSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && barcodeInput.trim() !== "") {
      addToCart(barcodeInput.trim());
    }
  };

  // --- scanner handlers ---
  const openScanner = async () => {
    setCameraError(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("no-camera-api");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setScannerOpen(true);
    } catch {
      setCameraError(true);
      setScannerOpen(false);
    }
  };

  const closeScanner = () => setScannerOpen(false);

  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      addToCart(decodedText);
    },
    [addToCart]
  );

  const increaseQty = (id: string) => {
    setError(null);
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (item.qty + 1 > item.stock_qty) {
            setError({ key: "pos.notEnoughStock" });
            return item;
          }
          return { ...item, qty: item.qty + 1 };
        }
        return item;
      })
    );
  };

  const decreaseQty = (id: string) => {
    setError(null);
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, qty: item.qty - 1 } : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const removeItem = (id: string) => {
    setError(null);
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      setError({ key: "pos.addItemsFirst" });
      return;
    }
    localStorage.setItem("cart", JSON.stringify(cart));
    localStorage.setItem("totalPrice", totalPrice.toString());
    router.push("/receipt");
  };

  if (loadingRole) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">{t("pos.checking")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      <Navbar role={role} />

      <div className="flex flex-col flex-1 max-w-md mx-auto w-full shadow-sm border-x border-gray-100 overflow-hidden bg-white">

        {/* --- scanner area --- */}
        <div className="p-4 bg-white border-b border-gray-100">
          {!scannerOpen ? (
            <button
              type="button"
              onClick={openScanner}
              className="h-40 w-full bg-gray-50 rounded-xl flex flex-col items-center justify-center gap-2 border border-dashed border-gray-300 hover:bg-gray-100 hover:border-gray-400 transition"
            >
              <svg className="w-7 h-7 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 7h3l2-2h6l2 2h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              <span className="text-gray-600 text-sm font-medium">
                {t("pos.openScanner")}
              </span>
            </button>
          ) : (
            <div className="relative h-40 rounded-xl overflow-hidden bg-black">
              <BarcodeScanner onScan={handleScanSuccess} />
              <button
                type="button"
                onClick={closeScanner}
                className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 bg-black/65 hover:bg-black/80 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg z-10 transition"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4L12 12M12 4L4 12" strokeLinecap="round" />
                </svg>
                {t("pos.closeScanner")}
              </button>
            </div>
          )}
          {cameraError && (
            <p className="text-red-500 text-xs mt-2 font-medium">{t("pos.cameraError")}</p>
          )}
        </div>

        {/* Manual barcode input */}
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">
            {t("pos.manualLabel")}
          </label>
          <input
            type="text"
            disabled={loading}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            placeholder={loading ? t("pos.searching") : t("pos.placeholder")}
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={handleBarcodeSubmit}
          />
          {error && (
            <p className="text-red-500 text-xs mt-1.5 font-medium">{t(error.key, error.vars)}</p>
          )}
        </div>

        {/* Cart list */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 tabular-nums">
            {t("pos.items", { n: cart.length })}
          </h2>

          {cart.length === 0 ? (
            <div className="text-center text-gray-400 text-sm mt-10">
              {t("pos.cartEmpty")}
            </div>
          ) : (
            <div className="space-y-2.5">
              {cart.map((item) => (
                <div key={item.id} className="bg-white p-3.5 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-start gap-2 mb-2.5">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{item.name}</p>
                      <p className="text-xs text-gray-400 tabular-nums mt-0.5">
                        {t("pos.perUnit", { price: item.price.toFixed(2) })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-bold text-gray-800 text-sm tabular-nums">
                        ฿{(item.price * item.qty).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                        aria-label="Remove item"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4L12 12M12 4L4 12" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => decreaseQty(item.id)}
                        className="w-8 h-8 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 active:scale-95 flex items-center justify-center font-medium transition"
                      >
                        −
                      </button>
                      <span className="text-sm font-bold text-gray-800 tabular-nums min-w-[20px] text-center">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => increaseQty(item.id)}
                        className="w-8 h-8 rounded-full border border-blue-200 bg-blue-50/50 text-blue-600 hover:bg-blue-100 active:scale-95 flex items-center justify-center font-medium transition"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs text-gray-400 tabular-nums">
                      {t("pos.stock", { n: item.stock_qty })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checkout footer */}
        <div className="bg-white p-4 border-t border-gray-100">
          <div className="flex justify-between items-baseline mb-3.5">
            <span className="text-base font-bold text-gray-700">{t("pos.total")}</span>
            <span className="text-2xl font-bold text-blue-600 tabular-nums">
              ฿{totalPrice.toFixed(2)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full font-bold py-3.5 rounded-xl text-base transition ${
              cart.length === 0
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {t("pos.checkout")}
          </button>
        </div>
      </div>
    </div>
  );
}