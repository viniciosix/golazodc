import { MessageFlags } from 'discord.js';
import type { Select } from '../../core/types.js';
import { UserError } from '../../core/errors.js';
import { cardView } from '../../modules/cards/view.js';
export default {
  id: 'card-art',
  async execute(interaction, { db }) {
    if (!interaction.isStringSelectMenu()) return;
    const [, owner] = interaction.customId.split(':');
    if (owner !== interaction.user.id)
      throw new UserError('Abra sua própria /colecao.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply(
      await cardView(db, interaction.values[0] || ''),
    );
  },
} satisfies Select;
