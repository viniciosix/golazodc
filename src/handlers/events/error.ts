import { Events } from 'discord.js';
import type { Event } from '../../core/types.js';
import { logger } from '../../core/logger.js';
export default {
  name: Events.Error,
  async execute(_context, error) {
    logger.error({ err: error }, 'Erro de conexão Discord');
  },
} satisfies Event<typeof Events.Error>;
