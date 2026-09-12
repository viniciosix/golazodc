import { randomUUID } from 'node:crypto';
import { MessageFlags, type Interaction } from 'discord.js';
import { logger } from './logger.js';
export class UserError extends Error {}
export async function handleError(
  error: unknown,
  interaction: Interaction,
): Promise<void> {
  const id = randomUUID();
  logger.error(
    { err: error, id, interactionId: interaction.id },
    'Falha na interação',
  );
  try {
    if (interaction.isAutocomplete()) {
      if (!interaction.responded) await interaction.respond([]);
      return;
    }
    if (!interaction.isRepliable()) return;
    const content =
      error instanceof UserError
        ? error.message
        : `Não consegui concluir. Referência: ${id}`;
    if (interaction.deferred)
      await interaction.editReply({ content, components: [], embeds: [] });
    else if (interaction.replied)
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  } catch (replyError) {
    logger.warn(
      { err: replyError, id },
      'Não foi possível responder à interação',
    );
  }
}
