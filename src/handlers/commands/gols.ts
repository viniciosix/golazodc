import { TRICORD_NAME, TRICORD_RED } from '../../core/brand.js';
import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../core/types.js';
import { UserError } from '../../core/errors.js';
import {
  fetchMatches,
  fetchTeams,
  leagues,
  leagueSchema,
} from '../../modules/football/provider.js';
import { enableGoals } from '../../modules/football/goals.js';
export default {
  data: new SlashCommandBuilder()
    .setName('gols')
    .setDescription('Configura alertas de gol neste canal')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('ligar')
        .setDescription('Ativa os alertas; São Paulo é o time padrão')
        .addStringOption((o) =>
          o
            .setName('competicao')
            .setDescription('Padrão: Brasileirão')
            .addChoices(
              ...Object.entries(leagues).map(([value, name]) => ({
                name,
                value,
              })),
            ),
        )
        .addStringOption((o) =>
          o
            .setName('time')
            .setDescription('Escolha outro time para testar')
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s.setName('desligar').setDescription('Desativa os alertas deste canal'),
    )
    .addSubcommand((s) =>
      s
        .setName('status')
        .setDescription('Mostra o time monitorado e o estado dos alertas'),
    )
    .addSubcommand((s) =>
      s
        .setName('teste')
        .setDescription('Envia uma mensagem claramente simulada neste canal'),
    ),
  async autocomplete(interaction) {
    try {
      const league = leagueSchema.parse(
        interaction.options.getString('competicao') || 'bra.1',
      );
      const q = interaction.options
        .getFocused()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
      const teams = await fetchTeams(league);
      await interaction.respond(
        teams
          .filter((t) =>
            t.displayName
              .normalize('NFD')
              .replace(/\p{Diacritic}/gu, '')
              .toLowerCase()
              .includes(q),
          )
          .slice(0, 25)
          .map((t) => ({ name: t.displayName, value: t.id })),
      );
    } catch {
      await interaction.respond([]);
    }
  },
  async execute(interaction, { db }) {
    if (
      !interaction.guildId ||
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    )
      throw new UserError(
        'Você precisa de Gerenciar servidor para configurar alertas.',
      );
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const action = interaction.options.getSubcommand();
    if (action === 'desligar') {
      await db.goalSubscription.updateMany({
        where: { channelId: interaction.channelId },
        data: { enabled: false },
      });
      await interaction.editReply('Alertas desligados neste canal.');
      return;
    }
    if (action === 'status') {
      const sub = await db.goalSubscription.findUnique({
        where: { channelId: interaction.channelId },
      });
      await interaction.editReply(
        sub
          ? `Alertas ${sub.enabled ? 'ligados' : 'desligados'} • ${sub.teamName} • ${sub.league}\nConsulta periódica; pode haver atraso da fonte.`
          : 'Nenhum alerta configurado. Use /gols ligar.',
      );
      return;
    }
    const channel = interaction.channel;
    if (
      !channel?.isTextBased() ||
      !('send' in channel) ||
      !interaction.appPermissions?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ReadMessageHistory,
        channel.isThread()
          ? PermissionFlagsBits.SendMessagesInThreads
          : PermissionFlagsBits.SendMessages,
      ])
    )
      throw new UserError(
        'Preciso de Ver canal, Enviar mensagens, Inserir links e Ler histórico neste canal.',
      );
    if (action === 'teste') {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(TRICORD_RED)
            .setTitle('🧪 TESTE SIMULADO')
            .setDescription(
              '⚽ Exemplo de alerta: São Paulo 1 × 0 Adversário.\nEste placar é fictício. Nenhum gol real foi detectado.',
            )
            .setFooter({ text: TRICORD_NAME }),
        ],
        allowedMentions: { parse: [] },
      });
      await interaction.editReply(
        'Mensagem de teste enviada. Para testar gols reais de outro time, use /jogos e /gols ligar.',
      );
      return;
    }
    const league = leagueSchema.parse(
      interaction.options.getString('competicao') || 'bra.1',
    );
    const teamId = interaction.options.getString('time') || '2026';
    const matches = await fetchMatches(league);
    const side = matches
      .flatMap((match) => [match.home, match.away])
      .find((team) => team.id === teamId);
    const team =
      teamId === '2026'
        ? { id: '2026', displayName: 'São Paulo' }
        : side
          ? { id: side.id, displayName: side.name }
          : (await fetchTeams(league)).find((t) => t.id === teamId);
    if (!team)
      throw new UserError(
        'Escolha um time válido pelo autocomplete desta competição.',
      );
    await enableGoals(
      db,
      {
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        league,
        teamId,
        teamName: team.displayName,
      },
      matches,
    );
    await interaction.editReply(
      `Alertas ligados para ${team.displayName} em ${leagues[league]}, neste canal. A narração será atualizada em uma única mensagem. Só novos gols do time serão anunciados separadamente; correções de placar também serão informadas. Use /gols desligar para parar.`,
    );
  },
} satisfies Command;
