import { fetchText } from './provider.js';

const season = new Date().getUTCFullYear();
export const standingsUrl = `https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-a/${season}`;
const geStandingsUrl = 'https://ge.globo.com/futebol/brasileirao-serie-a/';

const browserHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
} as const;

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

export type StandingsSource = 'CBF' | 'ge';

type JsonObject = Record<string, unknown>;

type StandingsSnapshot = {
  rows: Standing[];
  fetchedAt: number;
  source: StandingsSource;
};

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

const entities: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

function decodeHtml(value: string) {
  return value.replace(/&(#x?[\da-f]+|[a-z]+);/gi, (full, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return entities[entity.toLowerCase()] ?? full;
  });
}

function textContent(value: string) {
  return decodeHtml(
    value.replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function numberFromHtml(value: string) {
  const match = textContent(value).match(/-?\d+/);
  return match ? integer(match[0]) : undefined;
}

function validateStandings(rows: Standing[]) {
  rows.sort((a, b) => a.position - b.position);

  if (
    rows.length !== 20 ||
    new Set(rows.map((row) => row.team.toLocaleLowerCase('pt-BR'))).size !== 20 ||
    rows.some((row, index) => row.position !== index + 1) ||
    rows.some(
      (row) =>
        row.played !== row.wins + row.draws + row.losses ||
        row.difference !== row.goalsFor - row.goalsAgainst ||
        [
          row.played,
          row.wins,
          row.draws,
          row.losses,
          row.goalsFor,
          row.goalsAgainst,
          row.points,
        ].some((value) => value < 0),
    )
  )
    throw new Error('Classificação inválida ou incompleta');

  return rows;
}

export function parseCbfStandings(html: string): Standing[] {
  const rows: Standing[] = [];
  const tableRows = html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi);

  for (const tableRow of tableRows) {
    const cells = [...tableRow[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (match) => match[1]!,
    );
    if (cells.length < 9) continue;

    const firstCell = textContent(cells[0]!);
    const positionMatch = firstCell.match(/^\s*(\d{1,2})\s*(?:[+-]\s*\d+|0)?/);
    const position = positionMatch ? integer(positionMatch[1]) : undefined;
    if (!position || position > 20) continue;

    const links = [...cells[0]!.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => textContent(match[1]!))
      .filter((value) => /[A-Za-zÀ-ÿ]/.test(value));
    const team =
      links.sort((a, b) => b.length - a.length)[0] ??
      firstCell
        .replace(/^\s*\d{1,2}\s*(?:[+-]\s*\d+|0)?\s*/, '')
        .trim();

    const points = numberFromHtml(cells[1]!);
    const played = numberFromHtml(cells[2]!);
    const wins = numberFromHtml(cells[3]!);
    const draws = numberFromHtml(cells[4]!);
    const losses = numberFromHtml(cells[5]!);
    const goalsFor = numberFromHtml(cells[6]!);
    const goalsAgainst = numberFromHtml(cells[7]!);
    const difference = numberFromHtml(cells[8]!);

    if (
      !team ||
      points === undefined ||
      played === undefined ||
      wins === undefined ||
      draws === undefined ||
      losses === undefined ||
      goalsFor === undefined ||
      goalsAgainst === undefined ||
      difference === undefined
    )
      continue;

    rows.push({
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
    });
  }

  return validateStandings(rows);
}

function extractJsonLiteral(script: string, name: string) {
  const marker = `const ${name} =`;
  const markerIndex = script.indexOf(marker);
  if (markerIndex < 0) throw new Error(`${name} não encontrado no GE`);

  const objectStart = script.indexOf('{', markerIndex + marker.length);
  if (objectStart < 0) throw new Error(`${name} inválido no GE`);

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = objectStart; index < script.length; index += 1) {
    const char = script[index]!;

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return script.slice(objectStart, index + 1);
    }
  }

  throw new Error(`${name} incompleto no GE`);
}

export function parseGeStandings(html: string): Standing[] {
  const script = html.match(
    /<script\b(?=[^>]*\bid=["']scriptReact["'])[^>]*>([\s\S]*?)<\/script>/i,
  )?.[1];
  if (!script) throw new Error('Dados da classificação não encontrados no GE');

  const data = object(JSON.parse(extractJsonLiteral(script, 'classificacao')));
  if (!data || !Array.isArray(data.classificacao))
    throw new Error('Classificação inválida no GE');

  const rows = data.classificacao.map((rawRow) => {
    const row = object(rawRow);
    if (!row) throw new Error('Linha inválida no GE');

    const position = integer(row.ordem);
    const team =
      typeof row.nome_popular === 'string' ? row.nome_popular.trim() : '';
    const points = integer(row.pontos);
    const played = integer(row.jogos);
    const wins = integer(row.vitorias);
    const draws = integer(row.empates);
    const losses = integer(row.derrotas);
    const goalsFor = integer(row.gols_pro);
    const goalsAgainst = integer(row.gols_contra);
    const difference = integer(row.saldo_gols);

    if (
      !position ||
      !team ||
      points === undefined ||
      played === undefined ||
      wins === undefined ||
      draws === undefined ||
      losses === undefined ||
      goalsFor === undefined ||
      goalsAgainst === undefined ||
      difference === undefined
    )
      throw new Error('Linha incompleta no GE');

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

  return validateStandings(rows);
}

let cached: StandingsSnapshot | undefined;
let pending: Promise<StandingsSnapshot> | undefined;

async function fetchLiveStandings(): Promise<StandingsSnapshot> {
  const sources: Array<{
    source: StandingsSource;
    url: string;
    parser: (html: string) => Standing[];
  }> = [
    { source: 'CBF', url: standingsUrl, parser: parseCbfStandings },
    { source: 'ge', url: geStandingsUrl, parser: parseGeStandings },
  ];
  const errors: string[] = [];

  for (const source of sources) {
    try {
      const html = await fetchText(source.url, 12000, browserHeaders);
      return {
        rows: source.parser(html),
        fetchedAt: Date.now(),
        source: source.source,
      };
    } catch (error) {
      errors.push(
        `${source.source}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  throw new Error(`Fontes da classificação indisponíveis: ${errors.join(' | ')}`);
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
