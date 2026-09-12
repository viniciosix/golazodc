import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../core/types.js';
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
    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle('Perfil • Golazo')
      .setDescription(user.bio || 'Seu clube começa aqui!')
      .addFields(
        { name: 'Colecionador', value: user.displayName },
        { name: 'Cartas', value: String(user.cards), inline: true },
        { name: 'Moedas', value: user.coins.toString(), inline: true },
      );
    await interaction.editReply({
      embeds: [embed],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('edit-profile')
            .setLabel('Editar bio')
            .setStyle(ButtonStyle.Primary),
        ),
      ],
      allowedMentions: { parse: [] },
    });
  },
} satisfies Command;
