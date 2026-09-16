import { Prisma, type PrismaClient } from '@prisma/client';
import { UserError } from '../../core/errors.js';
export interface Actor {
  id: string;
  username: string;
}
export interface EconomyResult {
  gameId?: string;
  title: string;
  description: string;
  cardIds?: string[];
  copyIds?: string[];
}
export async function operate(
  db: PrismaClient,
  actor: Actor,
  key: string,
  action: string,
  run: (tx: Prisma.TransactionClient, userId: string) => Promise<EconomyResult>,
): Promise<EconomyResult> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const existing = await tx.economyOperation.findUnique({
            where: { id: key },
          });
          if (existing) {
            if (existing.actorId !== actor.id || existing.action !== action)
              throw new UserError('Operação inválida.');
            return existing.result as unknown as EconomyResult;
          }
          const user = await tx.user.upsert({
            where: { discordId: actor.id },
            create: { discordId: actor.id, displayName: actor.username },
            update: { displayName: actor.username },
          });
          await tx.economyOperation.create({
            data: { id: key, actorId: actor.id, action, result: {} },
          });
          const result = await run(tx, user.id);
          await tx.economyOperation.update({
            where: { id: key },
            data: { result: result as unknown as Prisma.InputJsonValue },
          });
          return result;
        },
        { isolationLevel: 'Serializable', timeout: 15000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code) &&
        attempt < 4
      )
        continue;
      throw error;
    }
  }
  throw new UserError('Operação concorrente. Tente novamente.');
}
export async function balanceChange(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: bigint,
  operationId: string,
  reason: string,
) {
  if (amount < 0n) {
    const result = await tx.user.updateMany({
      where: { id: userId, coins: { gte: -amount } },
      data: { coins: { increment: amount } },
    });
    if (!result.count)
      throw new UserError('Tricoins insuficientes. Use /diario ou /trabalhar.');
  } else
    await tx.user.update({
      where: { id: userId },
      data: { coins: { increment: amount } },
    });
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  await tx.walletEntry.create({
    data: { userId, operationId, delta: amount, balance: user.coins, reason },
  });
  return user.coins;
}
