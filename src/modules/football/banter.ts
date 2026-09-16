import { createHash, randomInt } from 'node:crypto';
import type { GuildTextBasedChannel, Message } from 'discord.js';
import type { Context } from '../../core/types.js';
import { logger } from '../../core/logger.js';

export const GOAL_PHRASES = [
  'GOLLL CARALHO! VAMOS PORRA',
  'VAMOS SAO PAULO CARALHOOOOO GOOOOOOLLLLL',
  'PQP GOOOOOOOL CHUPAAA CRLLLLLL',
  'PABXOABSLSOS GOOOOOOLLLLLLL PQORKEIABDOABCOAB VAMOSSSSSS',
];
export const CONCEDED_PHRASES = [
  'PORRA VAI TOMAR NO CU, COMO EU NÃO CONSIGO ASSISTIR O JOGO COM CERTEZA A CULPA É DA PORRA DO SABINO.',
  'CARALHO ESSE LUCIANO É UM IMBECIL, PQP(FODASE SE ELE NAO FEZ NADA SÓ QUERO XINGAR ELE)',
  'TROPA ESSE CALLERI ENTRA EM JOGO QUANDO?',
  'CADE O LUCAS MOURA PRA FAZER UMA ORAÇÃO',
];
export const REPLY_PHRASES = [
  'VAI SE FODEERR [USUARIO] AQUI É SÃO PAULO PORRA!',
  'PQP MANO EU VOU EXPLODIR! É GOL DO SÃO PAULO',
  'MANO EU ACHO Q EU SERIA CAPAZ DE GRITAR ATÉ AMANHÃ POR CONTA DESSE GOL! VAI SE FODERRRR',
  'VAIII TRIKAAAA💅💅',
];
export type BanterKind = 'goal' | 'conceded';
const timers = new Map<string, { channelId: string; timer: NodeJS.Timeout }>();
const delivered = new Map<string, number>();
const pick = <T>(items: T[]) => items[randomInt(items.length)]!;
const nonce = (id: string) =>
  createHash('sha256').update(id).digest('hex').slice(0, 24);

export function replyCandidates(messages: Iterable<Message>, now = Date.now()) {
  return [...messages].filter(
    (m) =>
      !m.author.bot &&
      !m.webhookId &&
      !m.system &&
      m.createdTimestamp >= now - 15 * 60000,
  );
}

export function cancelBanter(channelId?: string) {
  for (const [key, entry] of timers) {
    if (!channelId || entry.channelId === channelId) {
      clearTimeout(entry.timer);
      timers.delete(key);
    }
  }
}

export async function sendBanter(
  channel: GuildTextBasedChannel,
  kind: BanterKind,
  key: string,
  options: { test?: boolean; stillEnabled?: () => Promise<boolean> } = {},
) {
  for (const [id, at] of delivered)
    if (Date.now() - at > 20 * 60000) delivered.delete(id);
  if (delivered.has(key)) return;
  delivered.set(key, Date.now());
  const prefix = options.test ? '[TESTE] ' : '';
  try {
    await channel.send({
      content: prefix + pick(kind === 'goal' ? GOAL_PHRASES : CONCEDED_PHRASES),
      allowedMentions: { parse: [] },
      nonce: nonce(`${key}:first`),
      enforceNonce: true,
    });
  } catch (err) {
    delivered.delete(key);
    throw err;
  }
  if (kind !== 'goal') return;
  const timer = setTimeout(() => {
    timers.delete(key);
    void (async () => {
      if (options.stillEnabled && !(await options.stillEnabled())) return;
      const messages = await channel.messages.fetch({ limit: 50 });
      const candidates = replyCandidates(messages.values());
      if (!candidates.length) return;
      const target = pick(candidates);
      const content =
        prefix +
        pick(REPLY_PHRASES).replaceAll('[USUARIO]', `<@${target.author.id}>`);
      await channel.send({
        content,
        reply: { messageReference: target.id, failIfNotExists: true },
        allowedMentions: {
          parse: [],
          users: [target.author.id],
          repliedUser: true,
        },
        nonce: nonce(`${key}:reply`),
        enforceNonce: true,
      });
    })().catch((err) =>
      logger.warn(
        { err, channelId: channel.id },
        'Falha na resposta da resenha',
      ),
    );
  }, 5000).unref();
  timers.set(key, { channelId: channel.id, timer });
}

export async function reactToNotice(
  { db, client }: Context,
  sourceChannel: GuildTextBasedChannel,
  notice: {
    id: string;
    kind: string;
    subscriptionId: string;
    revision: string;
    eventId?: string | null;
    content?: string;
  },
  teamId: string,
) {
  if (
    teamId !== '2026' ||
    (notice.kind !== 'goal' && notice.kind !== 'conceded')
  )
    return;
  const subscriptionWhere = {
    id: notice.subscriptionId,
    revision: notice.revision,
    enabled: true,
  };
  const subscription = await db.goalSubscription.findFirst({
    where: subscriptionWhere,
  });
  if (!subscription) return;
  const settings = await db.goalBanter.findMany({
    where: { guildId: subscription.guildId, enabled: true },
  });
  for (const setting of settings) {
    try {
      const channel =
        setting.channelId === sourceChannel.id
          ? sourceChannel
          : await client.channels.fetch(setting.channelId);
      if (
        !channel ||
        !channel.isTextBased() ||
        !('send' in channel) ||
        !('guildId' in channel) ||
        channel.guildId !== subscription.guildId
      )
        continue;
      const stillEnabled = async () => {
        const current = await db.goalBanter.findUnique({
          where: { channelId: setting.channelId },
        });
        return !!(
          current?.enabled &&
          current.guildId === subscription.guildId &&
          (await db.goalSubscription.findFirst({ where: subscriptionWhere }))
        );
      };
      if (!(await stillEnabled())) continue;
      const eventKey =
        notice.eventId && notice.content
          ? `${notice.eventId}:${notice.kind}:${notice.content}`
          : notice.id;
      await sendBanter(
        channel,
        notice.kind,
        `${setting.channelId}:${eventKey}`,
        { stillEnabled },
      );
    } catch (err) {
      logger.warn(
        { err, channelId: setting.channelId },
        'Falha ao enviar resenha no canal configurado',
      );
    }
  }
}
