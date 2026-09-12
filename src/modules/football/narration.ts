import { createHash } from 'node:crypto';
import { EmbedBuilder, escapeMarkdown } from 'discord.js';
import type { GoalSubscription } from '@prisma/client';
import type { Context } from '../../core/types.js';
import { TRICORD_NAME, TRICORD_RED } from '../../core/brand.js';
import type { Match } from './provider.js';
import type { CommentaryLine } from './commentary.js';
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const missing = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 10008;
export function narrationEmbed(
  match: Match,
  lines: CommentaryLine[],
  sinceSequence = -1,
  unavailable = false,
) {
  const recent = lines
    .filter((line) => line.sequence > sinceSequence)
    .slice(-5);
  const plays = recent
    .map(
      (line) =>
        `${line.clock ? `**${escapeMarkdown(line.clock)}** ` : ''}${escapeMarkdown(line.text.slice(0, 500))}`,
    )
    .join('\n\n');
  return new EmbedBuilder()
    .setColor(TRICORD_RED)
    .setTitle(
      `${match.home.name} ${match.home.score} × ${match.away.score} ${match.away.name}`.slice(
        0,
        256,
      ),
    )
    .setDescription(
      `**${match.state === 'post' ? 'PARTIDA ENCERRADA' : 'NARRAÇÃO AO VIVO'} • ${escapeMarkdown(match.clock.slice(0, 100))}**\n\n${plays || (unavailable ? 'Narração indisponível na fonte neste momento.' : 'Aguardando os próximos lances da fonte…')}`.slice(
        0,
        4096,
      ),
    )
    .setFooter({
      text: `${TRICORD_NAME} • ESPN • Atualização periódica; pode haver atraso`,
    });
}
export async function syncNarration(
  context: Context,
  sub: GoalSubscription,
  match: Match,
  lines: CommentaryLine[],
  unavailable = false,
) {
  const { db, client } = context;
  const active = await db.goalSubscription.findFirst({
    where: { id: sub.id, revision: sub.revision, enabled: true },
  });
  if (!active) return;
  let state = await db.matchNarration.findUnique({
    where: { subscriptionId: sub.id },
  });
  if (!state && match.state !== 'in') return;
  if (!state)
    state = await db.matchNarration.create({
      data: {
        subscriptionId: sub.id,
        eventId: match.id,
        revision: sub.revision,
      },
    });
  const channel = await client.channels.fetch(sub.channelId);
  if (!channel?.isTextBased() || !('send' in channel))
    throw new Error('Canal de narração indisponível');
  const changedGame =
    state.eventId !== match.id || state.revision !== sub.revision;
  if (changedGame || state.rotate) {
    if (state.messageId) {
      try {
        const message = await channel.messages.fetch(state.messageId);
        await message.delete();
      } catch (error) {
        if (!missing(error)) throw error;
      }
    }
    state = await db.matchNarration.update({
      where: { id: state.id },
      data: {
        messageId: null,
        payloadHash: '',
        generation: { increment: 1 },
        eventId: match.id,
        revision: sub.revision,
        rotate: false,
        sinceSequence: changedGame
          ? -1
          : (lines.at(-1)?.sequence ?? state.sinceSequence),
      },
    });
  }
  const embed = narrationEmbed(match, lines, state.sinceSequence, unavailable);
  const payloadHash = hash(JSON.stringify(embed.toJSON()));
  const payload = {
    embeds: [embed],
    allowedMentions: { parse: [] as never[] },
  };
  if (state.messageId) {
    if (state.payloadHash === payloadHash) return;
    try {
      await channel.messages.edit(state.messageId, payload);
      await db.matchNarration.update({
        where: { id: state.id },
        data: { payloadHash },
      });
      return;
    } catch (error) {
      if (!missing(error)) throw error;
    }
    state = await db.matchNarration.update({
      where: { id: state.id },
      data: { messageId: null, generation: { increment: 1 } },
    });
  }
  const message = await channel.send({
    ...payload,
    nonce: hash(`narration:${state.id}:${state.generation}`).slice(0, 24),
    enforceNonce: true,
  });
  await db.matchNarration.update({
    where: { id: state.id },
    data: { messageId: message.id, payloadHash },
  });
}
export async function pauseNarrations({ db, client }: Context) {
  const states = await db.matchNarration.findMany({
    where: {
      subscription: { enabled: false },
      messageId: { not: null },
      payloadHash: { not: 'paused' },
    },
    include: { subscription: true },
  });
  for (const state of states) {
    const channel = await client.channels.fetch(state.subscription.channelId);
    if (!channel?.isTextBased() || !('send' in channel)) continue;
    try {
      await channel.messages.edit(state.messageId!, {
        embeds: [
          new EmbedBuilder()
            .setColor(TRICORD_RED)
            .setTitle('Narração pausada')
            .setDescription('Use /gols ligar para voltar a acompanhar.')
            .setFooter({ text: TRICORD_NAME }),
        ],
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      if (!missing(error)) throw error;
    }
    await db.matchNarration.update({
      where: { id: state.id },
      data: { payloadHash: 'paused' },
    });
  }
}
