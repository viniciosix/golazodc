import type { Button } from '../../core/types.js';
import { UserError } from '../../core/errors.js';
import { buyListing } from '../../modules/economy/market.js';
import { resultView } from '../../modules/cards/view.js';
export default {
  id: 'marketbuy',
  async execute(interaction, { db }) {
    const [, owner, id] = interaction.customId.split(':');
    if (owner !== interaction.user.id || !id)
      throw new UserError('Abra sua própria confirmação de compra.');
    await interaction.deferUpdate();
    await interaction.editReply({
      content: '',
      ...(await resultView(
        db,
        await buyListing(db, interaction.user, interaction.message.id, id),
      )),
    });
  },
} satisfies Button;
