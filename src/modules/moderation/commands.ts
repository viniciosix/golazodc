import {
  EmbedBuilder,
  PermissionFlagsBits,
  type GuildMember,
  type Message,
  type PermissionsString,
} from 'discord.js';
import type { Context } from '../../core/types.js';
import { TRICORD_NAME, TRICORD_RED } from '../../core/brand.js';
import { logger } from '../../core/logger.js';
import {
  censorFilteredWords,
  normalizeModerationText,
  parseDuration,
  parsePrefixCommand,
} from './parser.js';
import { muteMember, sendModerationLog, unmuteMember } from './service.js';
import { repostCensoredMessage } from './filter-webhook.js';

const commands = new Set([
  'ajuda',
  'mod',
  'ban',
  'kick',
  'mute',
  'unmute',
  'avisar',
  'avisos',
  'limparavisos',
  'limpar',
  'clear',
  'trancar',
  'lock',
  'destrancar',
  'unlock',
  'slowmode',
  'palavra',
  'filtro',
  'modlog',
]);

const help = [
  '` .ban @usuário [motivo] ` — bane um membro',
  '` .kick @usuário [motivo] ` — expulsa um membro',
  '` .mute @usuário [10m|2h|1d] [motivo] ` — oculta todos os canais',
  '` .unmute @usuário ` — restaura os cargos e a visualização',
  '` .avisar @usuário <motivo> ` — registra um aviso',
  '` .avisos @usuário ` — consulta os avisos',
  '` .limparavisos @usuário ` — apaga os avisos',
  '` .limpar <1-100> ` — apaga mensagens',
  '` .trancar ` / ` .destrancar ` — controla o canal atual',
  '` .slowmode <0-21600> ` — define o modo lento em segundos',
  '` .palavra adicionar <texto> ` — adiciona palavra ou frase',
  '` .palavra remover <texto> ` — remove palavra ou frase',
  '` .palavra listar ` — mostra o filtro atual',
  '` .filtro ligar ` / ` .filtro desligar ` — controla o filtro',
  '` .modlog #canal ` / ` .modlog desligar ` — configura os logs',
].map((line) => line.replaceAll('` .', '`.'));

const moderationEmbed = (
  message: Message<true>,
  title: string,
  text: string,
) => {
  const icon = message.guild.iconURL({ size: 256 });
  const embed = new EmbedBuilder()
    .setColor(TRICORD_RED)
    .setTitle(title)
    .setDescription(text)
    .setFooter({
      text: `${TRICORD_NAME} • ${message.guild.name}`,
      ...(icon ? { iconURL: icon } : {}),
    })
    .setTimestamp();
  if (icon) embed.setThumbnail(icon);
  return embed;
};

const reply = async (message: Message<true>, title: string, text: string) =>
  message.reply({
    embeds: [moderationEmbed(message, title, text)],
    allowedMentions: { parse: [], repliedUser: false },
  });

const requirePermission = (
  message: Message<true>,
  permission: PermissionsString,
) => {
  if (!message.member?.permissions.has(permission))
    throw new Error('Você não tem permissão para usar este comando.');
};

async function resolveMember(message: Message<true>, value?: string) {
  const mentioned = message.mentions.members?.first();
  if (mentioned) return mentioned;
  const id = value?.replace(/[<@!>]/g, '');
  if (!id || !/^\d{17,20}$/.test(id)) return null;
  return message.guild.members.fetch(id).catch(() => null);
}

const assertTarget = (message: Message<true>, member: GuildMember | null) => {
  if (!member) throw new Error('Informe um membro válido.');
  if (member.id === message.author.id)
    throw new Error('Você não pode aplicar esta ação em si mesmo.');
  if (member.id === message.guild.ownerId)
    throw new Error('O dono do servidor não pode receber esta ação.');
  return member;
};

const durationLabel = (milliseconds?: number) => {
  if (!milliseconds) return 'indeterminado';
  const minutes = Math.ceil(milliseconds / 60_000);
  if (minutes < 60) return `${minutes} minuto(s)`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} hora(s)`;
  return `${Math.ceil(hours / 24)} dia(s)`;
};

async function logAction(
  message: Message<true>,
  context: Context,
  title: string,
  description: string,
) {
  await sendModerationLog(
    context.db,
    context.client,
    message.guild,
    title,
    `${description}\n**Moderador:** ${message.author.tag} (${message.author.id})`,
  );
}

async function executeCommand(
  message: Message<true>,
  context: Context,
  name: string,
  args: string[],
) {
  if (name === 'ajuda' || name === 'mod') {
    requirePermission(message, 'ManageMessages');
    await reply(message, 'MODERAÇÃO', help.join('\n'));
    return;
  }

  if (name === 'ban' || name === 'kick') {
    requirePermission(message, name === 'ban' ? 'BanMembers' : 'KickMembers');
    const member = assertTarget(message, await resolveMember(message, args[0]));
    const reason = args.slice(1).join(' ') || 'Sem motivo informado';
    if (name === 'ban') {
      if (!member.bannable) throw new Error('Não consigo banir esse membro.');
      await member.ban({ reason });
      await reply(message, 'MEMBRO BANIDO', `${member.user.tag}\n${reason}`);
      await logAction(
        message,
        context,
        'MEMBRO BANIDO',
        `${member.user.tag}\n${reason}`,
      );
    } else {
      if (!member.kickable)
        throw new Error('Não consigo expulsar esse membro.');
      await member.kick(reason);
      await reply(message, 'MEMBRO EXPULSO', `${member.user.tag}\n${reason}`);
      await logAction(
        message,
        context,
        'MEMBRO EXPULSO',
        `${member.user.tag}\n${reason}`,
      );
    }
    return;
  }

  if (name === 'mute') {
    requirePermission(message, 'ModerateMembers');
    const member = assertTarget(message, await resolveMember(message, args[0]));
    const duration = parseDuration(args[1]);
    const reason =
      args.slice(duration ? 2 : 1).join(' ') || 'Sem motivo informado';
    try {
      await muteMember(context.db, member, message.author.id, reason, duration);
    } catch (error) {
      if (error instanceof Error && error.message === 'ALREADY_MUTED')
        throw new Error('Esse membro já está mutado.');
      if (error instanceof Error && error.message === 'NOT_MANAGEABLE')
        throw new Error('Não consigo gerenciar esse membro ou seus cargos.');
      throw error;
    }
    const text = `${member.user.tag}\n**Duração:** ${durationLabel(duration)}\n**Motivo:** ${reason}`;
    await reply(message, 'MEMBRO MUTADO', text);
    await logAction(message, context, 'MEMBRO MUTADO', text);
    return;
  }

  if (name === 'unmute') {
    requirePermission(message, 'ModerateMembers');
    const member = assertTarget(message, await resolveMember(message, args[0]));
    const record = await unmuteMember(
      context.db,
      message.guild,
      member.id,
      `Unmute solicitado por ${message.author.tag}`,
    );
    if (!record) throw new Error('Esse membro não possui um mute ativo.');
    await reply(message, 'MUTE REMOVIDO', member.user.tag);
    await logAction(message, context, 'MUTE REMOVIDO', member.user.tag);
    return;
  }

  if (name === 'avisar') {
    requirePermission(message, 'ManageMessages');
    const member = assertTarget(message, await resolveMember(message, args[0]));
    const reason = args.slice(1).join(' ');
    if (!reason) throw new Error('Informe o motivo do aviso.');
    const warning = await context.db.moderationWarning.create({
      data: {
        guildId: message.guild.id,
        userId: member.id,
        moderatorId: message.author.id,
        reason: reason.slice(0, 1000),
      },
    });
    await reply(
      message,
      'AVISO REGISTRADO',
      `${member.user.tag}\n${warning.reason}`,
    );
    await logAction(
      message,
      context,
      'AVISO REGISTRADO',
      `${member.user.tag}\n${warning.reason}`,
    );
    return;
  }

  if (name === 'avisos') {
    requirePermission(message, 'ManageMessages');
    const member = assertTarget(message, await resolveMember(message, args[0]));
    const warnings = await context.db.moderationWarning.findMany({
      where: { guildId: message.guild.id, userId: member.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const text = warnings.length
      ? warnings
          .map(
            (warning, index) =>
              `**${index + 1}.** ${warning.reason}\n-# <t:${Math.floor(warning.createdAt.getTime() / 1000)}:f> • moderador ${warning.moderatorId}`,
          )
          .join('\n\n')
      : 'Nenhum aviso registrado para este membro.';
    await reply(message, `AVISOS • ${member.user.tag}`, text);
    return;
  }

  if (name === 'limparavisos') {
    requirePermission(message, 'ManageGuild');
    const member = assertTarget(message, await resolveMember(message, args[0]));
    const removed = await context.db.moderationWarning.deleteMany({
      where: { guildId: message.guild.id, userId: member.id },
    });
    await reply(
      message,
      'AVISOS REMOVIDOS',
      `${member.user.tag}\n${removed.count.toLocaleString('pt-BR')} aviso(s) apagado(s).`,
    );
    return;
  }

  if (name === 'limpar' || name === 'clear') {
    requirePermission(message, 'ManageMessages');
    const amount = Number(args[0]);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100)
      throw new Error('Informe uma quantidade entre 1 e 100.');
    if (!('bulkDelete' in message.channel))
      throw new Error('Este canal não permite limpeza em massa.');
    const deleted = await message.channel.bulkDelete(amount, true);
    const notice = await message.channel.send({
      embeds: [
        moderationEmbed(
          message,
          'MENSAGENS APAGADAS',
          `${deleted.size.toLocaleString('pt-BR')} mensagem(ns) removida(s).`,
        ),
      ],
    });
    setTimeout(() => void notice.delete().catch(() => undefined), 5000).unref();
    return;
  }

  if (['trancar', 'lock', 'destrancar', 'unlock'].includes(name)) {
    requirePermission(message, 'ManageChannels');
    if (!('permissionOverwrites' in message.channel))
      throw new Error('Este canal não permite alteração de permissões.');
    const lock = name === 'trancar' || name === 'lock';
    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      { SendMessages: lock ? false : null },
      {
        reason: `Canal ${lock ? 'trancado' : 'destrancado'} por ${message.author.tag}`,
      },
    );
    await reply(
      message,
      lock ? 'CANAL TRANCADO' : 'CANAL DESTRANCADO',
      `${message.channel}`,
    );
    return;
  }

  if (name === 'slowmode') {
    requirePermission(message, 'ManageChannels');
    const seconds = Number(args[0]);
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21_600)
      throw new Error('Informe um valor entre 0 e 21600 segundos.');
    if (!('setRateLimitPerUser' in message.channel))
      throw new Error('Este canal não aceita modo lento.');
    await message.channel.setRateLimitPerUser(
      seconds,
      `Alterado por ${message.author.tag}`,
    );
    await reply(
      message,
      'MODO LENTO ATUALIZADO',
      seconds === 0 ? 'Modo lento desativado.' : `${seconds} segundo(s).`,
    );
    return;
  }

  if (name === 'palavra') {
    requirePermission(message, 'ManageGuild');
    const action = args[0]?.toLocaleLowerCase('pt-BR');
    if (action === 'listar') {
      const words = await context.db.moderationWord.findMany({
        where: { guildId: message.guild.id },
        orderBy: { value: 'asc' },
      });
      await reply(
        message,
        'PALAVRAS BLOQUEADAS',
        words.length
          ? words
              .map((word) => `• ${word.value}`)
              .join('\n')
              .slice(0, 4000)
          : 'Nenhuma palavra ou frase configurada.',
      );
      return;
    }
    const value = args.slice(1).join(' ').trim().slice(0, 100);
    const normalized = normalizeModerationText(value);
    if (!normalized) throw new Error('Informe uma palavra ou frase válida.');
    if (action === 'adicionar') {
      const exists = await context.db.moderationWord.findUnique({
        where: {
          guildId_normalized: { guildId: message.guild.id, normalized },
        },
      });
      if (exists) throw new Error('Essa palavra ou frase já está na lista.');
      await context.db.moderationWord.create({
        data: { guildId: message.guild.id, value, normalized },
      });
      await context.cache.delete(`moderation:filter:${message.guild.id}`);
      await reply(message, 'PALAVRA ADICIONADA', value);
      return;
    }
    if (action === 'remover') {
      const removed = await context.db.moderationWord.deleteMany({
        where: { guildId: message.guild.id, normalized },
      });
      if (!removed.count)
        throw new Error('Essa palavra ou frase não está na lista.');
      await context.cache.delete(`moderation:filter:${message.guild.id}`);
      await reply(message, 'PALAVRA REMOVIDA', value);
      return;
    }
    throw new Error(
      'Use `.palavra adicionar`, `.palavra remover` ou `.palavra listar`.',
    );
  }

  if (name === 'filtro') {
    requirePermission(message, 'ManageGuild');
    const enabled =
      args[0] === 'ligar' ? true : args[0] === 'desligar' ? false : null;
    if (enabled === null)
      throw new Error('Use `.filtro ligar` ou `.filtro desligar`.');
    await context.db.moderationConfig.upsert({
      where: { guildId: message.guild.id },
      create: { guildId: message.guild.id, filterEnabled: enabled },
      update: { filterEnabled: enabled },
    });
    await context.cache.delete(`moderation:filter:${message.guild.id}`);
    await reply(
      message,
      enabled ? 'FILTRO LIGADO' : 'FILTRO DESLIGADO',
      enabled
        ? 'Mensagens com palavras configuradas serão removidas.'
        : 'O filtro de palavras está pausado.',
    );
    return;
  }

  if (name === 'modlog') {
    requirePermission(message, 'ManageGuild');
    const disabled = args[0] === 'desligar';
    const channel = disabled ? null : message.mentions.channels.first();
    if (!disabled && (!channel || !channel.isSendable()))
      throw new Error(
        'Informe um canal de texto válido ou use `.modlog desligar`.',
      );
    await context.db.moderationConfig.upsert({
      where: { guildId: message.guild.id },
      create: {
        guildId: message.guild.id,
        logChannelId: channel?.id,
      },
      update: { logChannelId: channel?.id || null },
    });
    await reply(
      message,
      'MODLOG ATUALIZADO',
      channel
        ? `Os registros serão enviados em ${channel}.`
        : 'Logs desativados.',
    );
  }
}

async function applyWordFilter(message: Message<true>, context: Context) {
  if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
    return;
  const key = `moderation:filter:${message.guild.id}`;
  let filter = await context.cache.get<{ enabled: boolean; words: string[] }>(
    key,
  );
  if (!filter) {
    const config = await context.db.moderationConfig.findUnique({
      where: { guildId: message.guild.id },
    });
    const words = await context.db.moderationWord.findMany({
      where: { guildId: message.guild.id },
      select: { normalized: true },
    });
    filter = {
      enabled: config?.filterEnabled ?? true,
      words: words.map((word) => word.normalized),
    };
    await context.cache.set(key, filter, 60);
  }
  if (!filter.enabled) return;
  const censored = censorFilteredWords(message.content, filter.words);
  if (!censored.matches.length) return;
  await repostCensoredMessage(message, censored.content);
  await sendModerationLog(
    context.db,
    context.client,
    message.guild,
    'MENSAGEM FILTRADA',
    `**Usuário:** ${message.author.tag} (${message.author.id})\n**Canal:** ${message.channel}\n**Regra(s):** ${censored.matches.join(', ')}`,
  );
}

export async function handleModerationMessage(
  message: Message,
  context: Context,
) {
  if (!message.inGuild() || message.author.bot || message.webhookId) return;
  const parsed = parsePrefixCommand(message.content);
  if (parsed && commands.has(parsed.name)) {
    try {
      await executeCommand(message, context, parsed.name, parsed.args);
    } catch (error) {
      logger.warn(
        { err: error, guildId: message.guild.id, command: parsed.name },
        'Falha em comando de moderação',
      );
      await reply(
        message,
        'NÃO FOI POSSÍVEL CONCLUIR',
        error instanceof Error
          ? error.message
          : 'Tente novamente em instantes.',
      ).catch(() => undefined);
    }
    return;
  }
  await applyWordFilter(message, context).catch((error) =>
    logger.warn(
      { err: error, guildId: message.guild.id },
      'Falha no filtro de palavras',
    ),
  );
}
