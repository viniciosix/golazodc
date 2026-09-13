import { AttachmentBuilder, EmbedBuilder, escapeMarkdown } from 'discord.js';
import type { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { TRICORD_RED } from '../../core/brand.js';
import type { EconomyResult } from '../economy/transaction.js';
export async function resultView(db: PrismaClient, result: EconomyResult) {
  const embed = new EmbedBuilder()
    .setColor(TRICORD_RED)
    .setTitle(result.title)
    .setDescription(result.description.slice(0, 3500));
  const files: AttachmentBuilder[] = [];
  if (result.cardIds?.length) {
    const cards = await db.card.findMany({
      where: { id: { in: result.cardIds } },
      include: { artwork: true, player: true },
    });
    const ordered = result.cardIds.map((id) => cards.find((c) => c.id === id));
    embed.addFields({
      name: 'Cartas',
      value: ordered
        .map(
          (c, i) =>
            `${escapeMarkdown(c?.player.name || 'Carta')} • cópia: \`${result.copyIds?.[i] || c?.id}\``,
        )
        .join('\n')
        .slice(0, 1024),
    });
    const layers = [];
    for (let i = 0; i < ordered.length; i++) {
      const art = ordered[i]?.artwork;
      if (art)
        layers.push({
          input: await sharp(Buffer.from(art.png))
            .resize(220, 340, { fit: 'contain', background: '#180508' })
            .png()
            .toBuffer(),
          left: i * 220,
          top: 0,
        });
    }
    if (layers.length) {
      const image = await sharp({
        create: {
          width: ordered.length * 220,
          height: 340,
          channels: 4,
          background: '#180508',
        },
      })
        .composite(layers)
        .png()
        .toBuffer();
      files.push(new AttachmentBuilder(image, { name: 'cartas.png' }));
      embed.setImage('attachment://cartas.png');
    }
  }
  return {
    embeds: [embed],
    files,
    components: [],
    allowedMentions: { parse: [] as never[] },
  };
}
export async function cardView(db: PrismaClient, id: string) {
  const card = await db.card.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: { artwork: true, player: true },
  });
  if (!card) return { content: 'Carta não encontrada.', embeds: [], files: [] };
  const embed = new EmbedBuilder()
    .setColor(TRICORD_RED)
    .setTitle(card.player.name)
    .setDescription(
      `${card.edition} • ${card.rarity} • ${card.player.position}\nCatálogo: \`${card.slug}\`\n${card.active ? 'Disponível nos packs' : 'Fora dos packs'}`,
    );
  const files = card.artwork
    ? [
        new AttachmentBuilder(Buffer.from(card.artwork.png), {
          name: 'carta.png',
        }),
      ]
    : [];
  if (files.length) embed.setImage('attachment://carta.png');
  return { embeds: [embed], files, allowedMentions: { parse: [] as never[] } };
}
