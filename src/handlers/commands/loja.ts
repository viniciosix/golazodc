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
import { PACKS } from '../../modules/economy/config.js';
import { packOdds } from '../../modules/economy/rewards.js';
export default {
  data: new SlashCommandBuilder()
    .setName('loja')
    .setDescription('Veja packs, preços e chances de cada raridade'),
  async execute(interaction, { db }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const cards = await db.card.findMany({
      where: { active: true, artwork: { isNot: null } },
      select: { rarity: true },
    });
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(TRICORD_RED)
          .setTitle('Loja • Tricoin')
          .setDescription(
            'Escolha um pack para comprar e abrir. Podem vir repetidas. As chances são por carta e dependem das raridades disponíveis.\n\n' +
              Object.values(PACKS)
                .map(
                  (p) =>
                    `${p.name}: **${p.cost} Tricoins** • ${p.count} cartas`,
                )
                .join('\n') +
              '\n\n' +
              (cards.length
                ? packOdds(cards)
                    .map(
                      ({ rarity, percent }) =>
                        `${rarity}: ${percent.toFixed(2)}%`,
                    )
                    .join(' • ')
                : 'Catálogo vazio. Aguarde o administrador.'),
          ),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...Object.entries(PACKS).map(([key, p]) =>
            new ButtonBuilder()
              .setCustomId(`pack:${interaction.user.id}:${key}`)
              .setLabel(`Comprar ${p.name} • ${p.cost}`)
              .setStyle(ButtonStyle.Danger)
              .setDisabled(!cards.length),
          ),
        ),
      ],
    });
  },
} satisfies Command;
