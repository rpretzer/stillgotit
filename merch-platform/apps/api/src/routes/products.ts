import { Router } from 'express';
import { prisma } from '../prisma.js';

export const productsRouter = Router();

// Public: list active products
productsRouter.get('/', async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { createdAt: 'asc' }
  });
  res.json({ products });
});


