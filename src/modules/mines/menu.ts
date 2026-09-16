import { randomUUID } from 'node:crypto';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import type { PrismaClient } from '@prisma/client';
import { TRICORD_RED } from '../../core/brand.js';
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
export async function menuView(db: PrismaClient, menu: MinesMenu) {
  const user = await db.user.findUnique({
    where: { discordId: menu.owner },
    select: { coins: true },
  });
  const balance = user?.coins ?? 0n;
  const embed = new EmbedBuilder()
    .setColor(TRICORD_RED)
    .setTitle('💎 MINES')
    .setDescription(
      `**Carteira:** ${balance.toLocaleString('pt-BR')} Tricoins\n\n**Aposta:** ${menu.bet} Tricoins\n**Bombas:** ${menu.bombs} 💣 • **Diamantes:** ${16 - menu.bombs} 💎\n\n**Primeiro acerto:** ${payout(BigInt(menu.bet), menu.bombs, 1)} Tricoins · ${multiplier(menu.bombs, 1)}×\n**Chance do primeiro acerto:** ${(((16 - menu.bombs) / 16) * 100).toFixed(1)}%\n\nEscolha abaixo e clique em **Jogar**.${balance < BigInt(menu.bet) ? '\nSaldo insuficiente para esta aposta. Use /diario ou reduza o valor.' : ''}`,
    )
    .setFooter({
      text: 'TRICORD • Só cobra ao jogar • Tricoins virtuais • Margem 5% + arredondamento',
    });
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
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(bet),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(bombs),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button('minus', '−1').setDisabled(menu.bet === 1),
        button('plus', '+1').setDisabled(menu.bet === MINES.maxBet),
        button('half', '½ aposta').setDisabled(menu.bet === 1),
        button('double', '2× aposta').setDisabled(menu.bet === MINES.maxBet),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button('start', `▶ Jogar • ${menu.bet} Tricoins`).setDisabled(
          balance < BigInt(menu.bet),
        ),
        button('resume', 'Continuar / último resultado'),
      ),
    ],
    allowedMentions: { parse: [] as never[] },
  };
}
