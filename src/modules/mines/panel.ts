import { readFileSync } from 'node:fs';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js';
import { TRICORD_RED } from '../../core/brand.js';
const logo = readFileSync(
  new URL('../../../assets/mines/logo.png', import.meta.url),
);
export function minesPanel(text: string) {
  return new ContainerBuilder()
    .setAccentColor(TRICORD_RED)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`### MINES\n${text}`),
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL('attachment://mines-logo.png')
            .setDescription('Mines TRICORD'),
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
export function panelPayload(
  panel: ContainerBuilder,
  avatar = 'https://cdn.discordapp.com/embed/avatars/0.png',
) {
  panel.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '-# TRICORD • Tricoins virtuais\n-# Margem de 5% + arredondamento',
        ),
      )
      .setThumbnailAccessory(
        new ThumbnailBuilder()
          .setURL(avatar)
          .setDescription('Avatar do jogador'),
      ),
  );
  return {
    flags: MessageFlags.IsComponentsV2 as const,
    content: null,
    embeds: [],
    attachments: [],
    files: [new AttachmentBuilder(logo, { name: 'mines-logo.png' })],
    components: [panel],
    allowedMentions: { parse: [] as never[] },
  };
}
