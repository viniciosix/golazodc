interface BanPage {
  size: number;
  last(): { user: { id: string } } | undefined;
}

interface GuildStatsSource {
  memberCount: number;
  bans: {
    fetch(options: { limit: number; after?: string }): Promise<BanPage>;
  };
}

export interface GuildMemberStats {
  current: number;
  banned: number;
  potential: number;
}

export async function getGuildMemberStats(
  guild: GuildStatsSource,
): Promise<GuildMemberStats> {
  let banned = 0;
  let after: string | undefined;

  while (true) {
    const page = await guild.bans.fetch({
      limit: 1000,
      ...(after ? { after } : {}),
    });
    banned += page.size;

    if (page.size < 1000) break;
    const next = page.last()?.user.id;
    if (!next || next === after)
      throw new Error('A paginação de banimentos não avançou.');
    after = next;
  }

  return {
    current: guild.memberCount,
    banned,
    potential: guild.memberCount + banned,
  };
}
