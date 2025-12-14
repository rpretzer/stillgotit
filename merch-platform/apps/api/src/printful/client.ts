import { env } from '../env.js';

type PrintfulResponse<T> = { result: T };

export type PrintfulStoreProduct = {
  id: number;
  name: string;
  thumbnail_url?: string;
};

export type PrintfulStoreProductDetails = {
  sync_product: { id: number; name: string; thumbnail_url?: string };
  sync_variants: Array<{
    id: number;
    sync_product_id: number;
    name: string;
    retail_price: string;
    currency: string;
  }>;
};

export type PrintfulOrderCreate = {
  external_id: string;
  recipient: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state_code: string;
    country_code: string;
    zip: string;
    email: string;
  };
  items: Array<{
    sync_variant_id: number;
    quantity: number;
  }>;
};

export type PrintfulOrder = {
  id: number;
  status: string;
};

export class PrintfulClient {
  private base = 'https://api.printful.com';

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${env.PRINTFUL_API_KEY}`,
        'content-type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      const msg = data?.result?.error || data?.error?.message || data?.error || `Printful error (${res.status})`;
      const err = new Error(msg);
      (err as any).printful = data;
      throw err;
    }
    return data as T;
  }

  async listStoreProducts(limit = 20, offset = 0): Promise<PrintfulStoreProduct[]> {
    const r = await this.req<PrintfulResponse<PrintfulStoreProduct[]>>(
      'GET',
      `/store/products?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`
    );
    return r.result;
  }

  async getStoreProduct(id: number): Promise<PrintfulStoreProductDetails> {
    const r = await this.req<PrintfulResponse<PrintfulStoreProductDetails>>('GET', `/store/products/${id}`);
    return r.result;
  }

  async createOrder(payload: PrintfulOrderCreate): Promise<PrintfulOrder> {
    const r = await this.req<PrintfulResponse<PrintfulOrder>>('POST', '/orders', payload);
    return r.result;
  }

  async getOrder(id: number): Promise<any> {
    return await this.req<any>('GET', `/orders/${id}`);
  }
}

export const printful = new PrintfulClient();


