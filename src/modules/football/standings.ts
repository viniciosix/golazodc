import { fetchText } from './provider.js';
export const standingsUrl =
  'https://www.espn.com.br/futebol/classificacao/_/liga/bra.1';
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
const clean = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .trim();
export function parseStandings(html: string): Standing[] {
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(
    (m) => m[1]!,
  );
  const namesTable = tables.find((t) => /team-position/.test(t));
  const statsTable = tables.find(
    (t) => /stat-cell/.test(t) && !/team-position/.test(t),
  );
  if (!namesTable || !statsTable) throw new Error('Formato da tabela mudou');
  const headers = [
    ...(
      statsTable.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] || ''
    ).matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi),
  ].map((m) => clean(m[1]!));
  if (headers.join(',') !== 'J,V,E,D,GP,GC,SG,PTS')
    throw new Error('Colunas da tabela mudaram');
  const bodyRows = (t: string) => [
    ...(t.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] || '').matchAll(
      /<tr\b[^>]*data-idx="(\d+)"[^>]*>([\s\S]*?)<\/tr>/gi,
    ),
  ];
  const stats = new Map(
    bodyRows(statsTable).map((row) => [
      row[1],
      [...row[2]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
        clean(m[1]!),
      ),
    ]),
  );
  const result = bodyRows(namesTable).map((row) => {
    const position = Number(
      row[2]!.match(/class="[^"]*team-position[^"]*"[^>]*>(\d+)</)?.[1],
    );
    const team = clean(row[2]!.match(/<abbr\b[^>]*title="([^"]+)"/)?.[1] || '');
    const cells = stats.get(row[1]);
    if (
      !team ||
      !position ||
      !cells ||
      cells.length !== 8 ||
      cells.some((v) => !/^[+-]?\d+$/.test(v))
    )
      throw new Error('Linha de classificação inválida');
    const [
      played,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      difference,
      points,
    ] = cells.map(Number) as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    if (
      played !== wins + draws + losses ||
      difference !== goalsFor - goalsAgainst ||
      [played, wins, draws, losses, goalsFor, goalsAgainst, points].some(
        (v) => v < 0,
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
  if (
    result.length !== 20 ||
    new Set(result.map((v) => v.team)).size !== 20 ||
    result.some((r, i) => r.position !== i + 1)
  )
    throw new Error('Classificação incompleta');
  return result;
}
let cached: { rows: Standing[]; fetchedAt: number } | undefined;
let pending: Promise<{ rows: Standing[]; fetchedAt: number }> | undefined;
export async function getStandings() {
  if (cached && Date.now() - cached.fetchedAt < 60000)
    return { ...cached, stale: false };
  try {
    pending ??= fetchText(standingsUrl)
      .then((html) => ({ rows: parseStandings(html), fetchedAt: Date.now() }))
      .finally(() => {
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
