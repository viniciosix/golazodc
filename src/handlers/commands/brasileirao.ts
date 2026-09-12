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

    const lines = table.rows.map((r) => {
      const saoPaulo = normalizeTeam(r.team) === 'sao paulo';
      const teamName = saoPaulo
        ? `🔴 __**${r.team.toUpperCase()}**__`
        : `**${r.team}**`;
      const goalDifference = r.difference > 0 ? `+${r.difference}` : r.difference;

      return `${r.position}. ${teamName} — **${r.points} pts** | J ${r.played} | ${FOOTBALL_RESULT_EMOJIS.win} ${r.wins} ${FOOTBALL_RESULT_EMOJIS.draw} ${r.draws} ${FOOTBALL_RESULT_EMOJIS.loss} ${r.losses} | SG ${goalDifference}`;
    });

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(TRICORD_RED)
          .setTitle('🏆 Brasileirão • Série A')
          .setURL(standingsUrl)
          .setDescription(lines.join('\n'))
          .setFooter({
            text: `${TRICORD_NAME} • ${table.source} • ${table.stale ? 'Última cópia válida' : 'Atualização com cache de até 60 segundos'}`,
          })
          .setTimestamp(table.fetchedAt),
      ],
      allowedMentions: { parse: [] },
    });
  },
} satisfies Command;
