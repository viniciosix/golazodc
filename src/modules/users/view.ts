import { EmbedBuilder, type Guild, type User } from 'discord.js';
import { TRICORD_NAME, TRICORD_RED } from '../../core/brand.js';
import { number, label } from '../../core/presentation.js';
export function profileView(
  profile: { displayName: string; bio: string; cards: number; coins: bigint },
  account: Pick<User, 'displayAvatarURL'>,
  guild: Pick<Guild, 'name' | 'iconURL' | 'bannerURL'> | null,
) {
  const embed = new EmbedBuilder()
    .setColor(TRICORD_RED)
    .setTitle(profile.displayName.slice(0, 256))
    .setThumbnail(account.displayAvatarURL({ size: 256 }))
    .setDescription(
      [
        `**${label(profile.bio || 'Seu clube começa aqui!').slice(0, 1000)}**`,
        '',
        `**SALDO:** ${number(profile.coins)} TRICOINS`,
        `**CARTAS:** ${number(profile.cards)}`,
      ].join('\n'),
    );
  const iconURL = guild?.iconURL({ size: 128 }) || undefined;
  embed.setFooter({
    text: guild?.name || TRICORD_NAME,
    ...(iconURL ? { iconURL } : {}),
  });
  const banner = guild?.bannerURL({ size: 1024 });
  if (banner) embed.setImage(banner);
  return embed;
}
