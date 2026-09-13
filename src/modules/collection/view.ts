import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import type { Rarity } from '@prisma/client';
import { label } from '../../core/presentation.js';
import { TRICORD_RED } from '../../core/brand.js';
import type { collection } from './service.js';
export const rarities: Record<Rarity, string> = {
  COMMON: 'Comum',
  RARE: 'Rara',
  EPIC: 'Épica',
  LEGENDARY: 'Lendária',
};
export function collectionView(
  result: Awaited<ReturnType<typeof collection>>,
  ownerId: string,
  rarity?: Rarity,
  playerId?: string,
) {
  const key = `${ownerId}:${rarity || 'ALL'}:${playerId || 'ALL'}`;
  const embed = new EmbedBuilder()
    .setColor(TRICORD_RED)
    .setTitle('COLEÇÃO')
    .setDescription(
      result.cards.length
        ? result.cards
            .map(
              (item) =>
                `**${label(item.card.player.name)}** ${item.locked ? '🔒' : ''}\n${rarities[item.card.rarity]} · ${label(item.card.edition)}\n-# Cópia: \`${item.id}\``,
            )
            .join('\n\n')
        : 'Nenhuma carta encontrada. Use /iniciar para receber seu kit inicial.',
    )
    .setFooter({
      text: `Página ${result.page + 1}/${result.pages} • ${result.total} cartas`,
    });
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`collection:${key}:${result.page - 1}`)
      .setLabel('Anterior')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(result.page === 0),
    new ButtonBuilder()
      .setCustomId(`collection:${key}:${result.page + 1}`)
      .setLabel('Próxima')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(result.page + 1 >= result.pages),
  );
  const select = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`rarity:${ownerId}:${playerId || 'ALL'}`)
      .setPlaceholder('Filtrar raridade')
      .addOptions(
        { label: 'Todas', value: 'ALL', default: !rarity },
        ...Object.entries(rarities).map(([value, label]) => ({
          label,
          value,
          default: value === rarity,
        })),
      ),
  );
  return {
    embeds: [embed],
    components: [
      buttons,
      select,
      ...(result.cards.length
        ? [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(`card-art:${ownerId}`)
                .setPlaceholder('Ver arte da carta')
                .addOptions(
                  ...[
                    ...new Map(
                      result.cards.map((c) => [
                        c.cardId,
                        {
                          label: c.card.player.name.slice(0, 100),
                          value: c.cardId,
                        },
                      ]),
                    ).values(),
                  ],
                ),
            ),
          ]
        : []),
    ],
    allowedMentions: { parse: [] as never[] },
  };
}
