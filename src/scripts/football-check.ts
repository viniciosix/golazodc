import { getStandings } from '../modules/football/standings.js';
import { fetchMatches, fetchTeams } from '../modules/football/provider.js';

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const result: Record<string, unknown> = {};

try {
  const standings = await getStandings();
  result.standings = {
    rows: standings.rows.length,
    source: standings.source,
    stale: standings.stale,
    leader: standings.rows[0]?.team,
    fetchedAt: new Date(standings.fetchedAt).toISOString(),
  };
} catch (error) {
  result.standingsError = errorMessage(error);
}

try {
  const teams = await fetchTeams('bra.1');
  result.teams = {
    count: teams.length,
    saoPaulo: teams.find((team) => team.id === '2026')?.displayName,
  };
} catch (error) {
  result.teamsError = errorMessage(error);
}

try {
  const matches = await fetchMatches('bra.1');
  result.matches = matches.map(
    (match) =>
      `${match.home.name} ${match.home.score} x ${match.away.score} ${match.away.name} (${match.state})`,
  );
} catch (error) {
  result.matchesError = errorMessage(error);
}

console.log(JSON.stringify(result, null, 2));

if (result.standingsError) process.exitCode = 1;
