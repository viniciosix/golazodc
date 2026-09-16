import { randomUUID } from 'node:crypto';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import type { PrismaClient } from '@prisma/client';
import { infoRow, minesPanel, panelPayload } from './panel.js';
import { UserError } from '../../core/errors.js';
import { MINES, multiplier, payout, validateSettings } from './rules.js';
export interface MinesMenu {
  owner: string;
  token: string;
  bet: number;
  bombs: number;
}
export function newMenu(owner: string, bet = 1, bombs = 3): MinesMenu {
  return { owner, token: randomUUID(), bet, bombs };
}
export function menuId(menu: MinesMenu, action: string, prefix = 'mines-menu') {
  return `${prefix}:${menu.owner}:${menu.token}:${menu.bet}:${menu.bombs}:${action}`;
}
export function parseMenu(id: string, owner: string) {
  const [, actualOwner, token, bet, bombs, action] = id.split(':');
  if (actualOwner !== owner)
    throw new UserError('Abra seu próprio painel com /mines.');
  if (
    !token ||
    !/^[a-f0-9-]{36}$/.test(token) ||
    !bet ||
    !bombs ||
    !validateSettings(Number(bet), Number(bombs)) ||
    !action
  )
    throw new UserError('Painel inválido. Abra /mines novamente.');
  return {
    menu: { owner, token, bet: Number(bet), bombs: Number(bombs) },
    action,
  };
}
export async function menuView(
  db: PrismaClient,
  menu: MinesMenu,
  avatar?: string,
) {
  const user = await db.user.findUnique({
    where: { discordId: menu.owner },
    select: { coins: true },
  });
  const balance = user?.coins ?? 0n;
  const panel = minesPanel(
    balance < BigInt(menu.bet)
      ? 'Saldo insuficiente. Reduza a aposta ou use /diario.'
      : 'Escolha sua aposta e clique em JOGAR.',
    avatar,
  ).addActionRowComponents(
    infoRow('setup', [
      `Saldo: ${balance.toLocaleString('pt-BR')} TC`,
      `Aposta: ${menu.bet} TC`,
      `Bombas: ${menu.bombs}`,
      `Diamantes: ${16 - menu.bombs}`,
    ]),
    infoRow('preview', [
      `Primeiro acerto: ${payout(BigInt(menu.bet), menu.bombs, 1)} TC`,
      `${multiplier(menu.bombs, 1)}×`,
      `Chance: ${(((16 - menu.bombs) / 16) * 100).toFixed(1)}%`,
    ]),
  );
  const bet = new StringSelectMenuBuilder()
    .setCustomId(menuId(menu, 'bet', 'mines-options'))
    .setPlaceholder(`Aposta: ${menu.bet} Tricoins`)
    .addOptions(
      Array.from({ length: MINES.maxBet }, (_, i) => ({
        label: `${i + 1} Tricoin${i ? 's' : ''}`,
        value: String(i + 1),
        default: menu.bet === i + 1,
      })),
    );
  const bombs = new StringSelectMenuBuilder()
    .setCustomId(menuId(menu, 'bombs', 'mines-options'))
    .setPlaceholder(`Bombas: ${menu.bombs}`)
    .addOptions(
      Array.from({ length: MINES.maxBombs }, (_, i) => ({
        label: `${i + 1} bomba${i ? 's' : ''}`,
        description: `${15 - i} diamantes no tabuleiro`,
        value: String(i + 1),
        default: menu.bombs === i + 1,
      })),
    );
  const button = (action: string, label: string) =>
    new ButtonBuilder()
      .setCustomId(menuId(menu, action))
      .setStyle(ButtonStyle.Secondary)
      .setLabel(label);
  panel.addActionRowComponents<ButtonBuilder | StringSelectMenuBuilder>(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(bet),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(bombs),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      button('minus', '−1').setDisabled(menu.bet === 1),
      button('plus', '+1').setDisabled(menu.bet === MINES.maxBet),
      button('half', '½ aposta').setDisabled(menu.bet === 1),
      button('double', '2× aposta').setDisabled(menu.bet === MINES.maxBet),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      button('start', `JOGAR • ${menu.bet} TRICOINS`).setDisabled(
        balance < BigInt(menu.bet),
      ),
      button('resume', 'Continuar / último resultado'),
    ),
  );
  return panelPayload(panel);
}
