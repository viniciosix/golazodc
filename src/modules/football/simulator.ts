import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { UserError } from '../../core/errors.js';
import type { Match } from './provider.js';
import type { CommentaryLine } from './commentary.js';
import { EVENT_EMOJIS, type EventEmojis } from './event-format.js';
import { narrationPanel, narrationPayload } from './narration.js';
export const SIMULATION_ACTIONS = {
  goal: 'Gol São Paulo',
  away: 'Gol adversário',
  foul: 'Falta',
  corner: 'Escanteio',
  yellow: 'Amarelo',
  red: 'Vermelho',
  substitution: 'Substituição',
  minute: '+5 minutos',
  halftime: 'Intervalo',
  second: '2º tempo',
  reset: 'Reiniciar',
  end: 'Encerrar',
} as const;
export type SimulationAction = keyof typeof SIMULATION_ACTIONS;
export interface Simulation {
  ownerId: string;
  guildId: string;
  expires: number;
  minute: number;
  sequence: number;
  match: Match;
  lines: CommentaryLine[];
}
const sessions = new Map<string, { state: Simulation; busy: boolean }>();
export function newSimulation(ownerId: string, guildId: string): Simulation {
  return {
    ownerId,
    guildId,
    expires: Date.now() + 3600000,
    minute: 0,
    sequence: 0,
    lines: [],
    match: {
      id: 'simulation',
      date: new Date().toISOString(),
      state: 'in',
      clock: "0'",
      home: { id: '2026', name: 'São Paulo', score: 0 },
      away: { id: 'sim-away', name: 'LDU Quito', score: 0 },
      competition: {
        name: 'Sul-Americana · demonstração',
        logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/1208.png',
      },
    },
  };
}
export function simulationAction(
  state: Simulation,
  action: SimulationAction,
): Simulation {
  if (!Object.hasOwn(SIMULATION_ACTIONS, action))
    throw new UserError('Ação de teste inválida.');
  if (action === 'reset')
    return {
      ...newSimulation(state.ownerId, state.guildId),
      expires: state.expires,
    };
  if (state.match.state === 'post')
    throw new UserError('A simulação terminou. Clique em Reiniciar.');
  const next = structuredClone(state);
  let text: string;
  switch (action) {
    case 'goal':
      next.match.home.score++;
      text = `Gol! São Paulo ${next.match.home.score}, LDU Quito ${next.match.away.score}. Calleri (São Paulo) finaliza.`;
      break;
    case 'away':
      next.match.away.score++;
      text = `Gol! São Paulo ${next.match.home.score}, LDU Quito ${next.match.away.score}. Atacante (LDU Quito) finaliza.`;
      break;
    case 'foul':
      text = 'Lucas Moura (São Paulo) sofre uma falta no campo adversário.';
      break;
    case 'corner':
      text = 'Escanteio, São Paulo. Cedido pelo adversário.';
      break;
    case 'yellow':
      text =
        'Defensor (LDU Quito) recebe cartão amarelo por uma entrada perigosa.';
      break;
    case 'red':
      text = 'Defensor (LDU Quito) recebe cartão vermelho.';
      break;
    case 'substitution':
      text =
        'Substituição São Paulo, entra em campo Luciano substituindo Calleri.';
      break;
    case 'minute':
      next.minute = Math.min(120, next.minute + 5);
      next.match.clock = `${next.minute}'`;
      text = 'Bola em jogo.';
      break;
    case 'halftime':
      next.minute = 45;
      next.match.clock = 'Intervalo';
      text = 'Fim do primeiro tempo.';
      break;
    case 'second':
      next.minute = 46;
      next.match.clock = "46'";
      text = 'Início do segundo tempo.';
      break;
    case 'end':
      next.match.state = 'post';
      next.match.clock = 'Encerrado';
      text = 'Fim do jogo.';
      break;
  }
  next.lines = [
    ...next.lines,
    { sequence: ++next.sequence, clock: next.match.clock, text },
  ].slice(-5);
  return next;
}
export function simulationView(
  state: Simulation,
  emojis: EventEmojis = EVENT_EMOJIS,
) {
  const panel = narrationPanel(state.match, state.lines, -1, false, emojis, {
    simulation: true,
  });
  const buttons = Object.entries(SIMULATION_ACTIONS);
  for (let i = 0; i < buttons.length; i += 4)
    panel.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...buttons.slice(i, i + 4).map(([action, label]) =>
          new ButtonBuilder()
            .setCustomId(`narration-test:${action}`)
            .setLabel(label)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(state.match.state === 'post' && action !== 'reset'),
        ),
      ),
    );
  return narrationPayload(panel);
}
export function registerSimulation(messageId: string, state: Simulation) {
  for (const [id, entry] of sessions)
    if (entry.state.expires <= Date.now() && !entry.busy) sessions.delete(id);
  if (sessions.size >= 100) {
    const oldest = [...sessions].find(([, entry]) => !entry.busy);
    if (oldest) sessions.delete(oldest[0]);
    else throw new UserError('Muitos testes em andamento. Tente novamente.');
  }
  sessions.set(messageId, { state: structuredClone(state), busy: false });
}
export async function updateSimulation(
  messageId: string,
  ownerId: string,
  guildId: string,
  action: SimulationAction,
  render: (state: Simulation) => Promise<void>,
) {
  const entry = sessions.get(messageId);
  if (!entry || entry.state.expires <= Date.now()) {
    if (entry && !entry.busy) sessions.delete(messageId);
    throw new UserError(
      'Teste expirado ou bot reiniciado. Abra outro com /gols teste.',
    );
  }
  if (entry.state.ownerId !== ownerId || entry.state.guildId !== guildId)
    throw new UserError(
      'Somente quem abriu este teste pode usar os botões. Abra seu próprio /gols teste.',
    );
  if (entry.busy)
    throw new UserError('Aguarde a atualização anterior e clique novamente.');
  const next = simulationAction(entry.state, action);
  entry.busy = true;
  try {
    await render(next);
    entry.state = next;
  } finally {
    entry.busy = false;
  }
}
