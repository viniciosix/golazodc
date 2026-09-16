import type { Select } from '../../core/types.js';
import { handleMinesMenu } from '../../modules/mines/menu-handler.js';
export default {
  id: 'mines-options',
  async execute(interaction, context) {
    if (interaction.isStringSelectMenu())
      await handleMinesMenu(interaction, context);
  },
} satisfies Select;
