import useSWR from 'swr';
import Link from 'next/link';
import { apiGet } from '../lib/api';
import { loadCart, saveCart, addToCart } from '../lib/cart';
import { useEffect, useState } from 'react';

type Product = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  priceCents: number;
  currency: string;
  slug: string;
};

type ProductsResp = { products: Product[] };

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

export default function Home() {
  const { data } = useSWR<ProductsResp>('/api/products', apiGet);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    setCartCount(loadCart().items.reduce((s, i) => s + i.qty, 0));
  }, []);

  const onAdd = (id: string) => {
    const cart = addToCart(loadCart(), id, 1);
    saveCart(cart);
    setCartCount(cart.items.reduce((s, i) => s + i.qty, 0));
  };

  return (
    <div className="container stack">
      <header className="stack">
        <h1>Merch</h1>
        <p>Secure checkout via Stripe. Fulfilled by Printful. US shipping only.</p>
        <div className="flex">
          <Link className="btn btn-primary" href="/checkout">Go to checkout</Link>
          <Link className="btn btn-secondary" href="/cart">Cart ({cartCount})</Link>
        </div>
      </header>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {(data?.products || []).map((p) => (
          <article key={p.id} className="card stack">
            {p.imageUrl && <img src={p.imageUrl} alt={p.name} style={{ borderRadius: 10, width: '100%', height: 200, objectFit: 'cover' }} />}
            <h3>{p.name}</h3>
            <div>{formatMoney(p.priceCents, p.currency)}</div>
            <p>{p.description}</p>
            <div className="flex">
              <button className="btn btn-primary" onClick={() => onAdd(p.id)}>Add to cart</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}


