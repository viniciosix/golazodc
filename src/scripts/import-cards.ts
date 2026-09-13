import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { addCard } from '../modules/cards/catalog.js';
const schema = z.array(
  z.object({
    file: z.string().refine((v) => basename(v) === v && v.endsWith('.png')),
    slug: z.string(),
    name: z.string(),
    position: z.string(),
    rarity: z.enum(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']),
    edition: z.string(),
  }),
);
const db = new PrismaClient();
try {
  const entries = schema.parse(
    JSON.parse(await readFile(resolve('assets/cards/manifest.json'), 'utf8')),
  );
  for (const entry of entries) {
    await addCard(
      db,
      entry,
      await readFile(resolve('assets/cards', entry.file)),
    );
    process.stdout.write(`Carta disponível: ${entry.name}\n`);
  }
} finally {
  await db.$disconnect();
}
