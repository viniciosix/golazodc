import { z } from 'zod';
import { fetchText, leagueSchema, type League } from './provider.js';
export interface CommentaryLine {
  sequence: number;
  clock: string;
  text: string;
}
const lineSchema = z.object({
  sequence: z
    .union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)])
    .transform(Number)
    .refine(Number.isSafeInteger),
  text: z.string().min(1),
  time: z.object({ displayValue: z.string().nullish() }).nullish(),
});
export function parseCommentary(input: unknown): CommentaryLine[] {
  const data = z
    .object({ commentary: z.array(z.unknown()).nullish() })
    .parse(input);
  const lines = (data.commentary || []).flatMap((raw) => {
    const parsed = lineSchema.safeParse(raw);
    return parsed.success
      ? [
          {
            sequence: parsed.data.sequence,
            clock: parsed.data.time?.displayValue || '',
            text: parsed.data.text,
          },
        ]
      : [];
  });
  return [...new Map(lines.map((line) => [line.sequence, line])).values()].sort(
    (a, b) => a.sequence - b.sequence,
  );
}
export async function fetchCommentary(league: League, eventId: string) {
  if (!/^\d+$/.test(eventId)) throw new Error('ID de partida inválido');
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSchema.parse(league)}/summary?event=${eventId}&lang=pt&region=br`;
  return parseCommentary(JSON.parse(await fetchText(url)));
}
