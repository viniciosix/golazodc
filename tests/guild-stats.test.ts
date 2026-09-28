import { expect, it, vi } from 'vitest';
import {
  getGuildMemberStats,
  removeAllGuildBans,
} from '../src/modules/guild/stats.js';

const page = (...ids: string[]) => {
  const entries = ids.map((id) => [id, { user: { id } }] as const);
  return {
    size: entries.length,
    last: () => entries.at(-1)?.[1],
    [Symbol.iterator]: () => entries[Symbol.iterator](),
  };
};

it('soma membros atuais e todos os banimentos paginados', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      page(...Array.from({ length: 1000 }, (_, i) => `${i + 1}`)),
    )
    .mockResolvedValueOnce(
      page(...Array.from({ length: 37 }, (_, i) => `${i + 1001}`)),
    );

  await expect(
    getGuildMemberStats({ memberCount: 2500, bans: { fetch } }),
  ).resolves.toEqual({ current: 2500, banned: 1037, potential: 3537 });
  expect(fetch).toHaveBeenNthCalledWith(1, { limit: 1000 });
  expect(fetch).toHaveBeenNthCalledWith(2, { limit: 1000, after: '1000' });
});

it('aceita servidor sem usuários banidos', async () => {
  const fetch = vi.fn().mockResolvedValue(page());
  await expect(
    getGuildMemberStats({ memberCount: 42, bans: { fetch } }),
  ).resolves.toEqual({ current: 42, banned: 0, potential: 42 });
});

it('remove todos os banimentos e contabiliza falhas isoladas', async () => {
  const fetch = vi.fn().mockResolvedValue(page('1', '2', '3'));
  const remove = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('falha'))
    .mockResolvedValueOnce(undefined);

  await expect(
    removeAllGuildBans(
      { memberCount: 10, bans: { fetch, remove } },
      'Limpeza administrativa',
    ),
  ).resolves.toEqual({ total: 3, removed: 2, failed: 1 });
  expect(remove).toHaveBeenCalledTimes(3);
  expect(remove).toHaveBeenCalledWith('1', 'Limpeza administrativa');
});
