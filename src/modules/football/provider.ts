import { logger } from '../../core/logger.js';
import { z } from 'zod';
export const leagues = {
  'bra.1': 'Brasileirão Série A',
  'bra.2': 'Brasileirão Série B',
  'bra.copa_do_brasil': 'Copa do Brasil',
  'conmebol.libertadores': 'Libertadores',
  'conmebol.sudamericana': 'Sul-Americana',
  'eng.1': 'Premier League',
  'esp.1': 'La Liga',
} as const;
export type League = keyof typeof leagues;
export const leagueSchema = z.enum([
  'bra.1',
  'bra.2',
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
  score: z
    .union([z.string().regex(/^\d+$/), z.number().int().nonnegative()])
    .transform(Number)
    .refine(Number.isSafeInteger),
  team: teamSchema,
});
const eventSchema = z.object({
  id: z.string(),
  date: z.string().datetime({ offset: true }),
  status: z.object({
    displayClock: z.string().nullish(),
    type: z.object({
      state: z.enum(['pre', 'in', 'post']),
      detail: z.string().nullish(),
      name: z.string().optional(),
    }),
  }),
  competitions: z
    .array(z.object({ competitors: z.array(competitor).length(2) }))
    .min(1),
});
export interface Competition {
  name: string;
  logo?: string;
}
export function competitionInfo(
  data: unknown,
  league?: League,
): Competition | undefined {
  const parsed = z
    .object({
      leagues: z
        .array(
          z.object({
            name: z.string().optional(),
            slug: z.string().optional(),
            logos: z.array(z.object({ href: z.string() })).optional(),
          }),
        )
        .optional(),
    })
    .safeParse(data);
  const entries = parsed.success ? parsed.data.leagues || [] : [];
  const item = league
    ? entries.find((x) => x.slug === league) ||
      (entries.length === 1 ? entries[0] : undefined)
    : entries[0];
  const name = league ? leagues[league] : item?.name;
  if (!name) return undefined;
  const logo = item?.logos
    ?.map((x) => x.href)
    .find((href) => {
      try {
        const url = new URL(href);
        return (
          url.protocol === 'https:' &&
          !url.username &&
          !url.password &&
          (url.hostname === 'espncdn.com' ||
            url.hostname.endsWith('.espncdn.com'))
        );
      } catch {
        return false;
      }
    });
  return { name, ...(logo ? { logo } : {}) };
}
export interface Match {
  competition?: Competition;
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
      'User-Agent': 'TRICORD/0.1 football scoreboard',
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
export function parseMatches(data: unknown, league?: League): Match[] {
  const competition = competitionInfo(data, league);
  const parsed = z.object({ events: z.array(z.unknown()) }).parse(data);
  const matches = parsed.events.flatMap((raw) => {
    const result = eventSchema.safeParse(raw);
    if (!result.success) {
      const id = z.object({ id: z.string().regex(/^\d+$/) }).safeParse(raw);
      logger.warn(
        {
          eventId: id.success ? id.data.id : 'unknown',
          fields: result.error.issues.map((issue) => issue.path.join('.')),
        },
        'Partida temporariamente incompleta; aguardando próxima consulta',
      );
      return [];
    }
    const event = result.data;
    const competitors = event.competitions[0]!.competitors;
    const home = competitors.find((c) => c.homeAway === 'home');
    const away = competitors.find((c) => c.homeAway === 'away');
    if (!home || !away) {
      logger.warn({ eventId: event.id }, 'Mandante/visitante ausente');
      return [];
    }
    const side = (c: typeof home) => ({
      id: c.team.id,
      name: c.team.displayName,
      score: Number(c.score),
    });
    return [
      {
        ...(competition ? { competition } : {}),
        id: event.id,
        date: event.date,
        state: event.status.type.state,
        clock:
          event.status.type.name === 'STATUS_HALFTIME'
            ? 'Intervalo'
            : event.status.displayClock ||
              event.status.type.detail ||
              (event.status.type.state === 'post'
                ? 'Encerrado'
                : 'Relógio indisponível'),
        home: side(home),
        away: side(away),
      },
    ];
  });
  if (parsed.events.length && !matches.length)
    throw new Error(
      'Todas as partidas vieram incompletas; mantendo estado anterior',
    );
  return matches;
}
export async function fetchMatches(league: League): Promise<Match[]> {
  const now = Date.now();
  const date = (offset: number) =>
    new Date(now + offset * 86400000)
      .toISOString()
      .slice(0, 10)
      .replaceAll('-', '');
  const days = [-1, 0, 1].map(date);
  const results = await Promise.allSettled(
    days.map(async (day) =>
      parseMatches(
        JSON.parse(await fetchText(api(league, `scoreboard?dates=${day}`))),
        league,
      ),
    ),
  );
  const matches = new Map<string, Match>();
  let successes = 0;
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      successes++;
      for (const match of result.value) matches.set(match.id, match);
    } else {
      logger.warn(
        { err: result.reason, league, date: days[index] },
        'Falha na consulta diária dos jogos',
      );
    }
  }
  if (!successes) {
    const failure = results.find((result) => result.status === 'rejected');
    throw failure?.status === 'rejected'
      ? failure.reason
      : new Error('Consulta de jogos indisponível');
  }
  return [...matches.values()];
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
