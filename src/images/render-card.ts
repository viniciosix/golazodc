import sharp from 'sharp';
export interface CardImage {
  name: string;
  rating: number;
  position: string;
  rarity: string;
  portrait?: Buffer;
  overlay?: Buffer;
}
export const escapeXml = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (char) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[char]!,
  );
export async function renderCard(card: CardImage): Promise<Buffer> {
  const label = (value: string, max = 28) => escapeXml(value.slice(0, max));
  if (!Number.isInteger(card.rating) || card.rating < 0 || card.rating > 99)
    throw new Error('Rating inválido');
  const background = Buffer.from(
    `<svg width="600" height="840" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="840" rx="32" fill="#180c32"/><rect x="16" y="16" width="568" height="808" rx="24" fill="none" stroke="#8b5cf6" stroke-width="5"/><circle cx="500" cy="100" r="3" fill="white"/><circle cx="100" cy="240" r="2" fill="white"/></svg>`,
  );
  const layers: sharp.OverlayOptions[] = [];
  if (card.portrait)
    layers.push({
      input: await sharp(card.portrait, { limitInputPixels: 25000000 })
        .rotate()
        .resize(480, 520, { fit: 'contain', background: '#00000000' })
        .png()
        .toBuffer(),
      top: 120,
      left: 60,
    });
  if (card.overlay)
    layers.push({
      input: await sharp(card.overlay, { limitInputPixels: 25000000 })
        .resize(600, 840)
        .png()
        .toBuffer(),
      top: 0,
      left: 0,
    });
  layers.push({
    input: Buffer.from(
      `<svg width="600" height="840" xmlns="http://www.w3.org/2000/svg"><g fill="white" font-family="DejaVu Sans, sans-serif"><text x="45" y="85" font-size="42" font-weight="bold">${card.rating}</text><text x="45" y="120" font-size="22">${label(card.position, 8)}</text><text x="300" y="700" text-anchor="middle" font-size="30" font-weight="bold">${label(card.name)}</text><text x="300" y="750" text-anchor="middle" font-size="22" fill="#c4b5fd">${label(card.rarity)}</text><text x="300" y="797" text-anchor="middle" font-size="20">GOLAZO</text></g></svg>`,
    ),
    top: 0,
    left: 0,
  });
  return sharp(background).composite(layers).png().toBuffer();
}
