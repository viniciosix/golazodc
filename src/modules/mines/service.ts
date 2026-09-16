import type { PrismaClient } from '@prisma/client';
import { UserError } from '../../core/errors.js';
import { balanceChange, operate, type Actor } from '../economy/transaction.js';
import { drawBombs, MINES, payout, validateSettings } from './rules.js';

export async function startMines(
  db: PrismaClient,
  actor: Actor,
  key: string,
  bet: number,
  bombs: number,
  guildId: string,
) {
  if (!validateSettings(bet, bombs))
    throw new UserError(
      `Aposte de ${MINES.minBet} a ${MINES.maxBet} Tricoins e escolha de 1 a ${MINES.maxBombs} bombas.`,
    );
  const result = await operate(
    db,
    actor,
    key,
    'mines:start',
    async (tx, userId) => {
      const active = await tx.minesGame.findUnique({
        where: { activeOwner: actor.id },
      });
      if (active)
        throw new UserError(
          'Você já tem um Mines em andamento. Use /mines e clique em Continuar no servidor da partida.',
        );
      await balanceChange(tx, userId, -BigInt(bet), key, 'Aposta Mines');
      const game = await tx.minesGame.create({
        data: {
          userId,
          ownerId: actor.id,
          activeOwner: actor.id,
          guildId,
          bet: BigInt(bet),
          bombs: drawBombs(bombs),
        },
      });
      return { title: 'Mines', description: 'Partida criada', gameId: game.id };
    },
  );
  return getGame(db, actor.id, result.gameId!, guildId);
}
export async function getGame(
  db: PrismaClient,
  ownerId: string,
  id: string,
  guildId: string,
) {
  const game = await db.minesGame.findFirst({
    where: { id, ownerId, guildId },
  });
  if (!game)
    throw new UserError('Esta partida não é sua ou pertence a outro servidor.');
  return game;
}
export async function resumeMines(
  db: PrismaClient,
  ownerId: string,
  guildId: string,
) {
  const game = await db.minesGame.findFirst({
    where: { ownerId, guildId },
    orderBy: { createdAt: 'desc' },
  });
  if (!game)
    throw new UserError(
      'Nenhuma partida encontrada neste servidor. Use /mines.',
    );
  return game;
}
export async function moveMines(
  db: PrismaClient,
  actor: Actor,
  key: string,
  id: string,
  guildId: string,
  revision: number,
  move: number | 'cash',
) {
  if (
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    (move !== 'cash' &&
      (!Number.isInteger(move) || move < 0 || move >= MINES.cells))
  )
    throw new UserError('Jogada inválida.');
  await operate(db, actor, key, 'mines:move', async (tx, userId) => {
    const game = await tx.minesGame.findFirst({
      where: { id, userId, ownerId: actor.id, guildId },
    });
    if (!game) throw new UserError('Abra sua própria partida com /mines.');
    if (game.status !== 'ACTIVE')
      throw new UserError('Esta partida já terminou. Use /mines.');
    if (game.revision !== revision)
      throw new UserError(
        'O tabuleiro mudou. Use os botões atualizados ou /mines e clique em Continuar.',
      );
    const revealed = [...game.revealed];
    let status = 'ACTIVE';
    let prize = 0n;
    if (move === 'cash') {
      status = revealed.length ? 'CASHED' : 'CANCELLED';
      prize = payout(game.bet, game.bombs.length, revealed.length);
    } else {
      if (revealed.includes(move))
        throw new UserError('Esta casa já foi revelada.');
      revealed.push(move);
      if (game.bombs.includes(move)) status = 'LOST';
      else if (revealed.length === MINES.cells - game.bombs.length) {
        status = 'WON';
        prize = payout(game.bet, game.bombs.length, revealed.length);
      }
    }
    await tx.minesGame.update({
      where: { id },
      data: {
        revealed,
        status,
        prize,
        revision: { increment: 1 },
        activeOwner: status === 'ACTIVE' ? actor.id : null,
      },
    });
    if (prize > 0n)
      await balanceChange(
        tx,
        userId,
        prize,
        key,
        status === 'CANCELLED'
          ? 'Mines: aposta devolvida'
          : 'Mines: prêmio retirado',
      );
    return { title: 'Mines', description: status, gameId: id };
  });
  return getGame(db, actor.id, id, guildId);
}
