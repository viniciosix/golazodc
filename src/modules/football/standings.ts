import { fetchText } from './provider.js';

export const standingsUrl =
  'https://www.sofascore.com/pt/football/tournament/brazil/brasileirao-serie-a/325';

const tournamentId = 325;
const sofascoreBases = [
  'https://www.sofascore.com/api/v1',
  'https://api.sofascore.com/api/v1',
] as const;

export interface Standing {
  position: number;
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  difference: number;
  points: number;
}

type JsonObject = Record<string, unknown>;

const object = (value: unknown): JsonObject | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;

const integer = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed)
    ? parsed
    : undefined;
};

export function parseStandings(payload: string | unknown): Standing[] {
  const data = object(
    typeof payload === 'string' ? JSON.parse(payload) : payload,
  );
  if (!data || !Array.isArray(data.standings))
    throw new Error('Classificação do Sofascore inválida');

  const groups = data.standings
    .map(object)
    .filter((group): group is JsonObject => Boolean(group))
    .map((group) => (Array.isArray(group.rows) ? group.rows : []))
    .filter((rows) => rows.length > 0)
    .sort((a, b) => b.length - a.length);

  const rows = groups[0];
  if (!rows || rows.length !== 20) throw new Error('Classificação incompleta');

  const result = rows.map((rawRow) => {
    const row = object(rawRow);
    const teamData = row ? object(row.team) : undefined;
    if (!row || !teamData) throw new Error('Linha de classificação inválida');

    const team =
      typeof teamData.name === 'string'
        ? teamData.name.trim()
        : typeof teamData.shortName === 'string'
          ? teamData.shortName.trim()
          : '';
    const position = integer(row.position);
    const played = integer(row.matches);
    const wins = integer(row.wins);
    const draws = integer(row.draws);
    const losses = integer(row.losses);
    const goalsFor = integer(row.scoresFor);
    const goalsAgainst = integer(row.scoresAgainst);
    const points = integer(row.points);

    if (
      !team ||
      !position ||
      played === undefined ||
      wins === undefined ||
      draws === undefined ||
      losses === undefined ||
      goalsFor === undefined ||
      goalsAgainst === undefined ||
      points === undefined
    )
      throw new Error('Linha de classificação inválida');

    const difference = goalsFor - goalsAgainst;

    if (
      played !== wins + draws + losses ||
      [played, wins, draws, losses, goalsFor, goalsAgainst, points].some(
        (value) => value < 0,
      )
    )
      throw new Error('Estatísticas inconsistentes');

    return {
      position,
      team,
      played,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      difference,
      points,
    };
  });

  result.sort((a, b) => a.position - b.position);

  if (
    new Set(result.map((value) => value.team)).size !== 20 ||
    result.some((row, index) => row.position !== index + 1)
  )
    throw new Error('Classificação inválida');

  return result;
}

let cached: { rows: Standing[]; fetchedAt: number } | undefined;
let pending: Promise<{ rows: Standing[]; fetchedAt: number }> | undefined;
let seasonCache: { id: number; expiresAt: number } | undefined;

async function currentSeasonId(base: string) {
  if (seasonCache && seasonCache.expiresAt > Date.now()) return seasonCache.id;

  const data = object(
    JSON.parse(
      await fetchText(`${base}/unique-tournament/${tournamentId}/seasons`),
    ),
  );
  if (!data || !Array.isArray(data.seasons))
    throw new Error('Temporadas do Sofascore indisponíveis');

  const seasons = data.seasons
    .map(object)
    .filter((season): season is JsonObject => Boolean(season));
  const currentYear = String(new Date().getUTCFullYear());
  const current =
    seasons.find((season) => season.year === currentYear) ?? seasons[0];
  const id = current ? integer(current.id) : undefined;
  if (!id) throw new Error('Temporada atual não encontrada');

  seasonCache = { id, expiresAt: Date.now() + 21600000 };
  return id;
}

async function fetchLiveStandings() {
  let lastError: unknown;

  for (const base of sofascoreBases) {
    try {
      const seasonId = await currentSeasonId(base);
      const url = `${base}/unique-tournament/${tournamentId}/season/${seasonId}/standings/total`;
      return {
        rows: parseStandings(await fetchText(url)),
        fetchedAt: Date.now(),
      };
    } catch (error) {
      seasonCache = undefined;
      lastError = error;
    }
  }

  throw lastError ?? new Error('Fontes da classificação indisponíveis');
}

export async function getStandings() {
  if (cached && Date.now() - cached.fetchedAt < 60000)
    return { ...cached, stale: false };

  try {
    pending ??= fetchLiveStandings().finally(() => {
      pending = undefined;
    });
    cached = await pending;
    return { ...cached, stale: false };
  } catch (error) {
    if (cached && Date.now() - cached.fetchedAt < 3600000)
      return { ...cached, stale: true };
    throw error;
  }
}
