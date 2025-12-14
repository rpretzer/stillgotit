import { PrismaClient, FulfillmentType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Sample products (replace printful IDs after syncing real products)
  await prisma.product.upsert({
    where: { slug: 'still-got-it-tee' },
    update: {},
    create: {
      slug: 'still-got-it-tee',
      name: 'Still Got It Tee',
      description: 'Classic tee. Print-on-demand fulfilled by Printful.',
      imageUrl: 'https://placehold.co/800x800/png?text=Still+Got+It+Tee',
      currency: 'USD',
      priceCents: 2800,
      fulfillmentType: FulfillmentType.PRINTFUL,
      printfulProductId: 0,
      printfulVariantId: 0
    }
  });

  await prisma.product.upsert({
    where: { slug: 'still-got-it-hoodie' },
    update: {},
    create: {
      slug: 'still-got-it-hoodie',
      name: 'Still Got It Hoodie',
      description: 'Cozy hoodie. Print-on-demand fulfilled by Printful.',
      imageUrl: 'https://placehold.co/800x800/png?text=Still+Got+It+Hoodie',
      currency: 'USD',
      priceCents: 5200,
      fulfillmentType: FulfillmentType.PRINTFUL,
      printfulProductId: 0,
      printfulVariantId: 0
    }
  });

  await prisma.product.upsert({
    where: { slug: 'still-got-it-hat' },
    update: {},
    create: {
      slug: 'still-got-it-hat',
      name: 'Still Got It Hat',
      description: 'Dad hat. Print-on-demand fulfilled by Printful.',
      imageUrl: 'https://placehold.co/800x800/png?text=Still+Got+It+Hat',
      currency: 'USD',
      priceCents: 3200,
      fulfillmentType: FulfillmentType.PRINTFUL,
      printfulProductId: 0,
      printfulVariantId: 0
    }
  });

  await prisma.product.upsert({
    where: { slug: 'sticker-pack' },
    update: {},
    create: {
      slug: 'sticker-pack',
      name: 'Sticker Pack',
      description: 'Manual fulfillment: a small pack of stickers.',
      imageUrl: 'https://placehold.co/800x800/png?text=Sticker+Pack',
      currency: 'USD',
      priceCents: 900,
      fulfillmentType: FulfillmentType.MANUAL,
      active: true
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });


