import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/types.js';
import { cardView } from '../../modules/cards/view.js';
export default {
  data: new SlashCommandBuilder()
    .setName('carta')
    .setDescription('Veja uma carta do catálogo')
    .addStringOption((o) =>
      o
        .setName('carta')
        .setDescription('Escolha pelo nome')
        .setRequired(true)
        .setAutocomplete(true),
    ),
  async execute(interaction, { db }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply(
      await cardView(db, interaction.options.getString('carta', true)),
    );
  },
  async autocomplete(interaction, { db }) {
    const cards = await db.card.findMany({
      where: {
        player: {
          name: {
            contains: interaction.options.getFocused().slice(0, 100),
            mode: 'insensitive',
          },
        },
      },
      include: { player: true },
      take: 25,
      orderBy: { createdAt: 'desc' },
    });
    await interaction.respond(
      cards.map((c) => ({
        name: `${c.player.name} • ${c.edition} • ${c.rarity}`.slice(0, 100),
        value: c.id,
      })),
    );
  },
} satisfies Command;
