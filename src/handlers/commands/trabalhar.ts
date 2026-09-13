import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/types.js';
import { reward } from '../../modules/economy/rewards.js';
import { resultView } from '../../modules/cards/view.js';
export default {
  data: new SlashCommandBuilder()
    .setName('trabalhar')
    .setDescription('Ganhe Tricoins trabalhando a cada quatro horas'),
  async execute(interaction, { db }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply(
      await resultView(
        db,
        await reward(db, interaction.user, interaction.id, 'work'),
      ),
    );
  },
} satisfies Command;
