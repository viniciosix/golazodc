import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../core/types.js';
import { RECYCLE } from '../../modules/economy/config.js';
import { UserError } from '../../core/errors.js';
export default {
  data: new SlashCommandBuilder()
    .setName('reciclar')
    .setDescription('Converta uma repetida em Tricoins')
    .addStringOption((o) =>
      o
        .setName('copia')
        .setDescription('ID da cópia mostrado em /colecao')
        .setRequired(true)
        .setMaxLength(30),
    ),
  async execute(interaction, { db }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const copy = await db.userCard.findFirst({
      where: {
        id: interaction.options.getString('copia', true),
        user: { discordId: interaction.user.id },
        destroyedAt: null,
        locked: false,
      },
      include: { card: { include: { player: true } } },
    });
    if (!copy) throw new UserError('Cópia indisponível. Veja /colecao.');
    await interaction.editReply({
      content: `Reciclar ${copy.card.player.name} por ${RECYCLE[copy.card.rarity]} Tricoins? Esta cópia será removida. Você precisa conservar pelo menos outra cópia dessa carta.`,
      allowedMentions: { parse: [] },
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`recycle:${interaction.user.id}:${copy.id}`)
            .setLabel('Confirmar reciclagem')
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
  },
} satisfies Command;
