import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/types.js';
import { TRICORD_RED } from '../../core/brand.js';
import { number, label } from '../../core/presentation.js';
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
          .setTitle('CARTEIRA')
          .setDescription(
            [
              `• **Saldo disponível:** ${number(user.coins)} Tricoins`,
              '',
              '**Últimas movimentações**',
              entries.length
                ? entries
                    .map(
                      (e) =>
                        `• **${e.delta > 0n ? '+' : ''}${number(e.delta)}** · ${label(e.reason)}`,
                    )
                    .join('\n')
                : 'Nenhuma movimentação por enquanto.',
              '',
              '-# /diario e /trabalhar para ganhar Tricoins. /loja para abrir packs.',
            ].join('\n'),
          ),
      ],
    });
  },
} satisfies Command;
