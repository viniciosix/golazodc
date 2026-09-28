import { expect, it, vi } from 'vitest';
import { getGuildMemberStats } from '../src/modules/guild/stats.js';

const page = (size: number, lastId?: string) => ({
  size,
  last: () => (lastId ? { user: { id: lastId } } : undefined),
});

it('soma membros atuais e todos os banimentos paginados', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(page(1000, '1000'))
    .mockResolvedValueOnce(page(37, '1037'));

  await expect(
    getGuildMemberStats({ memberCount: 2500, bans: { fetch } }),
  ).resolves.toEqual({ current: 2500, banned: 1037, potential: 3537 });
  expect(fetch).toHaveBeenNthCalledWith(1, { limit: 1000 });
  expect(fetch).toHaveBeenNthCalledWith(2, { limit: 1000, after: '1000' });
});

it('aceita servidor sem usuários banidos', async () => {
  const fetch = vi.fn().mockResolvedValue(page(0));
  await expect(
    getGuildMemberStats({ memberCount: 42, bans: { fetch } }),
  ).resolves.toEqual({ current: 42, banned: 0, potential: 42 });
});
