import type { Select } from '../../core/types.js';
import { collection } from '../../modules/collection/service.js';
import { collectionView } from '../../modules/collection/view.js';
import {
  checkOwner,
  parseRarity,
} from '../../modules/collection/validation.js';
export default {
  id: 'rarity',
  async execute(interaction, { db }) {
    if (!interaction.isStringSelectMenu()) return;
    const [, owner, rawPlayer] = interaction.customId.split(':');
    checkOwner(interaction.user.id, owner);
    const rarity = parseRarity(interaction.values[0]);
    const player = rawPlayer === 'ALL' ? undefined : rawPlayer;
    await interaction.deferUpdate();
    const result = await collection(
      db,
      interaction.user.id,
      interaction.user.username,
      0,
      rarity,
      player,
    );
    await interaction.editReply(
      collectionView(result, interaction.user.id, rarity, player),
    );
  },
} satisfies Select;
