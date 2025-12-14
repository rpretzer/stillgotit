import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '../lib/api';
import useSWR from 'swr';
import { loadCart, saveCart, setQty, removeFromCart } from '../lib/cart';

type Product = {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
};
type ProductsResp = { products: Product[] };

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

export default function CartPage() {
  const { data } = useSWR<ProductsResp>('/api/products', apiGet);
  const [cartItems, setCartItems] = useState(loadCart().items);

  useEffect(() => {
    setCartItems(loadCart().items);
  }, []);

  const updateQty = (id: string, qty: number) => {
    const cart = setQty(loadCart(), id, qty);
    saveCart(cart);
    setCartItems([...cart.items]);
  };

  const remove = (id: string) => {
    const cart = removeFromCart(loadCart(), id);
    saveCart(cart);
    setCartItems([...cart.items]);
  };

  const byId = new Map((data?.products || []).map((p) => [p.id, p]));
  const subtotal = cartItems.reduce((sum, it) => {
    const p = byId.get(it.productId);
    return p ? sum + p.priceCents * it.qty : sum;
  }, 0);
  const currency = data?.products?.[0]?.currency || 'USD';

  return (
    <div className="container stack">
      <h1>Cart</h1>
      {cartItems.length === 0 ? (
        <p>Cart is empty. <Link href="/">Shop merch</Link></p>
      ) : (
        <div className="stack">
          {cartItems.map((it) => {
            const p = byId.get(it.productId);
            if (!p) return null;
            return (
              <div key={it.productId} className="card flex" style={{ justifyContent: 'space-between' }}>
                <div className="stack">
                  <strong>{p.name}</strong>
                  <div>{formatMoney(p.priceCents, p.currency)}</div>
                </div>
                <div className="flex">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={it.qty}
                    onChange={(e) => updateQty(it.productId, Number(e.target.value))}
                  />
                  <button className="btn btn-secondary" onClick={() => remove(it.productId)}>Remove</button>
                </div>
              </div>
            );
          })}
          <div className="card flex" style={{ justifyContent: 'space-between' }}>
            <div>Subtotal</div>
            <strong>{formatMoney(subtotal, currency)}</strong>
          </div>
          <div className="flex">
            <Link className="btn btn-primary" href="/checkout">Checkout</Link>
            <Link className="btn btn-secondary" href="/">Continue shopping</Link>
          </div>
        </div>
      )}
    </div>
  );
}


