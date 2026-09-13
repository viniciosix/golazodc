import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../core/types.js';
import { profileView } from '../../modules/users/view.js';
import { profile } from '../../modules/users/service.js';
export default {
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Veja seu perfil de colecionador'),
  async execute(interaction, { db }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = await profile(
      db,
      interaction.user.id,
      interaction.user.username,
    );
    const guild = interaction.guild
      ? await interaction.guild.fetch().catch(() => interaction.guild)
      : null;
    const embed = profileView(user, interaction.user, guild);
    await interaction.editReply({
      embeds: [embed],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('edit-profile')
            .setLabel('Editar bio')
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
      allowedMentions: { parse: [] },
    });
  },
} satisfies Command;
