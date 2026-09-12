import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/types.js';
import {
  fetchMatches,
  leagues,
  leagueSchema,
} from '../../modules/football/provider.js';
export default {
  data: new SlashCommandBuilder()
    .setName('jogos')
    .setDescription('Lista partidas para acompanhar ou testar alertas')
    .addStringOption((o) =>
      o
        .setName('competicao')
        .setDescription('Competição')
        .addChoices(
          ...Object.entries(leagues).map(([value, name]) => ({ name, value })),
        ),
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const league = leagueSchema.parse(
      interaction.options.getString('competicao') || 'bra.1',
    );
    const matches = await fetchMatches(league);
    const live = matches.filter((m) => m.state === 'in');
    const selected = live.length ? live : matches;
    await interaction.editReply({
      content: `${leagues[league]} • ${live.length ? 'Em andamento' : 'Ontem, hoje e amanhã (UTC)'}\n${
        selected
          .slice(0, 12)
          .map(
            (m) =>
              `${m.home.name} ${m.home.score} × ${m.away.score} ${m.away.name} • ${m.clock} • <t:${Math.floor(Date.parse(m.date) / 1000)}:f>`,
          )
          .join('\n') || 'Nenhuma partida disponível.'
      }\nUse /gols ligar e escolha o time. Fonte: ESPN.`,
      allowedMentions: { parse: [] },
    });
  },
} satisfies Command;
