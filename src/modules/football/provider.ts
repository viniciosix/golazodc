import { z } from 'zod';
export const leagues = {
  'bra.1': 'Brasileirão Série A',
  'bra.copa_do_brasil': 'Copa do Brasil',
  'conmebol.libertadores': 'Libertadores',
  'conmebol.sudamericana': 'Sul-Americana',
  'eng.1': 'Premier League',
  'esp.1': 'La Liga',
} as const;
export type League = keyof typeof leagues;
export const leagueSchema = z.enum([
  'bra.1',
  'bra.copa_do_brasil',
  'conmebol.libertadores',
  'conmebol.sudamericana',
  'eng.1',
  'esp.1',
]);
export const teamSchema = z.object({
  id: z.string().regex(/^\d+$/),
  displayName: z.string().min(1).max(150),
});
const competitor = z.object({
  homeAway: z.enum(['home', 'away']),
  score: z.string().regex(/^\d+$/),
  team: teamSchema,
});
const eventSchema = z.object({
  id: z.string(),
  date: z.string().datetime(),
  status: z.object({
    displayClock: z.string().optional(),
    type: z.object({
      state: z.enum(['pre', 'in', 'post']),
      detail: z.string(),
    }),
  }),
  competitions: z
    .array(z.object({ competitors: z.array(competitor).length(2) }))
    .min(1),
});
export interface Match {
  id: string;
  date: string;
  state: 'pre' | 'in' | 'post';
  clock: string;
  home: { id: string; name: string; score: number };
  away: { id: string; name: string; score: number };
}
export async function fetchText(
  url: string,
  timeout = 10000,
  headers: Record<string, string> = {},
): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    headers: {
      'User-Agent': 'Golazo/0.1 football scoreboard',
      Accept: 'text/html,application/json',
      ...headers,
    },
  });
  if (!response.ok)
    throw new Error(
      `Football HTTP ${response.status} (${new URL(url).hostname})`,
    );
  if (Number(response.headers.get('content-length')) > 3000000)
    throw new Error('Resposta excessiva');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Resposta vazia');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 3000000) {
      await reader.cancel();
      throw new Error('Resposta excessiva');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
const api = (league: League, resource: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSchema.parse(league)}/${resource}`;
export function parseMatches(data: unknown): Match[] {
  const parsed = z.object({ events: z.array(eventSchema) }).parse(data);
  return parsed.events.map((event) => {
    const competitors = event.competitions[0]!.competitors;
    const home = competitors.find((c) => c.homeAway === 'home');
    const away = competitors.find((c) => c.homeAway === 'away');
    if (!home || !away) throw new Error('Mandante/visitante ausente');
    const side = (c: typeof home) => ({
      id: c.team.id,
      name: c.team.displayName,
      score: Number(c.score),
    });
    return {
      id: event.id,
      date: event.date,
      state: event.status.type.state,
      clock: event.status.displayClock || event.status.type.detail,
      home: side(home),
      away: side(away),
    };
  });
}
export async function fetchMatches(league: League): Promise<Match[]> {
  const now = Date.now();
  const date = (offset: number) =>
    new Date(now + offset * 86400000)
      .toISOString()
      .slice(0, 10)
      .replaceAll('-', '');
  return parseMatches(
    JSON.parse(
      await fetchText(
        api(league, `scoreboard?dates=${date(-1)}-${date(1)}&limit=100`),
      ),
    ),
  );
}
const teamCache = new Map<
  string,
  { expires: number; teams: z.infer<typeof teamSchema>[] }
>();
export async function fetchTeams(league: League) {
  const cached = teamCache.get(league);
  if (cached && cached.expires > Date.now()) return cached.teams;
  const data = z
    .object({
      sports: z.array(
        z.object({
          leagues: z.array(
            z.object({ teams: z.array(z.object({ team: teamSchema })) }),
          ),
        }),
      ),
    })
    .parse(JSON.parse(await fetchText(api(league, 'teams?limit=200'), 2000)));
  const teams = data.sports[0]?.leagues[0]?.teams.map((t) => t.team);
  if (!teams?.length) throw new Error('Catálogo vazio');
  teamCache.set(league, { expires: Date.now() + 3600000, teams });
  return teams;
}
