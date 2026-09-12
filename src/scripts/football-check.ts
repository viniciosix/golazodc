import { getStandings } from '../modules/football/standings.js';
import { fetchMatches, fetchTeams } from '../modules/football/provider.js';
const standings = await getStandings();
const teams = await fetchTeams('bra.1');
const matches = await fetchMatches('bra.1');
console.log({
  standings: standings.rows.length,
  teams: teams.length,
  saoPaulo: teams.find((t) => t.id === '2026')?.displayName,
  matches: matches.map(
    (m) =>
      `${m.home.name} ${m.home.score} x ${m.away.score} ${m.away.name} (${m.state})`,
  ),
  fetchedAt: new Date(standings.fetchedAt).toISOString(),
});
