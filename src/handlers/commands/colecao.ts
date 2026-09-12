import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/types.js';
import { collection } from '../../modules/collection/service.js';
import { collectionView } from '../../modules/collection/view.js';
export default {
  data: new SlashCommandBuilder()
    .setName('colecao')
    .setDescription('Veja suas cartas')
    .addStringOption((option) =>
      option
        .setName('jogador')
        .setDescription('Filtrar por jogador')
        .setAutocomplete(true),
    ),
  async execute(interaction, { db }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const playerId = interaction.options.getString('jogador') || undefined;
    const result = await collection(
      db,
      interaction.user.id,
      interaction.user.username,
      0,
      undefined,
      playerId,
    );
    await interaction.editReply(
      collectionView(result, interaction.user.id, undefined, playerId),
    );
  },
  async autocomplete(interaction, { db }) {
    const name = interaction.options.getFocused().slice(0, 100);
    const players = await db.player.findMany({
      where: {
        name: { contains: name, mode: 'insensitive' },
        cards: {
          some: {
            owners: { some: { user: { discordId: interaction.user.id } } },
          },
        },
      },
      orderBy: { name: 'asc' },
      take: 25,
    });
    await interaction.respond(
      players.map((p) => ({ name: p.name.slice(0, 100), value: p.id })),
    );
  },
} satisfies Command;
