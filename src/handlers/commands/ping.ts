import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/types.js';
export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Verifica a conexão do Golazo'),
  async execute(interaction, { client }) {
    await interaction.reply(
      `Pong! WebSocket: ${client.ws.ping < 0 ? 'calculando' : `${client.ws.ping} ms`}`,
    );
  },
} satisfies Command;
