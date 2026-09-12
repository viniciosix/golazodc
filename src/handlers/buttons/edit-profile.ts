import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type { Button } from '../../core/types.js';
export default {
  id: 'edit-profile',
  async execute(interaction) {
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId('profile-bio')
        .setTitle('Sua bio')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('bio')
              .setLabel('Sobre seu clube')
              .setStyle(TextInputStyle.Paragraph)
              .setMaxLength(200)
              .setRequired(false),
          ),
        ),
    );
  },
} satisfies Button;
