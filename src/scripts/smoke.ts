import { baseSchema, parseConfig } from '../config/env.js';
import { createDatabase } from '../infrastructure/database.js';
import { createCache } from '../infrastructure/cache.js';
import { loadHandlers } from '../core/loader.js';
import { renderCard } from '../images/render-card.js';
const config = parseConfig(baseSchema);
const db = createDatabase();
const cache = await createCache(config.REDIS_URL as string | undefined);
try {
  await db.$connect();
  await db.user.count();
  const handlers = await loadHandlers();
  await cache.set('smoke', { ok: true }, 10);
  if (!(await cache.get<{ ok: boolean }>('smoke'))?.ok)
    throw new Error('Falha de cache');
  await cache.delete('smoke');
  const image = await renderCard({
    name: 'Smoke Test',
    rating: 80,
    position: 'ATA',
    rarity: 'COMMON',
  });
  console.log({
    commands: handlers.commands.size,
    imageBytes: image.length,
    database: 'ok',
    cache: 'ok',
  });
} finally {
  await Promise.allSettled([db.$disconnect(), cache.close()]);
}
