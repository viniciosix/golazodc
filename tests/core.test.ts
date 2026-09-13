import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { MemoryCache } from '../src/infrastructure/cache.js';
import { discordSchema, parseConfig, baseSchema } from '../src/config/env.js';
import { loadHandlers, uniqueMap } from '../src/core/loader.js';
import { renderCard, escapeXml } from '../src/images/render-card.js';
import {
  checkOwner,
  parseRarity,
} from '../src/modules/collection/validation.js';
describe('Infraestrutura', () => {
  it('valida ambiente sem expor valores secretos', () => {
    expect(() =>
      parseConfig(baseSchema, { DATABASE_URL: 'secret-invalid' }),
    ).toThrow('DATABASE_URL');
    try {
      parseConfig(baseSchema, { DATABASE_URL: 'secret-invalid' });
    } catch (error) {
      expect(String(error)).not.toContain('secret-invalid');
    }
    expect(
      parseConfig(baseSchema, {
        DATABASE_URL: 'postgresql://localhost/test',
        REDIS_URL: '',
      }).REDIS_URL,
    ).toBeUndefined();
    expect(() => parseConfig(discordSchema, {})).toThrow();
  });
  it('cache expira e não compartilha referências', async () => {
    vi.useFakeTimers();
    try {
      const cache = new MemoryCache(2);
      await cache.set('x', { count: 1 }, 1);
      const value = await cache.get<{ count: number }>('x');
      value!.count = 5;
      expect(await cache.get('x')).toEqual({ count: 1 });
      vi.advanceTimersByTime(1001);
      expect(await cache.get('x')).toBeNull();
      await expect(cache.set('x', {}, 0)).rejects.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });
  it('cache limita memória', async () => {
    const cache = new MemoryCache(1);
    await cache.set('a', 1, 10);
    await cache.set('b', 2, 10);
    expect(await cache.get('a')).toBeNull();
    await cache.close();
    expect(await cache.get('b')).toBeNull();
  });
  it('carrega todos os tipos de handler e rejeita duplicatas', async () => {
    const handlers = await loadHandlers();
    expect([...handlers.commands.keys()].sort()).toEqual([
      'brasileirao',
      'carta',
      'cartas-admin',
      'carteira',
      'colecao',
      'diario',
      'gols',
      'iniciar',
      'jogos',
      'loja',
      'mercado',
      'perfil',
      'ping',
      'reciclar',
      'trabalhar',
      'troca',
    ]);
    expect(handlers.buttons.has('collection')).toBe(true);
    expect(handlers.selects.has('rarity')).toBe(true);
    expect(handlers.modals.has('profile-bio')).toBe(true);
    expect(handlers.events).toHaveLength(2);
    expect(handlers.commands.get('colecao')?.autocomplete).toBeTypeOf(
      'function',
    );
    for (const command of handlers.commands.values())
      expect(command.data.toJSON().description).toBeTruthy();
    expect(() => uniqueMap(['a', 'a'], (s) => s)).toThrow('duplicado');
  });
  it('rejeita navegação de outra pessoa e raridade inválida', () => {
    expect(() => checkOwner('a', 'b')).toThrow();
    expect(() => parseRarity('INVALID')).toThrow();
    expect(parseRarity('ALL')).toBeUndefined();
  });
  it('Sharp gera PNG com tamanho correto e escapa SVG', async () => {
    expect(escapeXml('<&"')).toBe('&lt;&amp;&quot;');
    const portrait = await sharp({
      create: { width: 100, height: 100, channels: 4, background: '#aabbcc' },
    })
      .png()
      .toBuffer();
    const result = await renderCard({
      name: '<script>&',
      rating: 90,
      position: 'ATA',
      rarity: 'ÉPICA',
      portrait,
    });
    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(600);
    expect(meta.height).toBe(840);
    expect(meta.format).toBe('png');
    await expect(
      renderCard({ name: 'a', rating: 100, position: 'ATA', rarity: 'COMMON' }),
    ).rejects.toThrow();
  });
});
