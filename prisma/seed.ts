import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
try {
  const player = await db.player.upsert({
    where: { externalId: 'demo-player' },
    create: {
      externalId: 'demo-player',
      name: 'Jogador Exemplo',
      country: 'BR',
      position: 'ATA',
    },
    update: {},
  });
  await db.card.upsert({
    where: { slug: 'demo-common' },
    create: {
      slug: 'demo-common',
      playerId: player.id,
      rating: 70,
      rarity: 'COMMON',
    },
    update: {},
  });
  console.log(
    'Catálogo de demonstração criado. Nenhuma carta ou moeda concedida a usuários.',
  );
} finally {
  await db.$disconnect();
}
