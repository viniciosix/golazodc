import { createHash } from 'node:crypto';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  escapeMarkdown,
} from 'discord.js';
import type { GoalSubscription } from '@prisma/client';
import type { Context } from '../../core/types.js';
import { TRICORD_NAME, TRICORD_RED } from '../../core/brand.js';
import type { Match } from './provider.js';
import {
  formatCommentary,
  resolveEventEmojis,
  EVENT_EMOJIS,
  type EventEmojis,
} from './event-format.js';
import type { CommentaryLine } from './commentary.js';
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const missing = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 10008;
export function narrationText(
  match: Match,
  lines: CommentaryLine[],
  sinceSequence = -1,
  unavailable = false,
  emojis: EventEmojis = EVENT_EMOJIS,
) {
  const eligible = lines.filter((line) => line.sequence > sinceSequence);
  const recent = [
    ...new Map(
      eligible.map((line) => [
        line.eventId || `sequence:${line.sequence}`,
        line,
      ]),
    ).values(),
  ]
    .sort((a, b) => a.sequence - b.sequence)
    .slice(-5);
  const plays = recent
    .map((line) => formatCommentary(line, emojis))
    .join('\n\n');
  return `**${match.state === 'post' ? 'PARTIDA ENCERRADA' : 'NARRAÇÃO AO VIVO'} • ${escapeMarkdown(match.clock.slice(0, 100))}**\n\n${plays || (unavailable ? 'Narração indisponível na fonte neste momento.' : 'Aguardando os próximos lances da fonte…')}`.slice(
    0,
    3500,
  );
}

export function narrationPanel(
  match: Match,
  lines: CommentaryLine[],
  sinceSequence = -1,
  unavailable = false,
  emojis: EventEmojis = EVENT_EMOJIS,
  options: { simulation?: boolean } = {},
) {
  let narration = narrationText(
    match,
    lines,
    sinceSequence,
    unavailable,
    emojis,
  );
  if (options.simulation)
    narration = narration
      .replace('NARRAÇÃO AO VIVO', 'TESTE MANUAL')
      .replace('PARTIDA ENCERRADA', 'TESTE ENCERRADO')
      .replace(
        'Aguardando os próximos lances da fonte…',
        'Clique nos botões abaixo para simular um lance.',
      );
  const labels = [
    match.home.name,
    `${match.home.score} × ${match.away.score}`,
    match.away.name,
  ];
  const panel = new ContainerBuilder().setAccentColor(TRICORD_RED);
  const heading = new TextDisplayBuilder().setContent(
    `### ${options.simulation ? '🧪 TESTE SIMULADO' : 'Narração'}${match.competition ? `\n-# ${escapeMarkdown(match.competition.name.slice(0, 120))}` : ''}`,
  );
  if (match.competition?.logo)
    panel.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(heading)
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL(match.competition.logo)
            .setDescription(match.competition.name.slice(0, 100)),
        ),
    );
  else panel.addTextDisplayComponents(heading);
  return panel
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...labels.map((label, i) =>
          new ButtonBuilder()
            .setCustomId(`score-display:${i}`)
            .setLabel(label.slice(0, 80) || 'Time')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        ),
      ),
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(narration))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        options.simulation
          ? `-# ${TRICORD_NAME} • Dados fictícios · só o autor controla · expira em 1 hora`
          : `-# ${TRICORD_NAME} • ESPN`,
      ),
    );
}
export function narrationPayload(panel: ContainerBuilder) {
  return {
    flags: MessageFlags.IsComponentsV2 as const,
    components: [panel],
    allowedMentions: { parse: [] as never[] },
  };
}
export function pausedNarrationPanel() {
  return new ContainerBuilder()
    .setAccentColor(TRICORD_RED)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### Narração pausada\nUse /gols ligar para voltar a acompanhar.\n\n-# ${TRICORD_NAME}`,
      ),
    );
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
  const emojis = resolveEventEmojis(
    client,
    'guild' in channel ? channel.guild : null,
  );
  const panel = narrationPanel(
    match,
    lines,
    state.sinceSequence,
    unavailable,
    emojis,
  );
  const payloadHash = hash(JSON.stringify(panel.toJSON()));
  const payload = narrationPayload(panel);
  if (state.messageId) {
    if (state.payloadHash === payloadHash) return;
    try {
      await channel.messages.edit(state.messageId, {
        ...payload,
        content: null,
        embeds: [],
        attachments: [],
      });
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
        ...narrationPayload(pausedNarrationPanel()),
        content: null,
        embeds: [],
        attachments: [],
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
