// types/database.ts

export type Product = {
  id: string;           // uuid
  name: string;
  barcode: string;
  price: number;
  cost: number;
  stock_qty: number;
  min_stock: number;
  category: string;
  expiration_date: string | null;
};

export type Order = {
  id: string;           // uuid
  total_amount: number;
  cash_received: number;
  change: number;
  payment_type: string;
  created_at: string;
};

export type OrderItem = {
  id: string;           // uuid
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price_sold: number;
  cost_sold: number;
};

export type Profile = {
  id: string;           // uuid (= auth.users.id)
  email: string;
  role: string;
};