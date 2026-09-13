import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Rarity } from '@prisma/client';
import type { Command } from '../../core/types.js';
import { UserError } from '../../core/errors.js';
import {
  addCard,
  downloadArtwork,
  requireCardAdmin,
} from '../../modules/cards/catalog.js';
import { cardView } from '../../modules/cards/view.js';
export default {
  data: new SlashCommandBuilder()
    .setName('cartas-admin')
    .setDescription('Gerencie o catálogo do TRICORD')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s
        .setName('adicionar')
        .setDescription('Cadastre uma carta PNG')
        .addAttachmentOption((o) =>
          o
            .setName('imagem')
            .setDescription('Arte em PNG, até 10 MB')
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('codigo')
            .setDescription('Código único: letras minúsculas, números e hífen')
            .setRequired(true)
            .setMaxLength(60),
        )
        .addStringOption((o) =>
          o
            .setName('nome')
            .setDescription('Nome do jogador; padrão: nome do arquivo')
            .setMaxLength(80),
        )
        .addStringOption((o) =>
          o
            .setName('posicao')
            .setDescription('Posição do jogador')
            .setMaxLength(20),
        )
        .addStringOption((o) =>
          o.setName('edicao').setDescription('Nome da edição').setMaxLength(60),
        )
        .addStringOption((o) =>
          o
            .setName('raridade')
            .setDescription('Raridade')
            .addChoices(
              ...['COMMON', 'RARE', 'EPIC', 'LEGENDARY'].map((value) => ({
                name: value,
                value,
              })),
            ),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('disponibilidade')
        .setDescription('Ative ou retire uma carta dos packs')
        .addStringOption((o) =>
          o
            .setName('codigo')
            .setDescription('Código do catálogo')
            .setRequired(true),
        )
        .addBooleanOption((o) =>
          o
            .setName('ativa')
            .setDescription('Disponível nos packs?')
            .setRequired(true),
        ),
    ),
  async execute(interaction, { db }) {
    requireCardAdmin(interaction.guildId, interaction.memberPermissions);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const slug = interaction.options.getString('codigo', true);
    if (interaction.options.getSubcommand() === 'disponibilidade') {
      const result = await db.card.updateMany({
        where: { slug },
        data: { active: interaction.options.getBoolean('ativa', true) },
      });
      if (!result.count) throw new UserError('Código de carta não encontrado.');
    } else {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
        throw new UserError(
          'Use letras minúsculas, números e hífens no código.',
        );
      if (await db.card.findUnique({ where: { slug } }))
        throw new UserError(
          'Esse código já existe. Escolha outro para a nova edição.',
        );
      const file = interaction.options.getAttachment('imagem', true);
      if (file.size > 10 * 1024 * 1024)
        throw new UserError('Limite de 10 MB por carta.');
      const name = (
        interaction.options.getString('nome') ||
        file.name.replace(/\.png$/i, '').replace(/[_-]+/g, ' ')
      )
        .trim()
        .slice(0, 80);
      if (!name) throw new UserError('Informe o nome do jogador.');
      await addCard(
        db,
        {
          slug,
          name,
          position: interaction.options.getString('posicao') || 'Não informada',
          edition: interaction.options.getString('edicao') || 'Especial',
          rarity: (interaction.options.getString('raridade') ||
            'COMMON') as Rarity,
        },
        await downloadArtwork(file.url),
      );
    }
    await interaction.editReply(await cardView(db, slug));
  },
} satisfies Command;
