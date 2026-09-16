import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/types.js';
import { UserError } from '../../core/errors.js';
import { MINES } from '../../modules/mines/rules.js';
import { resumeMines, startMines } from '../../modules/mines/service.js';
import { minesView } from '../../modules/mines/view.js';
export default {
  data: new SlashCommandBuilder()
    .setName('mines')
    .setDescription('Encontre diamantes e retire Tricoins antes da bomba')
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName('jogar')
        .setDescription('Inicia uma aposta com Tricoins virtuais')
        .addIntegerOption((o) =>
          o
            .setName('aposta')
            .setDescription('Tricoins a apostar')
            .setRequired(true)
            .setMinValue(MINES.minBet)
            .setMaxValue(MINES.maxBet),
        )
        .addIntegerOption((o) =>
          o
            .setName('bombas')
            .setDescription('De 1 a 8; padrão 3')
            .setMinValue(1)
            .setMaxValue(MINES.maxBombs),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('continuar')
        .setDescription('Retoma sua partida ou mostra o último resultado'),
    ),
  async execute(interaction, { db }) {
    if (!interaction.guildId)
      throw new UserError('Jogue Mines em um servidor.');
    await interaction.deferReply();
    const game =
      interaction.options.getSubcommand() === 'continuar'
        ? await resumeMines(db, interaction.user.id, interaction.guildId)
        : await startMines(
            db,
            interaction.user,
            interaction.id,
            interaction.options.getInteger('aposta', true),
            interaction.options.getInteger('bombas') ?? 3,
            interaction.guildId,
          );
    await interaction.editReply(minesView(game));
  },
} satisfies Command;
