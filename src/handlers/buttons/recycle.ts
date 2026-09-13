import type { Button } from '../../core/types.js';
import { UserError } from '../../core/errors.js';
import { recycle } from '../../modules/economy/rewards.js';
import { resultView } from '../../modules/cards/view.js';
export default {
  id: 'recycle',
  async execute(interaction, { db }) {
    const [, owner, copy] = interaction.customId.split(':');
    if (owner !== interaction.user.id || !copy)
      throw new UserError('Abra seu próprio /reciclar.');
    await interaction.deferUpdate();
    await interaction.editReply({
      content: '',
      ...(await resultView(
        db,
        await recycle(db, interaction.user, interaction.message.id, copy),
      )),
    });
  },
} satisfies Button;
