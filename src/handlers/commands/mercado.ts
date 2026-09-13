import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../core/types.js';
import { TRICORD_RED } from '../../core/brand.js';
import { UserError } from '../../core/errors.js';
import { sell, cancelListing } from '../../modules/economy/market.js';
import { resultView } from '../../modules/cards/view.js';
export default {
  data: new SlashCommandBuilder()
    .setName('mercado')
    .setDescription('Compre e venda cartas por Tricoins')
    .addSubcommand((s) =>
      s
        .setName('listar')
        .setDescription('Veja anúncios disponíveis')
        .addIntegerOption((o) =>
          o.setName('pagina').setDescription('Página').setMinValue(1),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('vender')
        .setDescription('Anuncie uma cópia da sua coleção')
        .addStringOption((o) =>
          o.setName('copia').setDescription('ID da cópia').setRequired(true),
        )
        .addIntegerOption((o) =>
          o
            .setName('preco')
            .setDescription('Preço em Tricoins')
            .setMinValue(1)
            .setMaxValue(1000000)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('comprar')
        .setDescription('Confira e compre um anúncio')
        .addStringOption((o) =>
          o
            .setName('anuncio')
            .setDescription('ID do anúncio')
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('cancelar')
        .setDescription('Retire seu anúncio')
        .addStringOption((o) =>
          o
            .setName('anuncio')
            .setDescription('ID do anúncio')
            .setRequired(true),
        ),
    ),
  async execute(interaction, { db }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();
    if (sub === 'listar') {
      const page = Math.min(
        interaction.options.getInteger('pagina') || 1,
        100000,
      );
      const entries = await db.marketListing.findMany({
        where: { status: 'OPEN' },
        include: {
          userCard: { include: { card: { include: { player: true } } } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 10,
        skip: (page - 1) * 10,
      });
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(TRICORD_RED)
            .setTitle(`Mercado • página ${page}`)
            .setDescription(
              entries
                .map(
                  (e) =>
                    `${e.userCard.card.player.name} • **${e.price} Tricoins**\nAnúncio: \`${e.id}\``,
                )
                .join('\n\n') || 'Nenhum anúncio nesta página.',
            )
            .setFooter({ text: 'Use /mercado comprar com o ID do anúncio.' }),
        ],
        allowedMentions: { parse: [] },
      });
      return;
    }
    if (sub === 'comprar') {
      const entry = await db.marketListing.findFirst({
        where: {
          id: interaction.options.getString('anuncio', true),
          status: 'OPEN',
        },
        include: {
          userCard: { include: { card: { include: { player: true } } } },
        },
      });
      if (!entry) throw new UserError('Anúncio indisponível.');
      await interaction.editReply({
        content: `Comprar ${entry.userCard.card.player.name} por ${entry.price} Tricoins?`,
        allowedMentions: { parse: [] },
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`marketbuy:${interaction.user.id}:${entry.id}`)
              .setLabel('Confirmar compra')
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
      return;
    }
    const result =
      sub === 'vender'
        ? await sell(
            db,
            interaction.user,
            interaction.id,
            interaction.options.getString('copia', true),
            interaction.options.getInteger('preco', true),
          )
        : await cancelListing(
            db,
            interaction.user,
            interaction.id,
            interaction.options.getString('anuncio', true),
          );
    await interaction.editReply(await resultView(db, result));
  },
} satisfies Command;
