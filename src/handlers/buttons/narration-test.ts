import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import type { Button } from '../../core/types.js';
import { UserError } from '../../core/errors.js';
import { resolveEventEmojis } from '../../modules/football/event-format.js';
import {
  updateSimulation,
  simulationView,
  SIMULATION_ACTIONS,
  type SimulationAction,
} from '../../modules/football/simulator.js';
export default {
  id: 'narration-test',
  async execute(interaction, { client }) {
    if (
      !interaction.guildId ||
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    )
      throw new UserError(
        'Você precisa de Gerenciar servidor para usar o simulador.',
      );
    const action = interaction.customId.split(':')[1];
    if (!action || !Object.hasOwn(SIMULATION_ACTIONS, action))
      throw new UserError('Ação de teste inválida.');
    try {
      await updateSimulation(
        interaction.message.id,
        interaction.user.id,
        interaction.guildId,
        action as SimulationAction,
        async (state) => {
          await interaction.deferUpdate();
          await interaction.editReply(
            simulationView(
              state,
              resolveEventEmojis(client, interaction.guild),
            ),
          );
        },
      );
    } catch (error) {
      if (interaction.deferred) {
        await interaction.followUp({
          content:
            'Não consegui atualizar o teste. Tente novamente ou abra /gols teste.',
          flags: MessageFlags.Ephemeral,
        });
      } else throw error;
    }
  },
} satisfies Button;
