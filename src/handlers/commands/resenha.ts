import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../core/types.js';
import { UserError } from '../../core/errors.js';
import { cancelBanter, sendBanter } from '../../modules/football/banter.js';

export default {
  data: new SlashCommandBuilder()
    .setName('resenha')
    .setDescription('Comemorações e zoeira do TRICORD neste chat')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('ligar')
        .setDescription(
          'Ativa as frases e respostas após gols do São Paulo neste chat',
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('desligar')
        .setDescription(
          'Desativa a resenha e cancela respostas pendentes neste chat',
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('teste')
        .setDescription('Testa as frases sem partida ao vivo')
        .addStringOption((o) =>
          o
            .setName('lance')
            .setDescription('Gol para simular')
            .setRequired(true)
            .addChoices(
              { name: 'Gol São Paulo', value: 'goal' },
              { name: 'Gol adversário', value: 'conceded' },
            ),
        ),
    ),
  async execute(interaction, { db }) {
    if (
      !interaction.guildId ||
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    )
      throw new UserError(
        'Você precisa de Gerenciar servidor para configurar ou testar a resenha.',
      );
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const action = interaction.options.getSubcommand();
    if (action === 'desligar') {
      await db.goalBanter.upsert({
        where: { channelId: interaction.channelId },
        create: {
          channelId: interaction.channelId,
          guildId: interaction.guildId,
          enabled: false,
        },
        update: { enabled: false },
      });
      cancelBanter(interaction.channelId);
      await interaction.editReply(
        'Resenha desligada e respostas pendentes canceladas neste chat.',
      );
      return;
    }
    const channel = interaction.channel;
    if (
      !channel ||
      channel.isDMBased() ||
      !channel.isTextBased() ||
      !('send' in channel) ||
      !interaction.appPermissions?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        channel.isThread()
          ? PermissionFlagsBits.SendMessagesInThreads
          : PermissionFlagsBits.SendMessages,
      ])
    )
      throw new UserError(
        'Preciso de Ver canal, Ler histórico e Enviar mensagens neste chat.',
      );
    if (action === 'teste') {
      const kind = interaction.options.getString('lance', true);
      if (kind !== 'goal' && kind !== 'conceded')
        throw new UserError('Lance inválido.');
      await sendBanter(channel, kind, `test:${interaction.id}`, { test: true });
      await interaction.editReply(
        kind === 'goal'
          ? 'Comemoração de teste enviada! Em 5 segundos, respondo a uma mensagem humana dos últimos 15 minutos (entre as últimas 50). Se não houver nenhuma, não envio a resposta.'
          : 'Reação de teste ao gol adversário enviada. Não haverá resposta a uma pessoa.',
      );
      return;
    }
    await db.goalBanter.upsert({
      where: { channelId: interaction.channelId },
      create: {
        channelId: interaction.channelId,
        guildId: interaction.guildId,
      },
      update: { enabled: true },
    });
    await interaction.editReply(
      'Resenha ligada neste chat! A narração pode ficar em outro canal deste servidor: use /gols ligar para o São Paulo no canal de jogos. Gol nosso: comemoração e resposta após 5 segundos. Gol adversário: só a reclamação.',
    );
  },
} satisfies Command;
