import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/types.js';
import { TRICORD_RED } from '../../core/brand.js';
import { ensureUser } from '../../modules/users/service.js';
export default {
  data: new SlashCommandBuilder()
    .setName('carteira')
    .setDescription('Saldo de Tricoins e últimas movimentações'),
  async execute(interaction, { db }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = await ensureUser(
      db,
      interaction.user.id,
      interaction.user.username,
    );
    const entries = await db.walletEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(TRICORD_RED)
          .setTitle(`${user.coins} Tricoins`)
          .setDescription(
            entries
              .map((e) => `${e.delta > 0 ? '+' : ''}${e.delta} • ${e.reason}`)
              .join('\n') || 'Use /iniciar, /diario e /trabalhar para começar.',
          )
          .setFooter({
            text: 'Moeda virtual do TRICORD, sem valor em dinheiro.',
          }),
      ],
    });
  },
} satisfies Command;
