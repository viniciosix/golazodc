import { describe, expect, it } from 'vitest';
import type { MinesGame } from '@prisma/client';
import {
  drawBombs,
  payout,
  rewardFraction,
  validateSettings,
} from '../src/modules/mines/rules.js';
import { minesView } from '../src/modules/mines/view.js';
const game: MinesGame = {
  id: 'game',
  userId: 'internal',
  ownerId: 'owner',
  activeOwner: 'owner',
  guildId: 'guild',
  bet: 100n,
  bombs: [0, 7, 15],
  revealed: [],
  status: 'ACTIVE',
  prize: 0n,
  revision: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};
describe('Mines rules and board', () => {
  it('validates limits and draws unique bombs within the grid', () => {
    expect(validateSettings(1, 1)).toBe(true);
    for (const [bet, bombs] of [
      [0, 1],
      [26, 1],
      [10.5, 1],
      [10, 0],
      [10, 9],
      [10, 1.5],
    ])
      expect(validateSettings(bet!, bombs!)).toBe(false);
    for (let n = 1; n <= 8; n++) {
      const bombs = drawBombs(n);
      expect(bombs).toHaveLength(n);
      expect(new Set(bombs).size).toBe(n);
      expect(bombs.every((i) => i >= 0 && i < 16)).toBe(true);
    }
  });
  it('uses exact probability-based payouts, floors amounts and refunds unrevealed bets', () => {
    expect(payout(100n, 3, 0)).toBe(100n);
    expect(payout(100n, 3, 1)).toBe(116n);
    expect(payout(100n, 3, 2)).toBe(146n);
    expect(payout(100n, 3, 13)).toBe(53200n);
    expect(payout(1000n, 8, 8)).toBe(12226500n);
    for (let bombs = 1; bombs <= 8; bombs++) {
      let probability = 1;
      for (let k = 1; k <= 16 - bombs; k++) {
        probability *= (16 - bombs - k + 1) / (16 - k + 1);
        const f = rewardFraction(bombs, k);
        expect(
          (Number(f.numerator) / Number(f.denominator)) * probability,
        ).toBeCloseTo(0.95, 10);
      }
    }
  });
  it('hides bombs completely until the game ends and uses only gray buttons', () => {
    const board = minesView(game);
    const other = minesView({ ...game, bombs: [3, 9, 12] });
    expect(JSON.stringify(board)).toBe(JSON.stringify(other));
    const rows = board.components.map((r) => r.toJSON());
    expect(rows).toHaveLength(5);
    expect(rows.flatMap((r) => r.components)).toHaveLength(17);
    expect(
      rows
        .flatMap((r) => r.components)
        .every((b) => b.type === 2 && b.style === 2),
    ).toBe(true);
    expect(JSON.stringify(board)).not.toContain('💣');
    expect(board.embeds[0]!.toJSON().color).toBe(0xf5320c);
    const ended = minesView({
      ...game,
      status: 'LOST',
      revealed: [0],
      activeOwner: null,
    });
    expect(JSON.stringify(ended)).toContain('💣');
    expect(
      ended.components
        .flatMap((r) => r.toJSON().components)
        .every((b) => b.disabled),
    ).toBe(true);
  });
});
