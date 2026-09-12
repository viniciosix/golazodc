import type { Button } from '../../core/types.js';
import { collection } from '../../modules/collection/service.js';
import { collectionView } from '../../modules/collection/view.js';
import {
  checkOwner,
  parseRarity,
} from '../../modules/collection/validation.js';
export default {
  id: 'collection',
  async execute(interaction, { db }) {
    const [, owner, rawRarity, rawPlayer, page] =
      interaction.customId.split(':');
    checkOwner(interaction.user.id, owner);
    const rarity = parseRarity(rawRarity);
    const player = rawPlayer === 'ALL' ? undefined : rawPlayer;
    await interaction.deferUpdate();
    const result = await collection(
      db,
      interaction.user.id,
      interaction.user.username,
      Number(page),
      rarity,
      player,
    );
    await interaction.editReply(
      collectionView(result, interaction.user.id, rarity, player),
    );
  },
} satisfies Button;
