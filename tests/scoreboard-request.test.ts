import { afterEach, expect, it, vi } from 'vitest';
import { fetchMatches } from '../src/modules/football/provider.js';
afterEach(() => vi.unstubAllGlobals());
const event = {
  id: '123',
  date: '2026-09-16T00:00:00Z',
  status: { displayClock: '45', type: { state: 'in' } },
  competitions: [
    {
      competitors: [
        {
          homeAway: 'home',
          score: '1',
          team: { id: '2026', displayName: 'São Paulo' },
        },
        {
          homeAway: 'away',
          score: '0',
          team: { id: '5', displayName: 'Boca Juniors' },
        },
      ],
    },
  ],
};
it('uses three single-date requests without unsupported range and deduplicates events', async () => {
  const fetch = vi.fn(async (url: string) => {
    expect(url).toMatch(/conmebol\.sudamericana\/scoreboard\?dates=\d{8}$/);
    return new Response(JSON.stringify({ events: [event] }));
  });
  vi.stubGlobal('fetch', fetch);
  const matches = await fetchMatches('conmebol.sudamericana');
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(new Set(fetch.mock.calls.map((c) => c[0])).size).toBe(3);
  expect(matches).toHaveLength(1);
  expect(matches[0]?.home.score).toBe(1);
});
it('keeps available days when another day fails and rejects total outage', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ events: [event] })))
    .mockResolvedValueOnce(new Response('', { status: 400 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ events: [] })));
  vi.stubGlobal('fetch', fetch);
  expect(await fetchMatches('conmebol.sudamericana')).toHaveLength(1);
  fetch.mockImplementation(async () => new Response('', { status: 400 }));
  await expect(fetchMatches('conmebol.sudamericana')).rejects.toThrow(
    'Football HTTP 400',
  );
});
