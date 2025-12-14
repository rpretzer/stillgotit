export type CartItem = { productId: string; qty: number };
export type Cart = { items: CartItem[] };

const KEY = 'sgic_cart_v1';

export function loadCart(): Cart {
  if (typeof window === 'undefined') return { items: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
    return parsed;
  } catch {
    return { items: [] };
  }
}

export function saveCart(cart: Cart) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(cart));
}

export function addToCart(cart: Cart, productId: string, qty = 1): Cart {
  const existing = cart.items.find((i) => i.productId === productId);
  if (existing) existing.qty += qty;
  else cart.items.push({ productId, qty });
  return cart;
}

export function setQty(cart: Cart, productId: string, qty: number) {
  const it = cart.items.find((i) => i.productId === productId);
  if (it) it.qty = Math.max(1, Math.min(20, Math.floor(qty || 1)));
  return cart;
}

export function removeFromCart(cart: Cart, productId: string) {
  cart.items = cart.items.filter((i) => i.productId !== productId);
  return cart;
}


