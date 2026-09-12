import { REST, Routes } from 'discord.js';
import { discordSchema, parseConfig } from '../config/env.js';
import { loadCommands } from '../core/loader.js';
const commands = [...(await loadCommands()).values()].map((command) =>
  command.data.toJSON(),
);
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify(commands, null, 2));
} else {
  const config = parseConfig(discordSchema);
  const global = process.argv.includes('--global');
  if (!global && !config.DISCORD_GUILD_ID)
    throw new Error('Defina DISCORD_GUILD_ID ou use --global explicitamente.');
  const route = global
    ? Routes.applicationCommands(config.DISCORD_CLIENT_ID)
    : Routes.applicationGuildCommands(
        config.DISCORD_CLIENT_ID,
        config.DISCORD_GUILD_ID as string,
      );
  await new REST({ version: '10' })
    .setToken(config.DISCORD_TOKEN)
    .put(route, { body: commands });
  console.log(
    `${commands.length} comandos registrados no escopo ${global ? 'global' : 'servidor de teste'}.`,
  );
}
