import { useEffect, useState } from 'react';
import { loadCart, saveCart } from '../lib/cart';
import { apiGet, apiPost } from '../lib/api';
import useSWR from 'swr';
import { useRouter } from 'next/router';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

type Product = { id: string; name: string; priceCents: number; currency: string };
type ProductsResp = { products: Product[] };

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

export default function CheckoutPage() {
  const { data } = useSWR<ProductsResp>('/api/products', apiGet);
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    name: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const cart = loadCart();
  const byId = new Map((data?.products || []).map((p) => [p.id, p]));
  const subtotal = cart.items.reduce((sum, it) => {
    const p = byId.get(it.productId);
    return p ? sum + p.priceCents * it.qty : sum;
  }, 0);
  const currency = data?.products?.[0]?.currency || 'USD';

  useEffect(() => {
    if (cart.items.length === 0) router.replace('/cart');
  }, []);

  const createPaymentIntent = async () => {
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        currency,
        email: form.email,
        name: form.name,
        shipping: {
          address1: form.address1,
          address2: form.address2,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          country: form.country
        },
        items: cart.items.map((i) => ({ productId: i.productId, qty: i.qty }))
      };
      const resp = await apiPost<{ orderId: string; clientSecret: string }>('/api/checkout', payload);
      setOrderId(resp.orderId);
      setClientSecret(resp.clientSecret);
    } catch (err: any) {
      setError(err?.message || 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  const CheckoutForm = () => {
    const stripe = useStripe();
    const elements = useElements();

    const onSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!stripe || !elements || !clientSecret || !orderId) return;
      setSubmitting(true);
      setError('');
      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/orders/${orderId}`
        },
        redirect: 'if_required'
      });
      if (stripeError) {
        setError(stripeError.message || 'Payment failed');
        setSubmitting(false);
        return;
      }
      saveCart({ items: [] });
      router.push(`/orders/${orderId}`);
    };

    return (
      <form className="stack" onSubmit={onSubmit}>
        <PaymentElement />
        <button className="btn btn-primary" type="submit" disabled={submitting || !stripe || !elements}>
          {submitting ? 'Processing…' : 'Pay with Stripe'}
        </button>
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      </form>
    );
  };

  return (
    <div className="container stack">
      <h1>Checkout</h1>
      <div className="card stack">
        <div>
          <strong>Subtotal:</strong> {formatMoney(subtotal, currency)}
        </div>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); createPaymentIntent(); }}>
          <input required placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required placeholder="Address 1" value={form.address1} onChange={(e) => setForm({ ...form, address1: e.target.value })} />
          <input placeholder="Address 2" value={form.address2} onChange={(e) => setForm({ ...form, address2: e.target.value })} />
          <div className="flex">
            <input required placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input required placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            <input required placeholder="Postal" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
          </div>
        </form>

        {clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm />
          </Elements>
        )}
      </div>
    </div>
  );
}


