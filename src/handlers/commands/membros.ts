import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../core/types.js';
import { UserError } from '../../core/errors.js';
import { TRICORD_NAME, TRICORD_RED } from '../../core/brand.js';
import { getGuildMemberStats } from '../../modules/guild/stats.js';

const number = (value: number) => value.toLocaleString('pt-BR');

export default {
  data: new SlashCommandBuilder()
    .setName('membros')
    .setDescription('Mostra membros atuais, banidos e o potencial do servidor')
    .setDMPermission(false),
  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) throw new UserError('Use este comando dentro de um servidor.');
    if (!interaction.appPermissions?.has(PermissionFlagsBits.BanMembers))
      throw new UserError(
        'Preciso da permissão Banir membros para consultar a quantidade de usuários banidos.',
      );

    await interaction.deferReply();

    let stats;
    try {
      stats = await getGuildMemberStats(guild);
    } catch {
      throw new UserError(
        'Não consegui consultar os banimentos do servidor. Verifique a permissão Banir membros e tente novamente.',
      );
    }

    const icon = guild.iconURL({ size: 256 });
    const banner = guild.bannerURL({ size: 1024 });
    const embed = new EmbedBuilder()
      .setColor(TRICORD_RED)
      .setTitle('MEMBROS DO SERVIDOR')
      .setDescription(
        `**Membros atuais**\n${number(stats.current)}\n\n` +
          `**Usuários banidos**\n${number(stats.banned)}\n\n` +
          `**Potencial sem banimentos**\n${number(stats.potential)}\n\n` +
          '-# Cenário hipotético: todos os usuários banidos voltariam ao servidor.',
      )
      .setFooter({
        text: `${TRICORD_NAME} • ${guild.name}`,
        ...(icon ? { iconURL: icon } : {}),
      })
      .setTimestamp();

    if (icon) embed.setThumbnail(icon);
    if (banner) embed.setImage(banner);

    await interaction.editReply({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  },
} satisfies Command;
