import { createHash } from 'node:crypto';
import type { PrismaClient, Rarity } from '@prisma/client';
import { PermissionFlagsBits } from 'discord.js';
import sharp from 'sharp';
import { UserError } from '../../core/errors.js';
export function requireCardAdmin(
  guildId: string | null,
  permissions: Readonly<{ has(permission: bigint): boolean }> | null,
  source = process.env,
) {
  const guilds = (source.CARD_ADMIN_GUILD_IDS || source.DISCORD_GUILD_ID || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (
    !guildId ||
    !guilds.includes(guildId) ||
    !permissions?.has(PermissionFlagsBits.Administrator)
  )
    throw new UserError(
      'Cadastro restrito aos administradores dos servidores autorizados em CARD_ADMIN_GUILD_IDS.',
    );
}
export async function validateArtwork(input: Buffer) {
  if (!input.length || input.length > 10 * 1024 * 1024)
    throw new UserError('Envie um PNG de até 10 MB.');
  try {
    const metadata = await sharp(input, {
      limitInputPixels: 25000000,
    }).metadata();
    if (
      metadata.format !== 'png' ||
      !metadata.width ||
      !metadata.height ||
      (metadata.pages || 1) > 1
    )
      throw new Error('PNG inválido');
    await sharp(input, { limitInputPixels: 25000000 }).stats();
    return input;
  } catch {
    throw new UserError(
      'A imagem precisa ser um PNG válido, estático, com até 25 milhões de pixels.',
    );
  }
}
export async function downloadArtwork(url: string) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    !['cdn.discordapp.com', 'media.discordapp.net'].includes(parsed.hostname)
  )
    throw new UserError('Anexe o PNG diretamente no Discord.');
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  if (!response.ok || !response.body)
    throw new UserError('Não foi possível baixar o anexo. Envie novamente.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 10 * 1024 * 1024)
        throw new UserError('Envie um PNG de até 10 MB.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return validateArtwork(Buffer.concat(chunks));
}
export interface CardInput {
  slug: string;
  name: string;
  position: string;
  rarity: Rarity;
  edition: string;
}
export async function addCard(db: PrismaClient, data: CardInput, png: Buffer) {
  await validateArtwork(png);
  return db.card.upsert({
    where: { slug: data.slug },
    update: {},
    create: {
      slug: data.slug,
      rating: 0,
      rarity: data.rarity,
      edition: data.edition,
      active: true,
      player: {
        create: {
          name: data.name,
          position: data.position,
          country: '',
          club: 'São Paulo',
        },
      },
      artwork: {
        create: {
          png: new Uint8Array(png),
          sha256: createHash('sha256').update(png).digest('hex'),
        },
      },
    },
    include: { player: true },
  });
}
