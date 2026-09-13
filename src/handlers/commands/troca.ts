import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/types.js';
import { TRICORD_RED } from '../../core/brand.js';
import {
  proposeTrade,
  resolveTrade,
  expireTrades,
} from '../../modules/economy/market.js';
import { resultView } from '../../modules/cards/view.js';
export default {
  data: new SlashCommandBuilder()
    .setName('troca')
    .setDescription('Troque cartas com consentimento dos dois colecionadores')
    .addSubcommand((s) =>
      s
        .setName('propor')
        .setDescription('Ofereça uma carta por outra')
        .addUserOption((o) =>
          o.setName('pessoa').setDescription('Destinatário').setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('oferecida')
            .setDescription('ID da sua cópia')
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('desejada')
            .setDescription('ID da cópia da outra pessoa')
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s.setName('listar').setDescription('Veja suas propostas pendentes'),
    )
    .addSubcommand((s) =>
      s
        .setName('aceitar')
        .setDescription('Aceite e conclua uma proposta recebida')
        .addStringOption((o) =>
          o
            .setName('proposta')
            .setDescription('ID da proposta')
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('cancelar')
        .setDescription('Recuse ou cancele uma proposta')
        .addStringOption((o) =>
          o
            .setName('proposta')
            .setDescription('ID da proposta')
            .setRequired(true),
        ),
    ),
  async execute(interaction, { db }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();
    if (sub === 'listar') {
      await db.$transaction((tx) => expireTrades(tx), {
        isolationLevel: 'Serializable',
      });
      const user = await db.user.findUnique({
        where: { discordId: interaction.user.id },
      });
      const entries = user
        ? await db.tradeOffer.findMany({
            where: {
              status: 'OPEN',
              OR: [{ senderId: user.id }, { recipientId: user.id }],
            },
            include: {
              offered: { include: { card: { include: { player: true } } } },
              wanted: { include: { card: { include: { player: true } } } },
            },
            orderBy: { createdAt: 'desc' },
            take: 15,
          })
        : [];
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(TRICORD_RED)
            .setTitle('Suas trocas pendentes')
            .setDescription(
              entries
                .map(
                  (e) =>
                    `${e.recipientId === user?.id ? 'Recebida' : 'Enviada'}: **${e.offered.card.player.name} → ${e.wanted.card.player.name}**\n\`${e.id}\` • expira <t:${Math.floor(e.expiresAt.getTime() / 1000)}:R>`,
                )
                .join('\n\n') || 'Nenhuma proposta pendente.',
            ),
        ],
        allowedMentions: { parse: [] },
      });
      return;
    }
    const result =
      sub === 'propor'
        ? await proposeTrade(
            db,
            interaction.user,
            interaction.id,
            interaction.options.getUser('pessoa', true).id,
            interaction.options.getString('oferecida', true),
            interaction.options.getString('desejada', true),
          )
        : await resolveTrade(
            db,
            interaction.user,
            interaction.id,
            interaction.options.getString('proposta', true),
            sub === 'aceitar',
          );
    await interaction.editReply(await resultView(db, result));
  },
} satisfies Command;
