import {
  MessageFlags,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { Context } from '../../core/types.js';
import { UserError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { menuView, newMenu, parseMenu } from './menu.js';
import { getGame, resumeMines, startMines } from './service.js';
import { minesView } from './view.js';
import { MINES, validateSettings } from './rules.js';
const busy = new Set<string>();
export async function handleMinesMenu(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  { db }: Context,
) {
  if (!interaction.guildId) throw new UserError('Abra /mines em um servidor.');
  const { menu, action } = parseMenu(interaction.customId, interaction.user.id);
  if (busy.has(interaction.message.id))
    throw new UserError('Aguarde a atualização do painel.');
  busy.add(interaction.message.id);
  try {
    await interaction.deferUpdate();
    const key = `mines-start:${menu.token}`;
    if (action === 'new') {
      await interaction.editReply(
        await menuView(db, newMenu(menu.owner, menu.bet, menu.bombs)),
      );
      return;
    }
    if (action === 'resume') {
      await interaction.editReply(
        minesView(await resumeMines(db, menu.owner, interaction.guildId)),
      );
      return;
    }
    const operation = await db.economyOperation.findUnique({
      where: { id: key },
    });
    if (operation) {
      const result = operation.result as { gameId?: string };
      if (operation.actorId !== menu.owner || !result.gameId)
        throw new UserError('Painel inválido.');
      await interaction.editReply(
        minesView(
          await getGame(db, menu.owner, result.gameId, interaction.guildId),
        ),
      );
      return;
    }
    if (action === 'start') {
      await interaction.editReply(
        minesView(
          await startMines(
            db,
            interaction.user,
            key,
            menu.bet,
            menu.bombs,
            interaction.guildId,
          ),
        ),
      );
      return;
    }
    if (interaction.isStringSelectMenu()) {
      const value = Number(interaction.values[0]);
      if (action === 'bet') menu.bet = value;
      else if (action === 'bombs') menu.bombs = value;
      else throw new UserError('Seleção inválida.');
    } else {
      if (action === 'minus') menu.bet--;
      else if (action === 'plus') menu.bet++;
      else if (action === 'half') menu.bet = Math.floor(menu.bet / 2);
      else if (action === 'double') menu.bet *= 2;
      else throw new UserError('Botão inválido.');
      menu.bet = Math.max(1, Math.min(MINES.maxBet, menu.bet));
    }
    if (!validateSettings(menu.bet, menu.bombs))
      throw new UserError('Escolha uma aposta e quantidade de bombas válidas.');
    await interaction.editReply(await menuView(db, menu));
  } catch (err) {
    if (!interaction.deferred) throw err;
    if (!(err instanceof UserError))
      logger.error({ err }, 'Falha no menu Mines');
    await interaction.followUp({
      content:
        err instanceof UserError
          ? err.message
          : 'Não consegui atualizar. Abra /mines e clique em Continuar para conferir a partida.',
      flags: MessageFlags.Ephemeral,
    });
  } finally {
    busy.delete(interaction.message.id);
  }
}
