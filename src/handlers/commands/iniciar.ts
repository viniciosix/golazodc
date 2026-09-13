import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/types.js';
import { starter } from '../../modules/economy/rewards.js';
import { resultView } from '../../modules/cards/view.js';
export default {
  data: new SlashCommandBuilder()
    .setName('iniciar')
    .setDescription('Receba seu kit inicial de cartas e Tricoins'),
  async execute(interaction, { db }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply(
      await resultView(db, await starter(db, interaction.user, interaction.id)),
    );
  },
} satisfies Command;
