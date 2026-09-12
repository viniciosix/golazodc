import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import type { Rarity } from '@prisma/client';
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
    .setColor(0x7c3aed)
    .setTitle('Sua coleção • Golazo')
    .setDescription(
      result.cards.length
        ? result.cards
            .map(
              (item) =>
                `**${item.card.player.name}** · ${item.card.rating} · ${rarities[item.card.rarity]} · ${item.card.edition}`,
            )
            .join('\n')
        : 'Nenhuma carta encontrada. Sua coleção começa vazia.',
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
    components: [buttons, select],
    allowedMentions: { parse: [] as never[] },
  };
}
