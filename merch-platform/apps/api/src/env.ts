import dotenv from 'dotenv';

dotenv.config({ path: process.env.DOTENV_PATH || '../../.env' });

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',

  DATABASE_URL: required('DATABASE_URL'),

  STRIPE_SECRET_KEY: required('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: required('STRIPE_WEBHOOK_SECRET'),

  PRINTFUL_TOKEN: required('PRINTFUL_TOKEN'),

  ADMIN_USER: required('ADMIN_USER'),
  ADMIN_PASS: required('ADMIN_PASS'),

  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:4000',
  WEB_BASE_URL: process.env.WEB_BASE_URL || 'http://localhost:3000'
};


