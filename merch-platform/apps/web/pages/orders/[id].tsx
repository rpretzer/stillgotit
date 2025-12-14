import { useRouter } from 'next/router';
import useSWR from 'swr';
import { apiGet } from '../../lib/api';

type Order = {
  id: string;
  status: string;
  currency: string;
  subtotalCents: number;
  events: Array<{ id: string; status: string; message?: string; createdAt: string }>;
  items: Array<{ id: string; quantity: number; unitPriceCents: number; product: { name: string } }>;
};
type OrderResp = { order: Order };

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

export default function OrderPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data } = useSWR<OrderResp>(id ? `/api/orders/${id}` : null, apiGet, { refreshInterval: 3000 });

  if (!data) return <div className="container"><p>Loading order…</p></div>;

  const { order } = data;
  return (
    <div className="container stack">
      <h1>Order {order.id}</h1>
      <div className="card stack">
        <div className={`status ${order.status}`}>{order.status}</div>
        <div><strong>Subtotal:</strong> {formatMoney(order.subtotalCents, order.currency)}</div>
        <div className="stack">
          <h3>Items</h3>
          {order.items.map((it) => (
            <div key={it.id} className="flex" style={{ justifyContent: 'space-between' }}>
              <div>{it.product.name} × {it.quantity}</div>
              <div>{formatMoney(it.unitPriceCents * it.quantity, order.currency)}</div>
            </div>
          ))}
        </div>
        <div className="stack">
          <h3>Status timeline</h3>
          <div className="stack">
            {order.events.map((ev) => (
              <div key={ev.id} className="flex" style={{ justifyContent: 'space-between' }}>
                <span>{new Date(ev.createdAt).toLocaleString()}</span>
                <span>{ev.status}{ev.message ? ` — ${ev.message}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


