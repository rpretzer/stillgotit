import { useState } from 'react';
import useSWR from 'swr';
import { apiGet, apiPost } from '../../lib/api';

type Order = {
  id: string;
  status: string;
  email: string;
  subtotalCents: number;
  currency: string;
};

type OrdersResp = { orders: Order[] };

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

export default function AdminPage() {
  const [auth, setAuth] = useState({ user: '', pass: '' });
  const [authed, setAuthed] = useState(false);
  const { data, mutate } = useSWR<OrdersResp>(authed ? ['/api/admin/orders', auth] : null, ([path, creds]) =>
    fetch(path, {
      headers: {
        authorization: 'Basic ' + btoa(`${creds.user}:${creds.pass}`)
      }
    }).then((r) => r.json())
  );

  const doSync = async () => {
    await apiPost('/api/admin/sync-products', {}, {
      authorization: 'Basic ' + btoa(`${auth.user}:${auth.pass}`)
    } as any);
    mutate();
  };

  const doLogin = async () => {
    // try one call
    const res = await fetch('/api/admin/orders', {
      headers: { authorization: 'Basic ' + btoa(`${auth.user}:${auth.pass}`) }
    });
    if (res.ok) {
      setAuthed(true);
      mutate();
    } else {
      alert('Auth failed');
    }
  };

  return (
    <div className="container stack">
      <h1>Admin</h1>
      {!authed && (
        <div className="card stack" style={{ maxWidth: 360 }}>
          <input placeholder="User" value={auth.user} onChange={(e) => setAuth({ ...auth, user: e.target.value })} />
          <input placeholder="Pass" type="password" value={auth.pass} onChange={(e) => setAuth({ ...auth, pass: e.target.value })} />
          <button className="btn btn-primary" onClick={doLogin}>Login</button>
        </div>
      )}

      {authed && (
        <>
          <div className="flex">
            <button className="btn btn-secondary" onClick={doSync}>Sync Printful products</button>
          </div>
          <div className="card stack">
            <h3>Recent orders</h3>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Email</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(data?.orders || []).map((o) => (
                  <tr key={o.id}>
                    <td>{o.id.slice(0, 8)}…</td>
                    <td><span className={`status ${o.status}`}>{o.status}</span></td>
                    <td>{o.email}</td>
                    <td>{formatMoney(o.subtotalCents, o.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}


