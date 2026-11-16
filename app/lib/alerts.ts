import { supabase } from "./supabase";
import { bkkDate } from "./dates";

export interface AlertCounts {
  expiringCount: number;
  lowStockCount: number;
}

// Same rules as the Dashboard page — kept here once so every page (Navbar,
// Dashboard, anywhere else) reads identical numbers instead of each
// re-implementing (and potentially drifting from) the same logic.
export async function fetchAlertCounts(): Promise<AlertCounts> {
  // --- Expiring soon: batches with stock left, expiring within 7 days ---
  const { count: expiringCount, error: expiringError } = await supabase
    .from("stock_batches")
    .select("id, products!inner ( is_active )", { count: "exact", head: true })
    .eq("products.is_active", true)
    .gt("quantity", 0)
    .lte("expiration_date", bkkDate(7));

  // --- Low stock: total <= min_stock AND no backup batch left ---
  const { data: allProducts, error: productsError } = await supabase
    .from("products")
    .select("id, min_stock, stock_batches ( quantity )")
    .eq("is_active", true);

  let lowStockCount = 0;
  if (!productsError && allProducts) {
    for (const p of allProducts as {
      id: string;
      min_stock: number;
      stock_batches: { quantity: number }[] | null;
    }[]) {
      const batches = p.stock_batches ?? [];
      const stockQty = batches.reduce((sum, b) => sum + b.quantity, 0);
      const activeBatchCount = batches.filter((b) => b.quantity > 0).length;
      if (stockQty <= p.min_stock && activeBatchCount <= 1) {
        lowStockCount += 1;
      }
    }
  }

  return {
    expiringCount: !expiringError && expiringCount !== null ? expiringCount : 0,
    lowStockCount,
  };
}