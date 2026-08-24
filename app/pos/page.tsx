"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase"; 

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

  const addToCart = async (barcode: string) => {
    setLoading(true);
    setError("");
    
    try {
      // stock_qty no longer lives on products — fetch the product together
      // with its batches and sum them here to get the true total in stock.
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

      // Build the cart item explicitly rather than spreading `product`,
      // since `product` now carries a nested stock_batches array we don't
      // want sitting in the cart — stock_qty here is the computed total.
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
  };

  const handleBarcodeSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && barcodeInput.trim() !== "") {
      addToCart(barcodeInput.trim());
    }
  };

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
      <Navbar role={role}/>
      
      <div className="flex flex-col flex-1 max-w-md mx-auto w-full shadow-lg overflow-hidden bg-white">

        <div className="p-4 bg-white border-b">
          <div className="h-40 bg-gray-200 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-400 relative overflow-hidden">
            <p className="text-gray-500 z-10 font-medium">📷 พื้นที่สแกนบาร์โค้ด...</p>
            <div className="absolute w-full h-0.5 bg-red-500 top-1/2 animate-pulse"></div>
          </div>
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