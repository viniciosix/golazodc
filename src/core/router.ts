import type { Interaction } from 'discord.js';
import type { Context } from './types.js';
import type { Handlers } from './loader.js';
import { handleError, UserError } from './errors.js';
export async function route(
  interaction: Interaction,
  context: Context,
  handlers: Handlers,
): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      const command = handlers.commands.get(interaction.commandName);
      if (!command)
        throw new UserError(
          'Comando indisponível. Registre novamente os comandos.',
        );
      await command.execute(interaction, context);
    } else if (interaction.isAutocomplete()) {
      const command = handlers.commands.get(interaction.commandName);
      if (command?.autocomplete)
        await command.autocomplete(interaction, context);
      else await interaction.respond([]);
    } else if (interaction.isButton()) {
      const handler = handlers.buttons.get(interaction.customId.split(':')[0]!);
      if (!handler)
        throw new UserError('Este botão expirou. Execute o comando novamente.');
      await handler.execute(interaction, context);
    } else if (interaction.isAnySelectMenu()) {
      const handler = handlers.selects.get(interaction.customId.split(':')[0]!);
      if (!handler)
        throw new UserError('Este menu expirou. Execute o comando novamente.');
      await handler.execute(interaction, context);
    } else if (interaction.isModalSubmit()) {
      const handler = handlers.modals.get(interaction.customId.split(':')[0]!);
      if (!handler) throw new UserError('Este formulário expirou.');
      await handler.execute(interaction, context);
    }
  } catch (error) {
    await handleError(error, interaction);
  }
}
