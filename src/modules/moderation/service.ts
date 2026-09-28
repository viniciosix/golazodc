import {
  EmbedBuilder,
  PermissionFlagsBits,
  type Client,
  type Guild,
  type GuildBasedChannel,
  type GuildMember,
} from 'discord.js';
import type { ModerationMute, PrismaClient } from '@prisma/client';
import { TRICORD_NAME, TRICORD_RED } from '../../core/brand.js';
import { logger } from '../../core/logger.js';

const mutePermissions = {
  ViewChannel: false,
  SendMessages: false,
  SendMessagesInThreads: false,
  CreatePublicThreads: false,
  CreatePrivateThreads: false,
  AddReactions: false,
  Connect: false,
  Speak: false,
  Stream: false,
} as const;

export async function getModerationConfig(db: PrismaClient, guildId: string) {
  return db.moderationConfig.upsert({
    where: { guildId },
    create: { guildId },
    update: {},
  });
}

export async function applyMuteOverwrite(
  channel: GuildBasedChannel,
  roleId: string,
) {
  if (channel.isThread() || !('permissionOverwrites' in channel)) return;
  await channel.permissionOverwrites.edit(roleId, mutePermissions, {
    reason: 'Configuração do mute do TRICORD',
  });
}

export async function ensureMuteRole(db: PrismaClient, guild: Guild) {
  const config = await getModerationConfig(db, guild.id);
  let role = config.muteRoleId
    ? guild.roles.cache.get(config.muteRoleId) ||
      (await guild.roles.fetch(config.muteRoleId).catch(() => null))
    : null;

  if (!role) {
    role = await guild.roles.create({
      name: 'TRICORD • Mutado',
      permissions: [],
      reason: 'Cargo automático do sistema de moderação',
    });
    await db.moderationConfig.update({
      where: { guildId: guild.id },
      data: { muteRoleId: role.id },
    });
  }

  const channels = [...guild.channels.cache.values()].filter(
    (channel) => !channel.isThread(),
  );
  for (const channel of channels)
    await applyMuteOverwrite(channel, role.id).catch((error) =>
      logger.warn(
        { err: error, guildId: guild.id, channelId: channel.id },
        'Falha ao esconder canal do cargo mutado',
      ),
    );
  return role;
}

export async function muteMember(
  db: PrismaClient,
  member: GuildMember,
  moderatorId: string,
  reason: string,
  duration?: number,
) {
  const existing = await db.moderationMute.findFirst({
    where: { guildId: member.guild.id, userId: member.id, active: true },
  });
  if (existing) throw new Error('ALREADY_MUTED');
  if (
    !member.manageable ||
    member.id === member.guild.ownerId ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  )
    throw new Error('NOT_MANAGEABLE');

  const role = await ensureMuteRole(db, member.guild);
  const roleIds = member.roles.cache
    .filter((current) => current.id !== member.guild.id && !current.managed)
    .map((current) => current.id);
  const expiresAt = duration ? new Date(Date.now() + duration) : null;

  if (roleIds.length) await member.roles.remove(roleIds, reason);
  await member.roles.add(role, reason);
  if (expiresAt && duration! <= 28 * 86_400_000)
    await member.timeout(duration!, reason).catch(() => undefined);

  try {
    return await db.moderationMute.create({
      data: {
        guildId: member.guild.id,
        userId: member.id,
        moderatorId,
        reason,
        roleIds,
        expiresAt,
      },
    });
  } catch (error) {
    await member.roles.remove(role).catch(() => undefined);
    const restorable = roleIds.filter((id) => member.guild.roles.cache.has(id));
    if (restorable.length)
      await member.roles.add(restorable).catch(() => undefined);
    throw error;
  }
}

export async function unmuteRecord(
  db: PrismaClient,
  guild: Guild,
  record: ModerationMute,
  reason: string,
) {
  const member = await guild.members.fetch(record.userId).catch(() => null);
  const config = await getModerationConfig(db, guild.id);
  if (member) {
    if (config.muteRoleId && member.roles.cache.has(config.muteRoleId))
      await member.roles
        .remove(config.muteRoleId, reason)
        .catch(() => undefined);
    const roles = record.roleIds.filter((id) => {
      const role = guild.roles.cache.get(id);
      return role && !role.managed && role.editable;
    });
    if (roles.length) await member.roles.add(roles, reason);
    await member.timeout(null, reason).catch(() => undefined);
  }
  await db.moderationMute.update({
    where: { id: record.id },
    data: { active: false, endedAt: new Date() },
  });
  return member;
}

export async function unmuteMember(
  db: PrismaClient,
  guild: Guild,
  userId: string,
  reason: string,
) {
  const record = await db.moderationMute.findFirst({
    where: { guildId: guild.id, userId, active: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return null;
  await unmuteRecord(db, guild, record, reason);
  return record;
}

export async function sendModerationLog(
  db: PrismaClient,
  client: Client,
  guild: Guild,
  title: string,
  description: string,
) {
  const config = await db.moderationConfig.findUnique({
    where: { guildId: guild.id },
  });
  if (!config?.logChannelId) return;
  const channel = await client.channels
    .fetch(config.logChannelId)
    .catch(() => null);
  if (
    !channel?.isSendable() ||
    !('guildId' in channel) ||
    channel.guildId !== guild.id
  )
    return;
  await channel
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(TRICORD_RED)
          .setTitle(title)
          .setDescription(description)
          .setFooter({ text: `${TRICORD_NAME} • Moderação` })
          .setTimestamp(),
      ],
      allowedMentions: { parse: [] },
    })
    .catch((error) =>
      logger.warn({ err: error, guildId: guild.id }, 'Falha no modlog'),
    );
}

export function startModerationWorker(context: {
  db: PrismaClient;
  client: Client;
}) {
  let stopped = false;
  let running = false;
  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const expired = await context.db.moderationMute.findMany({
        where: { active: true, expiresAt: { lte: new Date() } },
        take: 50,
      });
      for (const record of expired) {
        const guild = await context.client.guilds
          .fetch(record.guildId)
          .catch(() => null);
        if (!guild) {
          await context.db.moderationMute.update({
            where: { id: record.id },
            data: { active: false, endedAt: new Date() },
          });
          continue;
        }
        await unmuteRecord(
          context.db,
          guild,
          record,
          'Mute temporário encerrado',
        ).catch((error) =>
          logger.warn(
            { err: error, guildId: record.guildId, userId: record.userId },
            'Falha no unmute automático',
          ),
        );
      }
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), 30_000);
  timer.unref();
  void tick();
  return async () => {
    stopped = true;
    clearInterval(timer);
    while (running) await new Promise((resolve) => setTimeout(resolve, 20));
  };
}
