import { MessageFlags } from 'discord.js';
import type { Modal } from '../../core/types.js';
import { ensureUser } from '../../modules/users/service.js';
export default {
  id: 'profile-bio',
  async execute(interaction, { db }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = await ensureUser(
      db,
      interaction.user.id,
      interaction.user.username,
    );
    await db.user.update({
      where: { id: user.id },
      data: {
        bio: interaction.fields.getTextInputValue('bio').trim().slice(0, 200),
      },
    });
    await interaction.editReply('Bio atualizada! Use /perfil para conferir.');
  },
} satisfies Modal;
