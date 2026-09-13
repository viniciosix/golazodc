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
import { rarities } from '../../modules/collection/view.js';
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
          .setTitle('LOJA')
          .setDescription(
            'Novos jogadores para a sua coleção.\n\n' +
              Object.values(PACKS)
                .map(
                  (p) =>
                    `**${p.name}**\n${p.count} cartas · **${p.cost} Tricoins**`,
                )
                .join('\n\n') +
              '\n\n**Chances por carta**\n' +
              (cards.length
                ? packOdds(cards)
                    .map(
                      ({ rarity, percent }) =>
                        `${rarities[rarity]} ${percent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`,
                    )
                    .join(' • ')
                : 'Catálogo vazio. Aguarde o administrador.') +
              '\n\n-# Podem vir repetidas. O botão confirma a compra e abre o pack.',
          ),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...Object.entries(PACKS).map(([key, p]) =>
            new ButtonBuilder()
              .setCustomId(`pack:${interaction.user.id}:${key}`)
              .setLabel(`Comprar ${p.name} • ${p.cost}`)
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(!cards.length),
          ),
        ),
      ],
    });
  },
} satisfies Command;
