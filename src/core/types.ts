import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  ClientEvents,
  ModalSubmitInteraction,
  AnySelectMenuInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import type { PrismaClient } from '@prisma/client';
import type { Cache } from '../infrastructure/cache.js';
export interface Context {
  db: PrismaClient;
  cache: Cache;
  client: Client;
}
export interface Command {
  data: { toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  execute(
    interaction: ChatInputCommandInteraction,
    context: Context,
  ): Promise<void>;
  autocomplete?(
    interaction: AutocompleteInteraction,
    context: Context,
  ): Promise<void>;
}
export interface Component<T> {
  id: string;
  execute(interaction: T, context: Context): Promise<void>;
}
export type Button = Component<ButtonInteraction>;
export type Select = Component<AnySelectMenuInteraction>;
export type Modal = Component<ModalSubmitInteraction>;
export interface Event<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute(context: Context, ...args: ClientEvents[K]): Promise<void>;
}
