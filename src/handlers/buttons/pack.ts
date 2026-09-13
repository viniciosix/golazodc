import type { Button } from '../../core/types.js';
import { UserError } from '../../core/errors.js';
import { buyPack } from '../../modules/economy/rewards.js';
import { resultView } from '../../modules/cards/view.js';
export default {
  id: 'pack',
  async execute(interaction, { db }) {
    const [, owner, type] = interaction.customId.split(':');
    if (
      owner !== interaction.user.id ||
      (type !== 'basico' && type !== 'grande')
    )
      throw new UserError('Abra sua própria /loja.');
    await interaction.deferUpdate();
    await interaction.editReply(
      await resultView(
        db,
        await buyPack(db, interaction.user, interaction.message.id, type),
      ),
    );
  },
} satisfies Button;
