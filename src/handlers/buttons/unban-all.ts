import { EmbedBuilder, PermissionFlagsBits, type Guild } from 'discord.js';
import type { Button } from '../../core/types.js';
import { UserError } from '../../core/errors.js';
import { TRICORD_NAME, TRICORD_RED } from '../../core/brand.js';
import { removeAllGuildBans } from '../../modules/guild/stats.js';

const running = new Set<string>();

const panel = (guild: Guild, title: string, description: string) => {
  const icon = guild.iconURL({ size: 256 });
  const embed = new EmbedBuilder()
    .setColor(TRICORD_RED)
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: `${TRICORD_NAME} • ${guild.name}`,
      ...(icon ? { iconURL: icon } : {}),
    })
    .setTimestamp();
  if (icon) embed.setThumbnail(icon);
  return embed;
};

export default {
  id: 'unban-all',
  async execute(interaction) {
    const [, action, guildId, ownerId] = interaction.customId.split(':');
    const guild = interaction.guild;
    if (
      !guild ||
      !guildId ||
      !ownerId ||
      guild.id !== guildId ||
      interaction.user.id !== ownerId
    )
      throw new UserError('Esta confirmação não pertence a você.');
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
      throw new UserError('Apenas administradores podem confirmar esta ação.');

    if (action === 'cancel') {
      await interaction.update({
        embeds: [
          panel(
            guild,
            'DESBANIMENTO CANCELADO',
            'Nenhum banimento foi alterado.',
          ),
        ],
        components: [],
      });
      return;
    }
    if (action !== 'confirm') throw new UserError('Confirmação inválida.');
    if (!interaction.appPermissions?.has(PermissionFlagsBits.BanMembers))
      throw new UserError(
        'Preciso da permissão Banir membros para remover os banimentos.',
      );
    if (running.has(guild.id))
      throw new UserError(
        'Já existe um desbanimento em andamento neste servidor.',
      );

    running.add(guild.id);
    await interaction.update({
      embeds: [
        panel(
          guild,
          'DESBANIMENTO EM ANDAMENTO',
          'Estou removendo os banimentos. Esta mensagem será atualizada ao terminar.',
        ),
      ],
      components: [],
    });

    try {
      const result = await removeAllGuildBans(
        guild,
        `Desbanimento em massa solicitado por ${interaction.user.tag} (${interaction.user.id})`,
      );
      await interaction.editReply({
        embeds: [
          panel(
            guild,
            'DESBANIMENTO CONCLUÍDO',
            `**Removidos:** ${result.removed.toLocaleString('pt-BR')}\n` +
              `**Falhas:** ${result.failed.toLocaleString('pt-BR')}\n` +
              `**Total encontrado:** ${result.total.toLocaleString('pt-BR')}`,
          ),
        ],
        components: [],
      });
    } catch {
      await interaction.editReply({
        embeds: [
          panel(
            guild,
            'DESBANIMENTO INTERROMPIDO',
            'Não consegui concluir a consulta. Verifique as permissões do bot e tente novamente.',
          ),
        ],
        components: [],
      });
    } finally {
      running.delete(guild.id);
    }
  },
} satisfies Button;
