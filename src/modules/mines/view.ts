import { menuId, newMenu } from './menu.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import type { MinesGame } from '@prisma/client';
import { TRICORD_RED } from '../../core/brand.js';
import { MINES, multiplier, payout } from './rules.js';
const coins = (value: bigint) => value.toLocaleString('pt-BR');
export function minesView(game: MinesGame) {
  const active = game.status === 'ACTIVE';
  const safe = game.revealed.filter((i) => !game.bombs.includes(i)).length;
  const amount = payout(game.bet, game.bombs.length, safe);
  const status = active
    ? 'Escolha uma casa ou retire seu prêmio.'
    : game.status === 'LOST'
      ? '💥 Você encontrou uma bomba e perdeu a aposta.'
      : game.status === 'CANCELLED'
        ? 'Aposta devolvida. Partida cancelada antes da primeira jogada.'
        : game.status === 'WON'
          ? '💎 Todas as casas seguras! Prêmio creditado.'
          : 'Prêmio retirado e creditado na carteira.';
  const description = `${status}\n\n**Aposta:** ${coins(game.bet)} Tricoins • **Bombas:** ${game.bombs.length}\n**Casas seguras:** ${safe}/${MINES.cells - game.bombs.length}\n${active ? `**Retirada agora:** ${coins(amount)} Tricoins • ${multiplier(game.bombs.length, safe)}×${safe < MINES.cells - game.bombs.length ? `\n**Próximo acerto:** ${coins(payout(game.bet, game.bombs.length, safe + 1))} Tricoins • ${multiplier(game.bombs.length, safe + 1)}×\n**Chance do próximo acerto:** ${(((MINES.cells - game.bombs.length - safe) / (MINES.cells - safe)) * 100).toFixed(1)}%` : ''}` : `**Recebido:** ${coins(game.prize)} Tricoins\n**Resultado líquido:** ${coins(game.prize - game.bet)} Tricoins`}`;
  const embed = new EmbedBuilder()
    .setColor(TRICORD_RED)
    .setTitle('💎 MINES • TRICORD')
    .setDescription(description)
    .setFooter({
      text: 'Tricoins virtuais • margem de 5% + arredondamento • /mines e clique em Continuar para retomar',
    });
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let row = 0; row < 4; row++) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...Array.from({ length: 4 }, (_, col) => {
          const cell = row * 4 + col;
          const visible = !active || game.revealed.includes(cell);
          return new ButtonBuilder()
            .setCustomId(`mines:${game.id}:${game.revision}:${cell}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel(
              visible
                ? game.bombs.includes(cell)
                  ? '💣'
                  : '💎'
                : String(cell + 1),
            )
            .setDisabled(!active || game.revealed.includes(cell));
        }),
      ),
    );
  }
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`mines:${game.id}:${game.revision}:cash`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel(
          safe
            ? `Retirar ${coins(amount)} Tricoins`
            : 'Cancelar e devolver aposta',
        )
        .setDisabled(!active),
    ),
  );
  if (!active)
    rows[4]!.addComponents(
      new ButtonBuilder()
        .setCustomId(
          menuId(
            newMenu(game.ownerId, Number(game.bet), game.bombs.length),
            'new',
          ),
        )
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Jogar novamente'),
    );
  return {
    embeds: [embed],
    components: rows,
    allowedMentions: { parse: [] as never[] },
  };
}
