import { Events } from 'discord.js';
import type { Event } from '../../core/types.js';
import { logger } from '../../core/logger.js';
export default {
  name: Events.ClientReady,
  once: true,
  async execute({ client }) {
    logger.info({ botId: client.user?.id }, 'TRICORD online');
  },
} satisfies Event<typeof Events.ClientReady>;
