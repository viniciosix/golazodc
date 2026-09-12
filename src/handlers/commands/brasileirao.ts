import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/types.js';
import { UserError } from '../../core/errors.js';
import {
  getStandings,
  standingsUrl,
} from '../../modules/football/standings.js';
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
        'A fonte da tabela está indisponível ou mudou de formato. Tente novamente mais tarde.',
      );
    }
    const lines = table.rows.map(
      (r) =>
        `${r.position}. **${r.team}** — **${r.points} pts** | J ${r.played} | V ${r.wins} E ${r.draws} D ${r.losses} | SG ${r.difference}`,
    );
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x7c3aed)
          .setTitle('Brasileirão • Série A')
          .setURL(standingsUrl)
          .setDescription(lines.join('\n'))
          .setFooter({
            text: `ESPN • ${table.stale ? 'Fonte indisponível: última cópia válida' : 'Consulta com cache de até 60 segundos'}`,
          })
          .setTimestamp(table.fetchedAt),
      ],
      allowedMentions: { parse: [] },
    });
  },
} satisfies Command;
