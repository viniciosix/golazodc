import { describe, expect, it } from 'vitest';
import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import sharp from 'sharp';
import {
  requireCardAdmin,
  validateArtwork,
  downloadArtwork,
} from '../src/modules/cards/catalog.js';
import { packOdds, draw } from '../src/modules/economy/rewards.js';
describe('Catálogo seguro e chances reais', () => {
  it('exige administrador e servidor autorizado', () => {
    const admin = new PermissionsBitField(PermissionFlagsBits.Administrator);
    const source = { CARD_ADMIN_GUILD_IDS: '123' };
    expect(() => requireCardAdmin('123', admin, source)).not.toThrow();
    expect(() => requireCardAdmin('456', admin, source)).toThrow();
    expect(() => requireCardAdmin(null, admin, source)).toThrow();
    expect(() =>
      requireCardAdmin(
        '123',
        new PermissionsBitField(PermissionFlagsBits.ManageGuild),
        source,
      ),
    ).toThrow();
    expect(() => requireCardAdmin('123', admin, {})).toThrow();
  });
  it('valida o conteúdo e bloqueia URLs arbitrárias', async () => {
    const png = await sharp({
      create: { width: 20, height: 20, channels: 4, background: 'red' },
    })
      .png()
      .toBuffer();
    expect(await validateArtwork(png)).toEqual(png);
    await expect(validateArtwork(Buffer.from('PNG falso'))).rejects.toThrow();
    await expect(
      downloadArtwork('https://localhost/private'),
    ).rejects.toThrow();
  });
  it('redistribui chances somente entre raridades existentes', () => {
    expect(packOdds([{ rarity: 'COMMON' }])[0]?.percent).toBe(100);
    expect(packOdds([])).toEqual([]);
    expect(draw([{ rarity: 'RARE', id: 'only' }])).toEqual({
      rarity: 'RARE',
      id: 'only',
    });
    expect(
      packOdds([
        { rarity: 'COMMON' },
        { rarity: 'RARE' },
        { rarity: 'EPIC' },
        { rarity: 'LEGENDARY' },
      ]).map((x) => x.percent),
    ).toEqual([70, 22, 7.000000000000001, 1]);
  });
});
