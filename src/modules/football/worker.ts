import { createHash } from 'node:crypto';
import type { Context } from '../../core/types.js';
import { logger } from '../../core/logger.js';
import { fetchMatches, leagueSchema } from './provider.js';
import { observeMatch } from './goals.js';
export async function pollGoals(
  { db, client }: Context,
  getMatches = fetchMatches,
) {
  const subs = await db.goalSubscription.findMany({ where: { enabled: true } });
  for (const league of new Set(subs.map((s) => s.league))) {
    try {
      const matches = await getMatches(leagueSchema.parse(league));
      for (const sub of subs.filter((s) => s.league === league))
        for (const match of matches) await observeMatch(db, sub, match);
    } catch (error) {
      logger.warn(
        { err: error, league },
        'Falha na consulta de gols; mantendo o placar anterior',
      );
    }
  }
  const cutoff = new Date(Date.now() - 300000);
  const notices = await db.goalNotice.findMany({
    where: { sentAt: null, attempts: { lt: 3 }, createdAt: { gt: cutoff } },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });
  for (const notice of notices) {
    const sub = await db.goalSubscription.findUnique({
      where: { id: notice.subscriptionId },
    });
    if (!sub?.enabled || sub.revision !== notice.revision) {
      await db.goalNotice.delete({ where: { id: notice.id } });
      continue;
    }
    await db.goalNotice.update({
      where: { id: notice.id },
      data: { attempts: { increment: 1 } },
    });
    try {
      const channel = await client.channels.fetch(sub.channelId);
      if (!channel?.isTextBased() || !('send' in channel))
        throw new Error('Canal indisponível');
      await channel.send({
        content: notice.content,
        allowedMentions: { parse: [] },
        nonce: createHash('sha256')
          .update(notice.id)
          .digest('hex')
          .slice(0, 24),
        enforceNonce: true,
      });
      await db.goalNotice.update({
        where: { id: notice.id },
        data: { sentAt: new Date() },
      });
    } catch (error) {
      logger.warn(
        { err: error, channelId: sub.channelId, noticeId: notice.id },
        'Falha ao entregar alerta de gol',
      );
    }
  }
  await db.goalNotice.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 86400000) } },
  });
  await db.goalSnapshot.deleteMany({
    where: { observedAt: { lt: new Date(Date.now() - 7 * 86400000) } },
  });
}
export function startGoalWorker(context: Context, seconds: number) {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<void> | undefined;
  const tick = () => {
    running = pollGoals(context)
      .catch((err: unknown) => logger.error({ err }, 'Monitor de gols falhou'))
      .finally(() => {
        if (!stopped) timer = setTimeout(tick, seconds * 1000);
      });
  };
  tick();
  return async () => {
    stopped = true;
    clearTimeout(timer);
    await running;
  };
}
