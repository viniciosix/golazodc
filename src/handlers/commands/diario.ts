import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/types.js';
import { reward } from '../../modules/economy/rewards.js';
import { resultView } from '../../modules/cards/view.js';
export default {
  data: new SlashCommandBuilder()
    .setName('diario')
    .setDescription('Resgate sua recompensa diária de Tricoins'),
  async execute(interaction, { db }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply(
      await resultView(
        db,
        await reward(db, interaction.user, interaction.id, 'daily'),
      ),
    );
  },
} satisfies Command;
