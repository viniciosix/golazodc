import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { MessageFlags } from 'discord.js';
import fixture from './fixtures/sudamericana-sao-paulo.json' with { type: 'json' };
import type { Context } from '../src/core/types.js';
import { parseMatches } from '../src/modules/football/provider.js';
import { parseCommentary } from '../src/modules/football/commentary.js';
import { enableGoals } from '../src/modules/football/goals.js';
import { pollGoals } from '../src/modules/football/worker.js';
const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
const channelId = `sula-${randomUUID()}`;
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'São Paulo na Sul-Americana com banco real',
  () => {
    afterAll(async () => {
      await db.goalSubscription.deleteMany({ where: { channelId } });
      await db.$disconnect();
    });
    it('consulta a competição correta e edita o painel com logo e lances', async () => {
      const match = {
        ...parseMatches(fixture, 'conmebol.sudamericana')[0]!,
        state: 'in' as const,
      };
      await enableGoals(
        db,
        {
          guildId: 'test',
          channelId,
          league: 'conmebol.sudamericana',
          teamId: '2026',
          teamName: 'São Paulo',
        },
        [match],
      );
      const send = vi.fn().mockResolvedValue({ id: 'sula-panel' });
      const edit = vi.fn().mockResolvedValue({});
      const context = {
        db,
        client: {
          channels: {
            fetch: vi.fn().mockResolvedValue({
              isTextBased: () => true,
              send,
              messages: { edit },
            }),
          },
        },
      } as unknown as Context;
      const getMatches = vi.fn().mockResolvedValue([match]);
      const getCommentary = vi
        .fn()
        .mockResolvedValue(
          parseCommentary(fixture).filter((line) => line.sequence <= 11),
        );
      await pollGoals(context, getMatches, getCommentary);
      expect(getMatches).toHaveBeenCalledWith('conmebol.sudamericana');
      expect(getCommentary).toHaveBeenCalledWith(
        'conmebol.sudamericana',
        match.id,
      );
      const payload = send.mock.calls[0]![0];
      expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
      expect(JSON.stringify(payload.components[0].toJSON())).toContain(
        '1208.png',
      );
      expect(JSON.stringify(payload.components[0].toJSON())).toContain(
        'Cartão amarelo',
      );
      getCommentary.mockResolvedValue(parseCommentary(fixture));
      await pollGoals(context, getMatches, getCommentary);
      expect(send).toHaveBeenCalledTimes(1);
      expect(edit).toHaveBeenCalledWith(
        'sula-panel',
        expect.objectContaining({ flags: MessageFlags.IsComponentsV2 }),
      );
      expect(
        JSON.stringify(edit.mock.calls[0]![1].components[0].toJSON()),
      ).toContain('Substituição');
    });
  },
);
