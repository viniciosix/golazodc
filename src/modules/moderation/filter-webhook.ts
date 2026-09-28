import {
  type ChannelWebhookCreateOptions,
  type Collection,
  type Message,
  type Webhook,
  WebhookType,
} from 'discord.js';

const WEBHOOK_NAME = 'TRICORD • Filtro';
const cache = new Map<string, Webhook<WebhookType.Incoming>>();

interface WebhookChannel {
  id: string;
  fetchWebhooks(): Promise<
    Collection<
      string,
      Webhook<WebhookType.ChannelFollower | WebhookType.Incoming>
    >
  >;
  createWebhook(
    options: ChannelWebhookCreateOptions,
  ): Promise<Webhook<WebhookType.Incoming>>;
}

function webhookChannel(message: Message<true>) {
  const channel = message.channel.isThread()
    ? message.channel.parent
    : message.channel;
  if (
    !channel ||
    !('fetchWebhooks' in channel) ||
    !('createWebhook' in channel)
  )
    return null;
  return channel as WebhookChannel;
}

async function getFilterWebhook(message: Message<true>) {
  const channel = webhookChannel(message);
  if (!channel)
    throw new Error('Este canal não oferece suporte ao webhook do filtro.');

  const cached = cache.get(channel.id);
  if (cached?.token) return cached;

  const existing = (await channel.fetchWebhooks()).find(
    (webhook) =>
      webhook.isIncoming() &&
      webhook.owner?.id === message.client.user.id &&
      webhook.name === WEBHOOK_NAME,
  );
  const webhook =
    existing?.isIncoming() === true
      ? existing
      : await channel.createWebhook({
          name: WEBHOOK_NAME,
          reason: 'Republicação segura de mensagens censuradas',
        });
  cache.set(channel.id, webhook);
  return webhook;
}

export async function repostCensoredMessage(
  message: Message<true>,
  content: string,
) {
  const webhook = await getFilterWebhook(message);
  await message.delete();
  try {
    await webhook.send({
      content: content || '*mensagem censurada*',
      username:
        message.member?.displayName.slice(0, 80) ||
        message.author.username.slice(0, 80),
      avatarURL: message.author.displayAvatarURL({ size: 256 }),
      allowedMentions: {
        parse: [],
        users: [],
        roles: [],
        repliedUser: false,
      },
      ...(message.channel.isThread() ? { threadId: message.channel.id } : {}),
    });
  } catch (error) {
    cache.delete(webhook.channelId);
    throw error;
  }
}
