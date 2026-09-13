import { escapeMarkdown } from 'discord.js';
export const number = (value: number | bigint) => value.toLocaleString('pt-BR');
export const label = (value: string) =>
  escapeMarkdown(value.replace(/[\r\n]+/g, ' '));
