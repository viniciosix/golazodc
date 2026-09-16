import { randomInt } from 'node:crypto';
import type { Prisma, PrismaClient, Rarity } from '@prisma/client';
import { UserError } from '../../core/errors.js';
import { ECONOMY, PACKS, RARITY_WEIGHTS, RECYCLE } from './config.js';
import { balanceChange, operate, type Actor } from './transaction.js';
export async function pool(tx: Prisma.TransactionClient) {
  const cards = await tx.card.findMany({
    where: { active: true, artwork: { isNot: null } },
    select: { id: true, rarity: true, player: { select: { name: true } } },
    orderBy: { id: 'asc' },
  });
  if (!cards.length)
    throw new UserError(
      'O catálogo ainda não tem cartas disponíveis. Um administrador precisa importar as cartas.',
    );
  return cards;
}
export function packOdds(cards: { rarity: Rarity }[]) {
  const available = Object.entries(RARITY_WEIGHTS).filter(([rarity]) =>
    cards.some((c) => c.rarity === rarity),
  );
  const total = available.reduce((sum, [, weight]) => sum + weight, 0);
  return available.map(([rarity, weight]) => ({
    rarity: rarity as Rarity,
    weight,
    percent: total ? (weight / total) * 100 : 0,
  }));
}
export function draw<T extends { rarity: Rarity }>(cards: T[]): T {
  const odds = packOdds(cards);
  const total = odds.reduce((sum, row) => sum + row.weight, 0);
  if (!total) throw new UserError('Pack indisponível.');
  let n = randomInt(total);
  let rarity = odds[0]!.rarity;
  for (const row of odds) {
    if (n < row.weight) {
      rarity = row.rarity;
      break;
    }
    n -= row.weight;
  }
  const selected = cards.filter((c) => c.rarity === rarity);
  return selected[randomInt(selected.length)]!;
}
function cooldown(last: Date | null, duration: number, now: Date) {
  if (last && now.getTime() - last.getTime() < duration)
    throw new UserError(
      `Disponível novamente <t:${Math.ceil((last.getTime() + duration) / 1000)}:R>.`,
    );
}
export function starter(db: PrismaClient, actor: Actor, key: string) {
  return operate(db, actor, key, 'starter', async (tx, userId) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.starterAt)
      throw new UserError(
        'Você já recebeu seu kit inicial. Use /diario, /trabalhar e /loja.',
      );
    const cards = [...(await pool(tx))];
    const chosen: typeof cards = [];
    for (let i = 0; i < ECONOMY.starterCards && cards.length; i++)
      chosen.push(cards.splice(randomInt(cards.length), 1)[0]!);
    const copies = [];
    for (const card of chosen)
      copies.push(
        await tx.userCard.create({
          data: { userId, cardId: card.id, source: 'starter' },
        }),
      );
    await tx.user.update({
      where: { id: userId },
      data: { starterAt: new Date() },
    });
    const coins = await balanceChange(
      tx,
      userId,
      BigInt(ECONOMY.starterCoins),
      key,
      'Kit inicial',
    );
    return {
      title: 'Seu clube começou!',
      description: `${chosen.length} cartas e ${ECONOMY.starterCoins} Tricoins recebidos. Saldo: ${coins} Tricoins.`,
      cardIds: chosen.map((c) => c.id),
      copyIds: copies.map((c) => c.id),
    };
  });
}
export function reward(
  db: PrismaClient,
  actor: Actor,
  key: string,
  kind: 'daily' | 'work',
  now = new Date(),
) {
  return operate(db, actor, key, kind, async (tx, userId) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    let amount: number;
    let detail: string;
    if (kind === 'daily') {
      cooldown(user.dailyAt, ECONOMY.dailyMs, now);
      const streak =
        user.dailyAt &&
        now.getTime() - user.dailyAt.getTime() < ECONOMY.dailyMs * 2
          ? Math.min(user.streak + 1, ECONOMY.streakCap)
          : 1;
      amount = randomInt(ECONOMY.dailyMin, ECONOMY.dailyMax + 1);
      detail = `Sequência: ${streak} dia(s).`;
      await tx.user.update({
        where: { id: userId },
        data: { dailyAt: now, streak },
      });
    } else {
      cooldown(user.workAt, ECONOMY.workMs, now);
      amount = randomInt(ECONOMY.workMin, ECONOMY.workMax + 1);
      detail = 'Treino concluído! Volte em 4 horas.';
      await tx.user.update({ where: { id: userId }, data: { workAt: now } });
    }
    const coins = await balanceChange(
      tx,
      userId,
      BigInt(amount),
      key,
      kind === 'daily' ? 'Recompensa diária' : 'Trabalho',
    );
    return {
      title: `+${amount} Tricoins`,
      description: `${detail}
Saldo: **${coins} Tricoins**.`,
    };
  });
}
export function buyPack(
  db: PrismaClient,
  actor: Actor,
  key: string,
  type: keyof typeof PACKS,
) {
  const pack = PACKS[type];
  if (!pack) throw new UserError('Pack inválido.');
  return operate(db, actor, key, 'pack', async (tx, userId) => {
    const cards = await pool(tx);
    const coins = await balanceChange(
      tx,
      userId,
      -BigInt(pack.cost),
      key,
      pack.name,
    );
    const chosen = Array.from({ length: pack.count }, () => draw(cards));
    const copies = [];
    for (const card of chosen)
      copies.push(
        await tx.userCard.create({
          data: { userId, cardId: card.id, source: `pack:${type}` },
        }),
      );
    return {
      title: pack.name,
      description: `${pack.count} cartas recebidas • ${pack.cost} Tricoins gastos.
Saldo: ${coins} Tricoins. Repetidas podem aparecer.`,
      cardIds: chosen.map((c) => c.id),
      copyIds: copies.map((c) => c.id),
    };
  });
}
export function recycle(
  db: PrismaClient,
  actor: Actor,
  key: string,
  copyId: string,
) {
  return operate(db, actor, key, 'recycle', async (tx, userId) => {
    const copy = await tx.userCard.findFirst({
      where: { id: copyId, userId, destroyedAt: null, locked: false },
      include: { card: { include: { player: true } } },
    });
    if (!copy)
      throw new UserError('Carta indisponível, bloqueada ou de outra pessoa.');
    const count = await tx.userCard.count({
      where: { userId, cardId: copy.cardId, destroyedAt: null },
    });
    if (count < 2)
      throw new UserError(
        'Só é possível reciclar repetidas. Sua última cópia é preservada.',
      );
    await tx.userCard.update({
      where: { id: copy.id },
      data: { destroyedAt: new Date() },
    });
    const amount = RECYCLE[copy.card.rarity];
    const coins = await balanceChange(
      tx,
      userId,
      BigInt(amount),
      key,
      'Reciclagem',
    );
    return {
      title: 'Repetida reciclada',
      description: `${copy.card.player.name}: +${amount} Tricoins.
Saldo: ${coins} Tricoins.`,
    };
  });
}
