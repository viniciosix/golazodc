import 'dotenv/config';
import {
  ChannelType,
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  type GuildBasedChannel,
  type PermissionOverwriteOptions,
} from 'discord.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CONFIG = {
  guildId: process.env.DISCORD_GUILD_ID,
  token: process.env.DISCORD_TOKEN,
  staffRoleName: 'Staff',
  directorRoleId: '1371618557401497727',
  directorUserId: '1527063003835666624',
  removeRoleUserIds: [
    '1165831719593721970',
    '434345319325499392',
    '1196581413395378220',
    '562372966982352917',
  ],
};

const confirmed = process.argv.includes('--confirm');

if (!CONFIG.token || !CONFIG.guildId) {
  throw new Error('Defina DISCORD_TOKEN e DISCORD_GUILD_ID no arquivo .env.');
}

if (!confirmed) {
  console.log('Modo de segurança: nenhuma alteração foi feita.');
  console.log('Revise o plano e execute novamente com --confirm para aplicar.');
  process.exit(0);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const sendDeny: PermissionOverwriteOptions = {
  SendMessages: false,
  SendMessagesInThreads: false,
  CreatePublicThreads: false,
  CreatePrivateThreads: false,
};

async function main(): Promise<void> {
  await client.login(CONFIG.token);

  try {
    const guild = await client.guilds.fetch(CONFIG.guildId!);
    await guild.roles.fetch();
    await guild.channels.fetch();

    const botMember = await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      throw new Error('O bot precisa da permissão Gerenciar Cargos.');
    }
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      throw new Error('O bot precisa da permissão Gerenciar Canais.');
    }

    const staffRoles = guild.roles.cache.filter(
      (role) => role.name === CONFIG.staffRoleName,
    );
    if (staffRoles.size !== 1) {
      throw new Error(
        `Esperava encontrar exatamente um cargo Staff; encontrei ${staffRoles.size}.`,
      );
    }
    const staffRole = staffRoles.first()!;
    const directorRole = await guild.roles.fetch(CONFIG.directorRoleId);
    if (!directorRole) throw new Error('Cargo Diretor não encontrado.');
    if (!directorRole.editable) {
      throw new Error('O cargo Diretor está acima do bot ou não é gerenciável.');
    }

    const targetMembers = [];
    for (const userId of CONFIG.removeRoleUserIds) {
      targetMembers.push(await guild.members.fetch(userId));
    }
    const directorMember = await guild.members.fetch(CONFIG.directorUserId);

    for (const member of targetMembers) {
      const unmanageable = member.roles.cache.filter(
        (role) => role.id !== guild.id && !role.editable,
      );
      if (unmanageable.size > 0) {
        throw new Error(
          `Não consigo remover todos os cargos de ${member.user.tag}: ${unmanageable.map((r) => r.name).join(', ')}.`,
        );
      }
    }

    const existingChannels = [...guild.channels.cache.values()].filter(
      (channel): channel is GuildBasedChannel =>
        'permissionOverwrites' in channel &&
        !channel.isThread() &&
        channel.name !== 'comunicado',
    );

    if (guild.channels.cache.some((channel) => channel.name === 'comunicado')) {
      throw new Error(
        'Já existe um canal chamado comunicado. Renomeie-o ou remova-o antes de executar.',
      );
    }

    const botId = client.user!.id;
    const channelPlans = existingChannels.map((channel) => {
      const current = channel.permissionOverwrites.cache;
      const plannedIds = new Set([
        ...current.keys(),
        guild.id,
        staffRole.id,
        directorMember.id,
        botId,
      ]);
      if (plannedIds.size > 100) {
        throw new Error(
          `O canal #${channel.name} excederia o limite de 100 sobrescritas de permissão.`,
        );
      }
      return channel;
    });

    const comunicadoRoleIds = guild.roles.cache
      .filter(
        (role) =>
          role.id === staffRole.id ||
          role.permissions.has(PermissionFlagsBits.SendMessages) ||
          role.permissions.has(PermissionFlagsBits.SendMessagesInThreads) ||
          role.permissions.has(PermissionFlagsBits.CreatePublicThreads) ||
          role.permissions.has(PermissionFlagsBits.CreatePrivateThreads),
      )
      .map((role) => role.id)
      .filter((id) => id !== guild.id);
    const comunicadoOverwriteIds = new Set([
      guild.id,
      ...comunicadoRoleIds,
      directorMember.id,
      botId,
    ]);
    if (comunicadoOverwriteIds.size > 100) {
      throw new Error(
        'O canal #comunicado precisaria de mais de 100 sobrescritas para restringir o envio. Nenhuma alteração foi feita.',
      );
    }

    const backup = {
      createdAt: new Date().toISOString(),
      guildId: guild.id,
      removedMemberRoles: targetMembers.map((member) => ({
        userId: member.id,
        username: member.user.tag,
        roleIds: member.roles.cache
          .filter((role) => role.id !== guild.id)
          .map((role) => role.id),
      })),
      channels: channelPlans.map((channel) => ({
        id: channel.id,
        name: channel.name,
        overwrites: channel.permissionOverwrites.cache.map((overwrite) => ({
          id: overwrite.id,
          type: overwrite.type,
          allow: overwrite.allow.bitfield.toString(),
          deny: overwrite.deny.bitfield.toString(),
        })),
      })),
    };

    await mkdir(join(process.cwd(), 'backups'), { recursive: true });
    const backupPath = join(
      process.cwd(),
      'backups',
      `server-reset-${Date.now()}.json`,
    );
    await writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf8');
    console.log(`Backup salvo em: ${backupPath}`);

    for (const member of targetMembers) {
      const roleIds = member.roles.cache
        .filter((role) => role.id !== guild.id)
        .map((role) => role.id);
      if (roleIds.length > 0) await member.roles.remove(roleIds);
      console.log(`Cargos removidos: ${member.user.tag}`);
    }

    if (!directorMember.roles.cache.has(directorRole.id)) {
      await directorMember.roles.add(directorRole);
    }
    console.log('Cargo Diretor atribuído ao usuário definido.');

    for (const channel of channelPlans) {
      const overwriteIds = new Set(channel.permissionOverwrites.cache.keys());
      for (const id of overwriteIds) {
        if (id === staffRole.id || id === directorMember.id || id === botId) {
          await channel.permissionOverwrites.edit(id, {
            ViewChannel: true,
          });
        } else {
          await channel.permissionOverwrites.edit(id, {
            ViewChannel: false,
          });
        }
      }

      await channel.permissionOverwrites.edit(guild.id, {
        ViewChannel: false,
      });
      await channel.permissionOverwrites.edit(staffRole.id, {
        ViewChannel: true,
      });
      await channel.permissionOverwrites.edit(directorMember.id, {
        ViewChannel: true,
      });
      await channel.permissionOverwrites.edit(botId, {
        ViewChannel: true,
      });
      console.log(`Acesso ajustado: #${channel.name}`);
    }

    const comunicadoOverwrites = [
      {
        id: guild.id,
        allow: [PermissionFlagsBits.ViewChannel],
        deny: [
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.SendMessagesInThreads,
          PermissionFlagsBits.CreatePublicThreads,
          PermissionFlagsBits.CreatePrivateThreads,
        ],
      },
      {
        id: staffRole.id,
        allow: [PermissionFlagsBits.ViewChannel],
        deny: [
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.SendMessagesInThreads,
          PermissionFlagsBits.CreatePublicThreads,
          PermissionFlagsBits.CreatePrivateThreads,
        ],
      },
      {
        id: directorMember.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
        ],
        deny: [
          PermissionFlagsBits.SendMessagesInThreads,
          PermissionFlagsBits.CreatePublicThreads,
          PermissionFlagsBits.CreatePrivateThreads,
        ],
      },
      {
        id: botId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
        ],
        deny: [
          PermissionFlagsBits.SendMessagesInThreads,
          PermissionFlagsBits.CreatePublicThreads,
          PermissionFlagsBits.CreatePrivateThreads,
        ],
      },
    ];

    for (const roleId of comunicadoRoleIds) {
      comunicadoOverwrites.push({
        id: roleId,
        deny: [
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.SendMessagesInThreads,
          PermissionFlagsBits.CreatePublicThreads,
          PermissionFlagsBits.CreatePrivateThreads,
        ],
      });
    }

    const comunicado = await guild.channels.create({
      name: 'comunicado',
      type: ChannelType.GuildText,
      permissionOverwrites: comunicadoOverwrites,
      reason: 'Criação do canal de comunicado restrito',
    });

    console.log(`Canal #${comunicado.name} criado por último.`);
    console.log('Nenhuma mensagem foi enviada ao canal.');
    console.log(
      'ATENÇÃO: cargos com Administrador e o proprietário do servidor ignoram sobrescritas de canal.',
    );
  } finally {
    client.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('Falha ao reorganizar o servidor:', error);
  client.destroy();
  process.exitCode = 1;
});
