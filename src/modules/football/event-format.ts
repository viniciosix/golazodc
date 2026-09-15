import { escapeMarkdown, type Client, type Guild } from 'discord.js';
import type { CommentaryLine } from './commentary.js';
export const EVENT_EMOJIS = {
  goal: '⚽',
  corner: '🚩',
  foul: '🛑',
  yellow: '🟨',
  red: '🟥',
  substitution: '🔄',
  offside: '🚩',
  saved: '🧤',
  missed: '↗️',
  blocked: '🛡️',
  penalty: '🎯',
  var: '📺',
  period: '⏱️',
  other: '•',
} as const;
export type EventKind = keyof typeof EVENT_EMOJIS;
export type EventEmojis = Record<EventKind, string>;
export const CUSTOM_EVENT_EMOJIS = {
  corner: '1549263062807089233',
  foul: '1549262592030023740',
  goal: '1549262590679720057',
  substitution: '1549262582810943518',
} as const;
export function resolveEventEmojis(
  client: Client,
  guild?: Guild | null,
): EventEmojis {
  const result: EventEmojis = { ...EVENT_EMOJIS };
  for (const [kind, id] of Object.entries(CUSTOM_EVENT_EMOJIS)) {
    const appEmoji = client.application?.emojis?.cache.get(id);
    const guildEmoji = guild?.emojis.cache.get(id);
    if (appEmoji) result[kind as EventKind] = appEmoji.toString();
    else if (
      guildEmoji &&
      guildEmoji.available &&
      (!guildEmoji.roles.cache.size ||
        guildEmoji.roles.cache.some((role) =>
          Boolean(guild?.members.me?.roles.cache.has(role.id)),
        ))
    )
      result[kind as EventKind] = guildEmoji.toString();
  }
  return result;
}
function clip(value: string, max = 150) {
  const clean = value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/, '');
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}
export function compactEvent(input: string): {
  kind: EventKind;
  title: string;
  detail: string;
} {
  const text = input.replace(/\s+/g, ' ').trim();
  const result = (kind: EventKind, title: string, detail = '') => ({
    kind,
    title,
    detail: clip(detail),
  });
  let m: RegExpMatchArray | null;
  if (
    /gol (?:anulado|cancelado)|goal (?:disallowed|cancelled)|no goal/i.test(
      text,
    )
  )
    return result('var', 'Gol anulado', text);
  if (/\bVAR\b|video review|revisão (?:do|de) vídeo/i.test(text))
    return result(
      'var',
      'VAR',
      text.replace(/^(?:Decisão do VAR|VAR decision)[:!.,\s]*/i, ''),
    );
  if (
    (m = text.match(
      /^Substituição\s+(.+?),\s*entra em campo\s+(.+?)\s+substituindo\s+(.+?)(?:\s+(?:uma lesão|por lesão))?\.?$/i,
    ))
  )
    return result(
      'substitution',
      'Substituição',
      `${m[1]} · entra ${m[2]} · sai ${m[3]}`,
    );
  if (
    (m = text.match(
      /^(?:Substituição|Substitution),?\s*(.*?)\.\s*(.+?)\s+(?:substitui|replaces)\s+(.+?)(?:\s+(?:por causa de|because of).*)?\.?$/i,
    ))
  )
    return result(
      'substitution',
      'Substituição',
      `${m[1]} · entra ${m[2]} · sai ${m[3]}`,
    );
  if (/^Substitui[çc][aã]o|^Substitution/i.test(text))
    return result(
      'substitution',
      'Substituição',
      text.replace(/^(?:Substituição|Substitution)[:,.\s]*/i, ''),
    );
  if (
    /segundo cart[aã]o amarelo|second yellow|cart[aã]o vermelho|red card|foi expulso/i.test(
      text,
    )
  ) {
    const player = text.match(
      /^(.+?)\s+(?:recebe|recebeu|é expulso|foi expulso|is shown|gets)/i,
    )?.[1];
    return result(
      'red',
      /segundo|second/i.test(text) ? 'Expulso · 2º amarelo' : 'Cartão vermelho',
      player || text,
    );
  }
  if (/cart[aã]o amarelo|yellow card/i.test(text)) {
    const player = text.match(
      /^(.+?)\s+(?:recebe|recebeu|is shown|gets)/i,
    )?.[1];
    return result('yellow', 'Cartão amarelo', player || text);
  }
  if (/^(?:Gol|Goal)[!.]/i.test(text)) {
    const scorer = text.match(
      /^(?:Gol|Goal)[!.]\s*[^.]+\.\s*([^()]+\([^)]+\))/i,
    )?.[1];
    return result(
      'goal',
      'Gol!',
      scorer || text.replace(/^(?:Gol|Goal)[!.]\s*/i, '').split('. ')[0],
    );
  }
  if (/^Gol contra|^Own goal/i.test(text))
    return result(
      'goal',
      'Gol contra',
      text
        .replace(/^(?:Gol contra|Own goal)(?:\s+(?:de|by))?\s*/i, '')
        .split('. ')[0],
    );
  if (
    (m = text.match(
      /^(?:Escanteio|Corner)(?:,|\s+para(?:\s+o)?\s+)\s*([^.!]+)/i,
    ))
  )
    return result('corner', 'Escanteio', `Para ${m[1]}`);
  if ((m = text.match(/^(?:Falta cometida por|Foul by)\s+(.+?)\.?$/i)))
    return result('foul', 'Falta!', `Cometida por ${m[1]}`);
  if (
    (m = text.match(
      /^(.+?)\s+(?:sofre(?:u)?\s+(?:uma\s+)?falta|wins a free kick)/i,
    ))
  )
    return result('foul', 'Falta!', `${m[1]} sofreu a infração`);
  if ((m = text.match(/^(?:Impedimento|Offside)[,.:]?\s*([^.!]+)/i)))
    return result('offside', 'Impedimento', m[1]);
  if (
    /p[eê]nalti perdido|penalty missed|penalty saved|p[eê]nalti defendido/i.test(
      text,
    )
  )
    return result('penalty', 'Pênalti não convertido', text);
  if (/p[eê]nalti|penalty/i.test(text))
    return result('penalty', 'Pênalti', text.split('. ')[0]);
  if (/^Finalização defendida|^Attempt saved/i.test(text))
    return result(
      'saved',
      'Defesa',
      text
        .replace(/^(?:Finalização defendida|Attempt saved)\s*/i, '')
        .split('. ')[0],
    );
  if (/^Oportunidade perdida|^Attempt missed/i.test(text))
    return result(
      'missed',
      'Para fora',
      text
        .replace(/^(?:Oportunidade perdida|Attempt missed)\s*/i, '')
        .split('. ')[0],
    );
  if (/^Finalização bloqueada|^Attempt blocked/i.test(text))
    return result(
      'blocked',
      'Chute bloqueado',
      text
        .replace(/^(?:Finalização bloqueada|Attempt blocked)\s*/i, '')
        .split('. ')[0],
    );
  if (
    /^(?:Início|Fim|Final) d[oa]|^(?:First|Second) Half (?:begins|ends)|^Match ends/i.test(
      text,
    )
  )
    return result('period', '', text.split('. ')[0]);
  return result('other', '', text);
}
export function formatCommentary(
  line: CommentaryLine,
  emojis: EventEmojis = EVENT_EMOJIS,
) {
  const event = compactEvent(line.text);
  const clock = line.clock
    ? `**${escapeMarkdown(clip(line.clock, 20))}** `
    : '';
  return `${clock}${emojis[event.kind]} ${event.title ? `**${event.title}**` : ''}${event.title && event.detail ? ' ' : ''}${escapeMarkdown(event.detail)}`.trim();
}
