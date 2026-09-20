import { supabase } from "./supabase";

export interface AlertCounts {
  expiringCount: number;
  lowStockCount: number;
}

// Same rules as the Dashboard page — kept here once so every page (Navbar,
// Dashboard, anywhere else) reads identical numbers instead of each
// re-implementing (and potentially drifting from) the same logic.
export async function fetchAlertCounts(): Promise<AlertCounts> {
  const today = new Date();
  const in7Days = new Date();
  in7Days.setDate(today.getDate() + 7);
  const todayStr = today.toISOString().split("T")[0];
  const in7DaysStr = in7Days.toISOString().split("T")[0];

  // --- Expiring soon: batches with stock left, expiring within 7 days ---
  const { data: expiringBatches, error: expiringError } = await supabase
    .from("stock_batches")
    .select("id")
    .gt("quantity", 0)
    .lte("expiration_date", in7DaysStr)
    .gte("expiration_date", todayStr);

  // --- Low stock: total <= min_stock AND no backup batch left ---
  const { data: allProducts, error: productsError } = await supabase
    .from("products")
    .select(`id, min_stock, stock_batches ( quantity )`);

  let lowStockCount = 0;
  if (!productsError && allProducts) {
    for (const p of allProducts as any[]) {
      const batches: { quantity: number }[] = p.stock_batches ?? [];
      const stockQty = batches.reduce((sum, b) => sum + b.quantity, 0);
      const activeBatchCount = batches.filter((b) => b.quantity > 0).length;
      if (stockQty <= p.min_stock && activeBatchCount <= 1) {
        lowStockCount += 1;
      }
    }
  }

  return {
    expiringCount: !expiringError && expiringBatches ? expiringBatches.length : 0,
    lowStockCount,
  };
}