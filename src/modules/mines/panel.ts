import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js';
import { TRICORD_RED } from '../../core/brand.js';
export function minesPanel(
  text: string,
  avatar = 'https://cdn.discordapp.com/embed/avatars/0.png',
) {
  return new ContainerBuilder()
    .setAccentColor(TRICORD_RED)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`### MINES\n${text}`),
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL(avatar)
            .setDescription('Avatar do jogador'),
        ),
    );
}
export function infoRow(prefix: string, labels: string[]) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...labels.map((label, i) =>
      new ButtonBuilder()
        .setCustomId(`mines-info:${prefix}:${i}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel(label.slice(0, 80))
        .setDisabled(true),
    ),
  );
}
export function panelPayload(panel: ContainerBuilder) {
  panel.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      '-# TRICORD • Tricoins virtuais • Margem de 5% + arredondamento',
    ),
  );
  return {
    flags: MessageFlags.IsComponentsV2 as const,
    content: null,
    embeds: [],
    components: [panel],
    allowedMentions: { parse: [] as never[] },
  };
}
