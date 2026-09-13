import type { Prisma, PrismaClient } from '@prisma/client';
import { UserError } from '../../core/errors.js';
import { ECONOMY } from './config.js';
import { balanceChange, operate, type Actor } from './transaction.js';
export async function expireTrades(
  tx: Prisma.TransactionClient,
  now = new Date(),
) {
  const offers = await tx.tradeOffer.findMany({
    where: { status: 'OPEN', expiresAt: { lte: now } },
  });
  for (const offer of offers) {
    await tx.tradeOffer.update({
      where: { id: offer.id },
      data: { status: 'EXPIRED' },
    });
    await tx.userCard.updateMany({
      where: { id: offer.offeredId, userId: offer.senderId, destroyedAt: null },
      data: { locked: false },
    });
  }
}
export function sell(
  db: PrismaClient,
  actor: Actor,
  key: string,
  copyId: string,
  price: number,
) {
  if (!Number.isSafeInteger(price) || price < 1 || price > ECONOMY.maxPrice)
    throw new UserError('Preço inválido.');
  return operate(db, actor, key, 'market-sell', async (tx, userId) => {
    await expireTrades(tx);
    const copy = await tx.userCard.findFirst({
      where: { id: copyId, userId, locked: false, destroyedAt: null },
      include: { card: { include: { player: true } } },
    });
    if (!copy)
      throw new UserError('Carta indisponível, bloqueada ou de outra pessoa.');
    await tx.userCard.update({
      where: { id: copy.id },
      data: { locked: true },
    });
    const listing = await tx.marketListing.create({
      data: { userCardId: copyId, sellerId: userId, price: BigInt(price) },
    });
    return {
      title: 'Carta anunciada',
      description: `${copy.card.player.name} por **${price} Tricoins**.
Anúncio: \`${listing.id}\`. Use /mercado cancelar para retirar.`,
    };
  });
}
export function buyListing(
  db: PrismaClient,
  actor: Actor,
  key: string,
  listingId: string,
) {
  return operate(db, actor, key, 'market-buy', async (tx, userId) => {
    const listing = await tx.marketListing.findUnique({
      where: { id: listingId },
      include: {
        userCard: { include: { card: { include: { player: true } } } },
      },
    });
    if (
      !listing ||
      listing.status !== 'OPEN' ||
      listing.userCard.destroyedAt ||
      listing.userCard.userId !== listing.sellerId ||
      !listing.userCard.locked
    )
      throw new UserError('Esse anúncio não está mais disponível.');
    if (listing.sellerId === userId)
      throw new UserError('Você não pode comprar sua própria carta.');
    await balanceChange(
      tx,
      userId,
      -listing.price,
      key,
      `Compra ${listing.id}`,
    );
    await balanceChange(
      tx,
      listing.sellerId,
      listing.price,
      key,
      `Venda ${listing.id}`,
    );
    await tx.userCard.update({
      where: { id: listing.userCardId },
      data: { userId, locked: false, acquiredAt: new Date() },
    });
    await tx.marketListing.update({
      where: { id: listing.id },
      data: { status: 'COMPLETED', buyerId: userId },
    });
    return {
      title: 'Compra concluída',
      description: `${listing.userCard.card.player.name} chegou à sua coleção por ${listing.price} Tricoins.`,
      cardIds: [listing.userCard.cardId],
      copyIds: [listing.userCardId],
    };
  });
}
export function cancelListing(
  db: PrismaClient,
  actor: Actor,
  key: string,
  listingId: string,
) {
  return operate(db, actor, key, 'market-cancel', async (tx, userId) => {
    const listing = await tx.marketListing.findFirst({
      where: { id: listingId, sellerId: userId, status: 'OPEN' },
    });
    if (!listing)
      throw new UserError('Anúncio indisponível ou de outra pessoa.');
    await tx.marketListing.update({
      where: { id: listing.id },
      data: { status: 'CANCELLED' },
    });
    await tx.userCard.update({
      where: { id: listing.userCardId },
      data: { locked: false },
    });
    return {
      title: 'Anúncio retirado',
      description: 'Sua carta está novamente disponível na coleção.',
    };
  });
}
export function proposeTrade(
  db: PrismaClient,
  actor: Actor,
  key: string,
  recipientDiscordId: string,
  offeredId: string,
  wantedId: string,
) {
  if (actor.id === recipientDiscordId)
    throw new UserError('Escolha outra pessoa para trocar.');
  return operate(db, actor, key, 'trade-propose', async (tx, userId) => {
    await expireTrades(tx);
    const recipient = await tx.user.findUnique({
      where: { discordId: recipientDiscordId },
    });
    if (!recipient) throw new UserError('Essa pessoa ainda não possui perfil.');
    const offered = await tx.userCard.findFirst({
      where: { id: offeredId, userId, locked: false, destroyedAt: null },
    });
    const wanted = await tx.userCard.findFirst({
      where: {
        id: wantedId,
        userId: recipient.id,
        locked: false,
        destroyedAt: null,
      },
    });
    if (!offered || !wanted)
      throw new UserError(
        'Confira os IDs, os donos e os bloqueios das duas cartas.',
      );
    await tx.userCard.update({
      where: { id: offered.id },
      data: { locked: true },
    });
    const trade = await tx.tradeOffer.create({
      data: {
        senderId: userId,
        recipientId: recipient.id,
        offeredId,
        wantedId,
        expiresAt: new Date(Date.now() + ECONOMY.tradeMs),
      },
    });
    return {
      title: 'Proposta criada',
      description: `Proposta: \`${trade.id}\`
Oferecida: \`${offeredId}\` • Desejada: \`${wantedId}\`.
A outra pessoa precisa usar /troca aceitar com esse ID em até 24 horas. Sua carta fica reservada; a dela só será transferida se aceitar.`,
    };
  });
}
export function resolveTrade(
  db: PrismaClient,
  actor: Actor,
  key: string,
  tradeId: string,
  accept: boolean,
) {
  return operate(
    db,
    actor,
    key,
    accept ? 'trade-accept' : 'trade-cancel',
    async (tx, userId) => {
      const offer = await tx.tradeOffer.findUnique({
        where: { id: tradeId },
        include: { offered: true, wanted: true },
      });
      if (!offer || offer.status !== 'OPEN')
        throw new UserError('Proposta indisponível.');
      if (
        accept
          ? offer.recipientId !== userId
          : ![offer.senderId, offer.recipientId].includes(userId)
      )
        throw new UserError('Você não pode decidir esta troca.');
      if (offer.expiresAt.getTime() <= Date.now()) {
        await tx.tradeOffer.update({
          where: { id: offer.id },
          data: { status: 'EXPIRED' },
        });
        await tx.userCard.update({
          where: { id: offer.offeredId },
          data: { locked: false },
        });
        return {
          title: 'Proposta expirada',
          description:
            'A carta oferecida foi desbloqueada. Crie uma nova proposta.',
        };
      }
      if (!accept) {
        await tx.tradeOffer.update({
          where: { id: offer.id },
          data: { status: 'CANCELLED' },
        });
        await tx.userCard.update({
          where: { id: offer.offeredId },
          data: { locked: false },
        });
        return {
          title: 'Troca cancelada',
          description: 'A carta oferecida foi liberada.',
        };
      }
      if (
        offer.offered.userId !== offer.senderId ||
        offer.wanted.userId !== userId ||
        offer.offered.destroyedAt ||
        offer.wanted.destroyedAt ||
        !offer.offered.locked ||
        offer.wanted.locked
      )
        throw new UserError(
          'Uma das cartas não está mais disponível. Cancele a proposta.',
        );
      await tx.userCard.update({
        where: { id: offer.offeredId },
        data: { userId, locked: false, acquiredAt: new Date() },
      });
      await tx.userCard.update({
        where: { id: offer.wantedId },
        data: { userId: offer.senderId, acquiredAt: new Date() },
      });
      await tx.tradeOffer.update({
        where: { id: offer.id },
        data: { status: 'COMPLETED' },
      });
      return {
        title: 'Troca concluída',
        description: 'As duas cartas foram transferidas na mesma transação.',
        cardIds: [offer.offered.cardId],
        copyIds: [offer.offeredId],
      };
    },
  );
}
