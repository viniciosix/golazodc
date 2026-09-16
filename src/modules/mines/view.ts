import { menuId, newMenu } from './menu.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { MinesGame } from '@prisma/client';
import { multiplier, payout } from './rules.js';
import { infoRow, minesPanel, panelPayload } from './panel.js';
const coins = (value: bigint) => value.toLocaleString('pt-BR');
export function minesView(game: MinesGame, avatar?: string) {
  const active = game.status === 'ACTIVE';
  const safe = game.revealed.filter((i) => !game.bombs.includes(i)).length;
  const amount = payout(game.bet, game.bombs.length, safe);
  const status = active
    ? 'Escolha uma casa ou retire seu prêmio.'
    : game.status === 'LOST'
      ? 'Você encontrou uma bomba e perdeu a aposta.'
      : game.status === 'CANCELLED'
        ? 'Aposta devolvida. Nenhuma casa foi aberta.'
        : game.status === 'WON'
          ? 'Todas as casas seguras. Prêmio creditado.'
          : 'Prêmio retirado e creditado na carteira.';
  const panel = minesPanel(status).addActionRowComponents(
    infoRow('round', [
      `Aposta: ${coins(game.bet)}`,
      `Bombas: ${game.bombs.length}`,
      `Acertos: ${safe}/${16 - game.bombs.length}`,
      `${multiplier(game.bombs.length, safe)}×`,
    ]),
  );
  panel.addActionRowComponents(
    infoRow(
      'prize',
      active
        ? [
            `Retirada: ${coins(amount)} TC`,
            `Próximo: ${coins(payout(game.bet, game.bombs.length, safe + 1))} TC`,
            `Chance: ${(((16 - game.bombs.length - safe) / (16 - safe)) * 100).toFixed(1)}%`,
          ]
        : [
            `Recebido: ${coins(game.prize)} TC`,
            `Resultado: ${coins(game.prize - game.bet)} TC`,
            'PARTIDA ENCERRADA',
          ],
    ),
  );
  for (let row = 0; row < 4; row++) {
    panel.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...Array.from({ length: 4 }, (_, col) => {
          const cell = row * 4 + col;
          const visible = !active || game.revealed.includes(cell);
          const bomb = visible && game.bombs.includes(cell);
          const button = new ButtonBuilder()
            .setCustomId(`mines:${game.id}:${game.revision}:${cell}`)
            .setStyle(bomb ? ButtonStyle.Danger : ButtonStyle.Secondary)
            .setDisabled(!active || game.revealed.includes(cell));
          if (visible) button.setEmoji(bomb ? '💣' : '💎');
          else button.setLabel(String(cell + 1));
          return button;
        }),
      ),
    );
  }
  const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`mines:${game.id}:${game.revision}:cash`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel(`RETIRAR ${coins(amount)} TRICOINS`)
      .setDisabled(!active),
  );
  if (!active)
    actions.addComponents(
      new ButtonBuilder()
        .setCustomId(
          menuId(
            newMenu(game.ownerId, Number(game.bet), game.bombs.length),
            'new',
          ),
        )
        .setStyle(ButtonStyle.Secondary)
        .setLabel('JOGAR NOVAMENTE'),
    );
  panel.addActionRowComponents(actions);
  return panelPayload(panel, avatar);
}
