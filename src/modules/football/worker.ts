import { reactToNotice, cancelBanter } from './banter.js';
import { EmbedBuilder, type GuildTextBasedChannel } from 'discord.js';
import { TRICORD_NAME, TRICORD_RED } from '../../core/brand.js';
import { resolveEventEmojis } from './event-format.js';
import { fetchCommentary } from './commentary.js';
import { syncNarration, pauseNarrations } from './narration.js';
import { createHash } from 'node:crypto';
import type { Context } from '../../core/types.js';
import { logger } from '../../core/logger.js';
import { fetchMatches, leagueSchema } from './provider.js';
import { observeMatch } from './goals.js';
export async function pollGoals(
  { db, client }: Context,
  getMatches = fetchMatches,
  getCommentary = fetchCommentary,
) {
  const games = new Map<string, Awaited<ReturnType<typeof fetchMatches>>>();
  const subs = await db.goalSubscription.findMany({ where: { enabled: true } });
  for (const league of new Set(subs.map((s) => s.league))) {
    try {
      const matches = await getMatches(leagueSchema.parse(league));
      games.set(league, matches);
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
      const emojis = resolveEventEmojis(
        client,
        'guild' in channel ? channel.guild : null,
      );
      const match = games.get(sub.league)?.find((m) => m.id === notice.eventId);
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(TRICORD_RED)
            .setDescription(notice.content.replace(/^⚽/, emojis.goal))
            .setThumbnail(match?.competition?.logo || null)
            .setFooter({ text: TRICORD_NAME }),
        ],
        allowedMentions: { parse: [] },
        nonce: createHash('sha256')
          .update(notice.id)
          .digest('hex')
          .slice(0, 24),
        enforceNonce: true,
      });
      await db.$transaction(async (tx) => {
        await tx.goalNotice.update({
          where: { id: notice.id },
          data: { sentAt: new Date() },
        });
        if (notice.eventId)
          await tx.matchNarration.updateMany({
            where: {
              subscriptionId: sub.id,
              eventId: notice.eventId,
              revision: sub.revision,
            },
            data: { rotate: true },
          });
      });
      try {
        await reactToNotice(
          { db, client } as Context,
          channel as GuildTextBasedChannel,
          notice,
          sub.teamId,
        );
      } catch (err) {
        logger.warn(
          { err, noticeId: notice.id },
          'Falha na comemoração; alerta já entregue',
        );
      }
    } catch (error) {
      logger.warn(
        { err: error, channelId: sub.channelId, noticeId: notice.id },
        'Falha ao entregar alerta de gol',
      );
    }
  }
  const commentary = new Map<
    string,
    Awaited<ReturnType<typeof fetchCommentary>> | null
  >();
  for (const sub of subs) {
    try {
      const matches = (games.get(sub.league) || []).filter(
        (m) => m.home.id === sub.teamId || m.away.id === sub.teamId,
      );
      const state = await db.matchNarration.findUnique({
        where: { subscriptionId: sub.id },
      });
      const match =
        matches.find((m) => m.state === 'in') ||
        matches.find((m) => m.id === state?.eventId && m.state === 'post');
      if (!match) continue;
      const key = `${sub.league}:${match.id}`;
      if (!commentary.has(key)) {
        try {
          commentary.set(
            key,
            await getCommentary(leagueSchema.parse(sub.league), match.id),
          );
        } catch (error) {
          commentary.set(key, null);
          logger.warn(
            { err: error, eventId: match.id },
            'Narração indisponível na fonte',
          );
        }
      }
      const lines = commentary.get(key);
      await syncNarration(
        { db, client } as Context,
        sub,
        match,
        lines || [],
        lines === null,
      );
    } catch (error) {
      logger.warn(
        { err: error, channelId: sub.channelId },
        'Falha ao atualizar narração',
      );
    }
  }
  try {
    await pauseNarrations({ db, client } as Context);
  } catch (error) {
    logger.warn({ err: error }, 'Falha ao pausar narração');
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
    cancelBanter();
  };
}
