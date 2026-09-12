import { readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import type { Button, Command, Event, Modal, Select } from './types.js';
export async function loadFolder<T>(directory: string): Promise<T[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const modules: T[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) modules.push(...(await loadFolder<T>(path)));
    else if (/\.(ts|js)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      const loaded = (await import(pathToFileURL(path).href)) as {
        default?: T;
      };
      if (!loaded.default)
        throw new Error(`Módulo sem export default: ${entry.name}`);
      modules.push(loaded.default);
    }
  }
  return modules;
}
export function uniqueMap<T>(
  items: T[],
  key: (item: T) => string,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const id = key(item);
    if (map.has(id)) throw new Error(`Handler duplicado: ${id}`);
    map.set(id, item);
  }
  return map;
}
const folder = (name: string) =>
  fileURLToPath(new URL(`../handlers/${name}/`, import.meta.url));
export const loadCommands = async () =>
  uniqueMap(
    await loadFolder<Command>(folder('commands')),
    (c) => c.data.toJSON().name,
  );
export async function loadHandlers() {
  return {
    commands: await loadCommands(),
    buttons: uniqueMap(
      await loadFolder<Button>(folder('buttons')),
      (c) => c.id,
    ),
    selects: uniqueMap(
      await loadFolder<Select>(folder('selects')),
      (c) => c.id,
    ),
    modals: uniqueMap(await loadFolder<Modal>(folder('modals')), (c) => c.id),
    events: await loadFolder<Event>(folder('events')),
  };
}
export type Handlers = Awaited<ReturnType<typeof loadHandlers>>;
