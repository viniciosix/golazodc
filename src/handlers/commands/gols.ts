import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../core/types.js';
import { logger } from '../../core/logger.js';
import { UserError } from '../../core/errors.js';
import {
  fetchMatches,
  fetchTeams,
  leagues,
  leagueSchema,
} from '../../modules/football/provider.js';
import {
  newSimulation,
  simulationView,
  registerSimulation,
} from '../../modules/football/simulator.js';
import { resolveEventEmojis } from '../../modules/football/event-format.js';
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
        .setDescription('Abre um painel com botões para simular os lances'),
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
  async execute(interaction, { db, client }) {
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
      const state = newSimulation(interaction.user.id, interaction.guildId);
      const message = await channel.send(
        simulationView(state, resolveEventEmojis(client, interaction.guild)),
      );
      registerSimulation(message.id, state);
      await interaction.editReply(
        'Painel de teste criado! Use os botões para simular lances. Os dados são fictícios e os alertas reais continuam independentes.',
      );
      return;
    }
    const league = leagueSchema.parse(
      interaction.options.getString('competicao') || 'bra.1',
    );
    const teamId = interaction.options.getString('time') || '2026';
    let sourceUnavailable = false;
    const matches = await fetchMatches(league).catch((err: unknown) => {
      if (teamId !== '2026')
        throw new UserError(
          'A fonte dos jogos não respondeu. Tente novamente em instantes. Para acompanhar o São Paulo, deixe o campo time vazio.',
        );
      sourceUnavailable = true;
      logger.warn(
        { err, league },
        'Ativando São Paulo sem consulta inicial; monitor tentará novamente',
      );
      return [];
    });
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
      `Alertas ligados para ${team.displayName} em ${leagues[league]}, neste canal. A narração será atualizada em uma única mensagem. Novos gols dos dois times serão anunciados separadamente; correções de placar também serão informadas. Use /gols desligar para parar.${sourceUnavailable ? ' A ESPN não respondeu agora. O acompanhamento foi salvo e o monitor tentará novamente automaticamente; a narração aparecerá quando a fonte voltar. O primeiro placar recebido será a referência, sem anunciar gols antigos.' : ''}`,
    );
  },
} satisfies Command;
