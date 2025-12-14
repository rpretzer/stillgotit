import type { Request, Response, NextFunction } from 'express';
import { env } from '../env.js';

export function requireBasicAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization') || '';
  if (!header.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="SGIC Admin"');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const b64 = header.slice('Basic '.length);
  const decoded = Buffer.from(b64, 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');
  if (user !== env.ADMIN_USER || pass !== env.ADMIN_PASS) {
    res.setHeader('WWW-Authenticate', 'Basic realm="SGIC Admin"');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}


