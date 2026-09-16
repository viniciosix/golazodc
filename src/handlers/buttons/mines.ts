import { MessageFlags } from 'discord.js';
import type { Button } from '../../core/types.js';
import { UserError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { getGame, moveMines } from '../../modules/mines/service.js';
import { minesView } from '../../modules/mines/view.js';
export default {
  id: 'mines',
  async execute(interaction, { db }) {
    const [, id, rev, action] = interaction.customId.split(':');
    if (
      !interaction.guildId ||
      !id ||
      !rev ||
      !/^\d+$/.test(rev) ||
      !action ||
      (action !== 'cash' && !/^\d+$/.test(action))
    )
      throw new UserError('Botão inválido. Use /mines e clique em Continuar.');
    await interaction.deferUpdate();
    try {
      const game = await moveMines(
        db,
        interaction.user,
        interaction.id,
        id,
        interaction.guildId,
        Number(rev),
        action === 'cash' ? 'cash' : Number(action),
      );
      await interaction.editReply(
        minesView(game, interaction.user.displayAvatarURL()),
      );
    } catch (err) {
      if (!(err instanceof UserError))
        logger.error({ err, gameId: id }, 'Falha no Mines');
      if (err instanceof UserError) {
        const current = await getGame(
          db,
          interaction.user.id,
          id,
          interaction.guildId,
        ).catch(() => null);
        if (current)
          await interaction
            .editReply(minesView(current, interaction.user.displayAvatarURL()))
            .catch(() => undefined);
      }
      await interaction.followUp({
        content:
          err instanceof UserError
            ? err.message
            : 'Não consegui atualizar o painel. Use /mines e clique em Continuar para conferir a partida; não é preciso apostar novamente.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
} satisfies Button;
