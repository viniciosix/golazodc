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

interface GuildUnbanSource extends GuildStatsSource {
  bans: GuildStatsSource['bans'] & {
    remove(userId: string, reason?: string): Promise<unknown>;
  };
}

export interface GuildMemberStats {
  current: number;
  banned: number;
  potential: number;
}

export interface UnbanAllResult {
  total: number;
  removed: number;
  failed: number;
}

export async function fetchGuildBanIds(
  guild: GuildStatsSource,
): Promise<string[]> {
  const ids: string[] = [];
  let after: string | undefined;

  while (true) {
    const page = await guild.bans.fetch({
      limit: 1000,
      ...(after ? { after } : {}),
    });
    const last = page.last()?.user.id;

    if (page.size > 0 && !last)
      throw new Error('A consulta de banimentos retornou uma página inválida.');

    if (page.size === 1 && last) ids.push(last);
    else if (page.size > 1) {
      const iterable = page as BanPage &
        Iterable<[string, { user: { id: string } }]>;
      for (const [, ban] of iterable) ids.push(ban.user.id);
    }

    if (page.size < 1000) break;
    if (!last || last === after)
      throw new Error('A paginação de banimentos não avançou.');
    after = last;
  }

  return ids;
}

export async function getGuildMemberStats(
  guild: GuildStatsSource,
): Promise<GuildMemberStats> {
  const banned = (await fetchGuildBanIds(guild)).length;

  return {
    current: guild.memberCount,
    banned,
    potential: guild.memberCount + banned,
  };
}

export async function removeAllGuildBans(
  guild: GuildUnbanSource,
  reason: string,
): Promise<UnbanAllResult> {
  const ids = await fetchGuildBanIds(guild);
  let removed = 0;

  for (const id of ids) {
    try {
      await guild.bans.remove(id, reason);
      removed += 1;
    } catch (error) {
      void error;
    }
  }

  return { total: ids.length, removed, failed: ids.length - removed };
}
