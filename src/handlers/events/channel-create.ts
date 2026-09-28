import { Events } from 'discord.js';
import type { Event } from '../../core/types.js';
import { applyMuteOverwrite } from '../../modules/moderation/service.js';

export default {
  name: Events.ChannelCreate,
  async execute({ db }, channel) {
    const config = await db.moderationConfig.findUnique({
      where: { guildId: channel.guild.id },
    });
    if (config?.muteRoleId)
      await applyMuteOverwrite(channel, config.muteRoleId);
  },
} satisfies Event<typeof Events.ChannelCreate>;
