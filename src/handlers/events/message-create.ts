import { Events } from 'discord.js';
import type { Event } from '../../core/types.js';
import { handleModerationMessage } from '../../modules/moderation/commands.js';

export default {
  name: Events.MessageCreate,
  async execute(context, message) {
    await handleModerationMessage(message, context);
  },
} satisfies Event<typeof Events.MessageCreate>;
