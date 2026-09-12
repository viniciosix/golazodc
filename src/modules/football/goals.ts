import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { Match, League } from './provider.js';
export function scoreFor(match: Match, teamId: string) {
  if (match.home.id === teamId)
    return { own: match.home.score, other: match.away.score };
  if (match.away.id === teamId)
    return { own: match.away.score, other: match.home.score };
  return null;
}
export function goalChange(
  previous: { own: number; other: number },
  current: { own: number; other: number },
) {
  if (current.own < previous.own || current.other < previous.other)
    return 'correction';
  if (current.own > previous.own) return 'goal';
  return null;
}
export async function enableGoals(
  db: PrismaClient,
  data: {
    guildId: string;
    channelId: string;
    league: League;
    teamId: string;
    teamName: string;
  },
  matches: Match[],
) {
  return db.$transaction(async (tx) => {
    const sub = await tx.goalSubscription.upsert({
      where: { channelId: data.channelId },
      create: { ...data, revision: randomUUID() },
      update: { ...data, enabled: true, revision: randomUUID() },
    });
    await tx.goalSnapshot.deleteMany({ where: { subscriptionId: sub.id } });
    await tx.goalNotice.deleteMany({
      where: { subscriptionId: sub.id, sentAt: null },
    });
    for (const match of matches) {
      const score = scoreFor(match, sub.teamId);
      if (score)
        await tx.goalSnapshot.create({
          data: {
            subscriptionId: sub.id,
            eventId: match.id,
            revision: sub.revision,
            ownScore: score.own,
            otherScore: score.other,
          },
        });
    }
    return sub;
  });
}
export async function observeMatch(
  db: PrismaClient,
  sub: { id: string; revision: string; teamId: string; teamName: string },
  match: Match,
) {
  const score = scoreFor(match, sub.teamId);
  if (!score) return;
  await db.$transaction(async (tx) => {
    const active = await tx.goalSubscription.findFirst({
      where: { id: sub.id, revision: sub.revision, enabled: true },
    });
    if (!active) return;
    const where = {
      subscriptionId_eventId: { subscriptionId: sub.id, eventId: match.id },
    };
    const old = await tx.goalSnapshot.findUnique({ where });
    if (!old) {
      await tx.goalSnapshot.create({
        data: {
          subscriptionId: sub.id,
          eventId: match.id,
          revision: sub.revision,
          ownScore: score.own,
          otherScore: score.other,
        },
      });
      return;
    }
    if (old.revision !== sub.revision) return;
    const kind = goalChange(
      { own: old.ownScore, other: old.otherScore },
      score,
    );
    const changed = await tx.goalSnapshot.updateMany({
      where: { id: old.id, sequence: old.sequence, revision: sub.revision },
      data: {
        ownScore: score.own,
        otherScore: score.other,
        observedAt: new Date(),
        sequence: { increment: 1 },
      },
    });
    if (
      !changed.count ||
      !kind ||
      match.state === 'pre' ||
      Date.now() - old.observedAt.getTime() > 300000
    )
      return;
    const title =
      kind === 'goal'
        ? `⚽ GOL DO ${sub.teamName.toUpperCase()}!`
        : '↩️ Correção de placar / possível gol anulado';
    await tx.goalNotice.create({
      data: {
        subscriptionId: sub.id,
        revision: sub.revision,
        content: `${title}\n${match.home.name} ${match.home.score} × ${match.away.score} ${match.away.name}\n${match.clock} • Fonte: ESPN\nhttps://www.espn.com.br/futebol/placar/_/jogoId/${match.id}`,
      },
    });
  });
}
