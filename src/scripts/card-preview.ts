import { mkdir, writeFile } from 'node:fs/promises';
import { renderCard } from '../images/render-card.js';
await mkdir('output', { recursive: true });
await writeFile(
  'output/card-preview.png',
  await renderCard({
    name: 'Jogador Exemplo',
    rating: 85,
    position: 'ATA',
    rarity: 'ÉPICA',
  }),
);
console.log('Imagem criada em output/card-preview.png');
