"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import BarcodeScanner from "../components/BarcodeScanner"; // adjust path to wherever you put it

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  barcode: string;
  stock_qty: number;
}

export default function POSPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [error, setError] = useState("");

  const [role, setRole] = useState<string>("");
  const [loadingRole, setLoadingRole] = useState(true);
  const [loading, setLoading] = useState(false);

  // --- scanner state ---
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");

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
    (sum, item) => sum + item.price * item.qty, 0
  );

  const addToCart = useCallback(async (barcode: string) => {
    setLoading(true);
    setError("");

    try {
      const { data: product, error: dbError } = await supabase
        .from("products")
        .select(`*, stock_batches ( quantity )`)
        .eq("barcode", barcode.trim())
        .single();

      if (dbError || !product) {
        setError(`ไม่พบสินค้าบาร์โค้ด: ${barcode}`);
        setLoading(false);
        return;
      }

      const totalStock = (product.stock_batches ?? []).reduce(
        (sum: number, b: { quantity: number }) => sum + b.quantity,
        0
      );

      if (totalStock <= 0) {
        setError(`สินค้า "${product.name}" หมดสต็อก`);
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
            setError("สต็อกไม่พอ");
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
    } catch (err) {
      setError("การเชื่อมต่อฐานข้อมูลขัดข้อง");
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
    setCameraError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("no-camera-api");
      }
      // quick permission probe; the actual stream is opened by BarcodeScanner itself
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setScannerOpen(true);
    } catch (err) {
      setCameraError(
        "ไม่พบกล้อง หรือไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาใช้การคีย์บาร์โค้ดด้วยตนเองแทน"
      );
      setScannerOpen(false);
    }
  };

  const closeScanner = () => setScannerOpen(false);

  // barcode successfully decoded by the camera
  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      addToCart(decodedText);
    },
    [addToCart]
  );

  const increaseQty = (id: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (item.qty + 1 > item.stock_qty) {
            alert("สินค้าในสต็อกไม่พอ");
            return item;
          }
          return { ...item, qty: item.qty + 1 };
        }
        return item;
      })
    );
  };

  const decreaseQty = (id: string) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, qty: item.qty - 1 } : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      setError("กรุณาเพิ่มสินค้าก่อนชำระเงิน");
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
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">กำลังตรวจสอบสิทธิ์การใช้งาน...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      <Navbar role={role} />

      <div className="flex flex-col flex-1 max-w-md mx-auto w-full shadow-lg overflow-hidden bg-white">

        {/* --- scanner area --- */}
        <div className="p-4 bg-white border-b">
          {!scannerOpen ? (
            <button
              onClick={openScanner}
              className="h-40 w-full bg-gray-200 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-400 hover:bg-gray-300 transition-colors"
            >
              <span className="text-2xl mb-1">📷</span>
              <span className="text-gray-600 text-sm font-medium">กดเพื่อเปิดกล้องสแกน</span>
            </button>
          ) : (
            <div className="relative h-40 rounded-lg overflow-hidden bg-black">
              <BarcodeScanner onScan={handleScanSuccess} />
              <button
                onClick={closeScanner}
                className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md z-10"
              >
                ✕ ปิดกล้อง
              </button>
            </div>
          )}
          {cameraError && (
            <p className="text-red-500 text-xs mt-2 font-bold">{cameraError}</p>
          )}
        </div>

        <div className="px-4 py-3 bg-white border-b">
          <label className="text-xs font-medium text-gray-500 mb-1 block">
            คีย์บาร์โค้ดด้วยตนเอง (กด Enter เพื่อเพิ่ม)
          </label>
          <input
            type="text"
            disabled={loading}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            placeholder={loading ? "กำลังค้นหา..." : "เช่น 885111"}
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={handleBarcodeSubmit}
          />
          {error && (
            <p className="text-red-500 text-xs mt-1 font-bold">{error}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <h2 className="text-sm font-bold text-gray-600 mb-3">
            รายการสินค้า ({cart.length})
          </h2>

          {cart.length === 0 ? (
            <div className="text-center text-gray-400 text-sm mt-10">
              ยังไม่มีสินค้าในตะกร้า
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
                      <p className="text-xs text-gray-400">฿{item.price.toFixed(2)} / ชิ้น</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-600 text-sm">฿{(item.price * item.qty).toFixed(2)}</span>
                      <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-400 text-lg">✕</button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-3">
                      <button onClick={() => decreaseQty(item.id)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center">−</button>
                      <span className="text-base font-bold text-gray-800">{item.qty}</span>
                      <button onClick={() => increaseQty(item.id)} className="w-8 h-8 rounded-full border border-blue-400 text-blue-600 flex items-center justify-center">+</button>
                    </div>
                    <span className="text-[10px] text-gray-400">สต็อก: {item.stock_qty}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-4 border-t shadow-inner">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-bold text-gray-700">ยอดรวมทั้งสิ้น</span>
            <span className="text-2xl font-bold text-red-500">฿{totalPrice.toFixed(2)}</span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full font-bold py-4 rounded-xl text-lg transition-colors ${
              cart.length === 0 ? "bg-gray-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
            }`}
          >
            ชำระเงิน (Checkout)
          </button>
        </div>
      </div>
    </div>
  );
}