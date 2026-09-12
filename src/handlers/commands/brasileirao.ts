import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/types.js';
import { UserError } from '../../core/errors.js';
import {
  FOOTBALL_RESULT_EMOJIS,
  TRICORD_NAME,
  TRICORD_RED,
} from '../../core/brand.js';
import {
  getStandings,
  standingsUrl,
} from '../../modules/football/standings.js';

const normalizeTeam = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const isSaoPaulo = (name: string) => normalizeTeam(name).includes('sao paulo');

const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

const formatTableRow = (row: {
  position: number;
  team: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  difference: number;
}) => {
  const marker = isSaoPaulo(row.team) ? '▶' : ' ';
  const team = (isSaoPaulo(row.team) ? row.team.toUpperCase() : row.team)
    .slice(0, 18)
    .padEnd(18);

  return `${marker}${String(row.position).padStart(2)} ${team} ${String(row.points).padStart(3)} ${String(row.played).padStart(2)} ${String(row.wins).padStart(2)} ${String(row.draws).padStart(2)} ${String(row.losses).padStart(2)} ${signed(row.difference).padStart(4)}`;
};

export default {
  data: new SlashCommandBuilder()
    .setName('brasileirao')
    .setDescription('Tabela atual do Brasileirão Série A'),
  async execute(interaction) {
    await interaction.deferReply();
    let table;
    try {
      table = await getStandings();
    } catch {
      throw new UserError(
        'Não consegui consultar a tabela do Brasileirão agora. Tente novamente em instantes.',
      );
    }

    const saoPaulo = table.rows.find((row) => isSaoPaulo(row.team));
    const saoPauloSummary = saoPaulo
      ? `🔴⚪⚫ **SÃO PAULO**\n**${saoPaulo.position}º • ${saoPaulo.points} pontos**\n${saoPaulo.played} jogos • ${saoPaulo.wins}V • ${saoPaulo.draws}E • ${saoPaulo.losses}D • SG ${signed(saoPaulo.difference)}`
      : '';

    const legend = `${FOOTBALL_RESULT_EMOJIS.win} Vitória  •  ${FOOTBALL_RESULT_EMOJIS.draw} Empate  •  ${FOOTBALL_RESULT_EMOJIS.loss} Derrota`;
    const header = ' #  CLUBE              PTS  J  V  E  D   SG';
    const rows = table.rows.map(formatTableRow).join('\n');
    const description = [
      legend,
      saoPauloSummary,
      `\`\`\`text\n${header}\n${rows}\n\`\`\``,
    ]
      .filter(Boolean)
      .join('\n\n');

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(TRICORD_RED)
          .setTitle('BRASILEIRÃO • SÉRIE A')
          .setURL(standingsUrl)
          .setDescription(description)
          .setFooter({
            text: `${TRICORD_NAME} • Fonte: ${table.source} • ${table.stale ? 'Última cópia válida' : 'Atualizado agora'}`,
          })
          .setTimestamp(table.fetchedAt),
      ],
      allowedMentions: { parse: [] },
    });
  },
} satisfies Command;
