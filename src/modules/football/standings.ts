import { fetchText } from './provider.js';

export const standingsUrl =
  'https://www.espn.com.br/futebol/classificacao/_/liga/bra.1';

const standingsApiUrls = [
  'https://site.api.espn.com/apis/v2/sports/soccer/bra.1/standings',
  'https://site.web.api.espn.com/apis/v2/sports/soccer/bra.1/standings',
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
  return Number.isFinite(parsed) && Number.isInteger(parsed) ? parsed : undefined;
};

function entryStats(entry: JsonObject) {
  const stats = Array.isArray(entry.stats) ? entry.stats : [];
  const values = new Map<string, number>();

  for (const rawStat of stats) {
    const stat = object(rawStat);
    if (!stat || typeof stat.name !== 'string') continue;
    const value = integer(stat.value ?? stat.displayValue);
    if (value !== undefined) values.set(stat.name.toLowerCase(), value);
  }

  return values;
}

const stat = (stats: Map<string, number>, ...names: string[]) => {
  for (const name of names) {
    const value = stats.get(name.toLowerCase());
    if (value !== undefined) return value;
  }
  return undefined;
};

export function parseStandings(payload: string | unknown): Standing[] {
  const data = object(
    typeof payload === 'string' ? JSON.parse(payload) : payload,
  );
  if (!data || !Array.isArray(data.children))
    throw new Error('Classificação da ESPN inválida');

  const groups = data.children
    .map(object)
    .filter((child): child is JsonObject => Boolean(child))
    .map((child) => object(child.standings))
    .filter((standings): standings is JsonObject => Boolean(standings))
    .map((standings) =>
      Array.isArray(standings.entries) ? standings.entries : [],
    )
    .filter((entries) => entries.length > 0)
    .sort((a, b) => b.length - a.length);

  const entries = groups[0];
  if (!entries || entries.length !== 20)
    throw new Error('Classificação incompleta');

  const result = entries.map((rawEntry, index) => {
    const entry = object(rawEntry);
    const teamData = entry ? object(entry.team) : undefined;
    if (!entry || !teamData) throw new Error('Linha de classificação inválida');

    const team =
      typeof teamData.displayName === 'string'
        ? teamData.displayName.trim()
        : typeof teamData.name === 'string'
          ? teamData.name.trim()
          : '';
    const stats = entryStats(entry);

    const position =
      integer(entry.position) ??
      stat(stats, 'rank', 'playoffSeed') ??
      index + 1;
    const played = stat(stats, 'gamesPlayed');
    const wins = stat(stats, 'wins');
    const draws = stat(stats, 'ties', 'draws');
    const losses = stat(stats, 'losses');
    const goalsFor = stat(stats, 'goalsFor');
    const goalsAgainst = stat(stats, 'goalsAgainst');
    const difference = stat(stats, 'goalDifference', 'differential');
    const points = stat(stats, 'points');

    if (
      !team ||
      !position ||
      played === undefined ||
      wins === undefined ||
      draws === undefined ||
      losses === undefined ||
      goalsFor === undefined ||
      goalsAgainst === undefined ||
      difference === undefined ||
      points === undefined
    )
      throw new Error('Linha de classificação inválida');

    if (
      played !== wins + draws + losses ||
      difference !== goalsFor - goalsAgainst ||
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

async function fetchLiveStandings() {
  let lastError: unknown;

  for (const url of standingsApiUrls) {
    try {
      return {
        rows: parseStandings(await fetchText(url)),
        fetchedAt: Date.now(),
      };
    } catch (error) {
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
