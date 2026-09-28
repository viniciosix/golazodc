import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../core/types.js';
import { UserError } from '../../core/errors.js';
import { TRICORD_NAME, TRICORD_RED } from '../../core/brand.js';
import { fetchGuildBanIds } from '../../modules/guild/stats.js';

export default {
  data: new SlashCommandBuilder()
    .setName('desbanir-todos')
    .setDescription('Remove todos os banimentos do servidor após confirmação')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild || !interaction.guildId)
      throw new UserError('Use este comando dentro de um servidor.');
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
      throw new UserError('Apenas administradores podem usar este comando.');
    if (!interaction.appPermissions?.has(PermissionFlagsBits.BanMembers))
      throw new UserError(
        'Preciso da permissão Banir membros para remover os banimentos.',
      );

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let total: number;
    try {
      total = (await fetchGuildBanIds(guild)).length;
    } catch {
      throw new UserError(
        'Não consegui consultar os banimentos. Verifique a permissão Banir membros e tente novamente.',
      );
    }

    const icon = guild.iconURL({ size: 256 });
    const embed = new EmbedBuilder()
      .setColor(TRICORD_RED)
      .setTitle('REMOVER TODOS OS BANIMENTOS')
      .setDescription(
        total === 0
          ? 'Este servidor não possui usuários banidos.'
          : `Foram encontrados **${total.toLocaleString('pt-BR')} usuários banidos**.\n\nAo confirmar, todos serão desbanidos e poderão entrar novamente no servidor.`,
      )
      .setFooter({
        text: `${TRICORD_NAME} • ${guild.name}`,
        ...(icon ? { iconURL: icon } : {}),
      });

    if (icon) embed.setThumbnail(icon);

    await interaction.editReply({
      embeds: [embed],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(
              `unban-all:confirm:${interaction.guildId}:${interaction.user.id}`,
            )
            .setLabel('CONFIRMAR DESBANIMENTO')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(total === 0),
          new ButtonBuilder()
            .setCustomId(
              `unban-all:cancel:${interaction.guildId}:${interaction.user.id}`,
            )
            .setLabel('CANCELAR')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(total === 0),
        ),
      ],
      allowedMentions: { parse: [] },
    });
  },
} satisfies Command;
