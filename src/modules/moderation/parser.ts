export const MODERATION_PREFIX = '.';

export const normalizeModerationText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export const containsFilteredWord = (message: string, word: string) => {
  const normalizedMessage = normalizeModerationText(message);
  const normalizedWord = normalizeModerationText(word);
  return (
    normalizedWord.length > 0 &&
    ` ${normalizedMessage} `.includes(` ${normalizedWord} `)
  );
};

interface TextToken {
  normalized: string;
  start: number;
  end: number;
}

const tokenizeWithPositions = (value: string): TextToken[] =>
  [...value.matchAll(/[\p{L}\p{N}\p{M}]+/gu)].map((match) => ({
    normalized: normalizeModerationText(match[0]),
    start: match.index,
    end: match.index + match[0].length,
  }));

export function censorFilteredWords(message: string, words: string[]) {
  const tokens = tokenizeWithPositions(message);
  const hidden = new Set<number>();
  const matches = new Set<string>();

  for (const word of words) {
    const rule = normalizeModerationText(word).split(' ').filter(Boolean);
    if (!rule.length || rule.length > tokens.length) continue;
    for (let index = 0; index <= tokens.length - rule.length; index += 1) {
      const found = rule.every(
        (part, offset) => tokens[index + offset]?.normalized === part,
      );
      if (!found) continue;
      matches.add(normalizeModerationText(word));
      const start = tokens[index]!.start;
      const end = tokens[index + rule.length - 1]!.end;
      for (let position = start; position < end; position += 1) {
        if (/[\p{L}\p{N}\p{M}]/u.test(message[position]!)) hidden.add(position);
      }
    }
  }

  return {
    content: message
      .split('')
      .map((character, index) => (hidden.has(index) ? '*' : character))
      .join(''),
    matches: [...matches],
  };
}

const units = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
} as const;

export function parseDuration(value?: string): number | undefined {
  if (!value) return undefined;
  const match = /^(\d{1,3})(s|m|h|d|w)$/i.exec(value);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = match[2]!.toLowerCase() as keyof typeof units;
  const duration = amount * units[unit];
  if (amount < 1 || duration > 365 * units.d) return undefined;
  return duration;
}

export function parsePrefixCommand(content: string) {
  if (!content.startsWith(MODERATION_PREFIX)) return undefined;
  const body = content.slice(MODERATION_PREFIX.length).trim();
  if (!body) return undefined;
  const [name = '', ...args] = body.split(/\s+/);
  return { name: name.toLocaleLowerCase('pt-BR'), args };
}
