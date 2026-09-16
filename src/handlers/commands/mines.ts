import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/types.js';
import { UserError } from '../../core/errors.js';
import { menuView, newMenu } from '../../modules/mines/menu.js';
export default {
  data: new SlashCommandBuilder()
    .setName('mines')
    .setDescription('Abre o painel de apostas do Mines')
    .setDMPermission(false),
  async execute(interaction, { db }) {
    if (!interaction.guildId)
      throw new UserError('Jogue Mines em um servidor.');
    await interaction.deferReply();
    await interaction.editReply(
      await menuView(
        db,
        newMenu(interaction.user.id),
        interaction.user.displayAvatarURL(),
      ),
    );
  },
} satisfies Command;
