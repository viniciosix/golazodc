import { describe, it, expect } from 'vitest';
import { profileView } from '../src/modules/users/view.js';
const profile = {
  displayName: 'Vinício',
  bio: 'Meu clube',
  cards: 1234,
  coins: 161450000n,
};
const account = {
  displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png',
};
describe('Perfil com identidade do servidor', () => {
  it('usa o banner, o ícone e o nome sem campos fragmentados', () => {
    const data = profileView(profile, account, {
      name: 'Tricolor',
      iconURL: () => 'https://example.com/icon.png',
      bannerURL: () => 'https://example.com/banner.png',
    }).toJSON();
    expect(data.footer).toEqual({
      text: 'Tricolor',
      icon_url: 'https://example.com/icon.png',
    });
    expect(data.image?.url).toBe('https://example.com/banner.png');
    expect(data.fields).toBeUndefined();
    expect(data.color).toBe(0xf5320c);
    expect(data.description).toContain('161.450.000');
  });
  it('funciona sem banner, sem ícone e em mensagem direta', () => {
    const noAssets = profileView(profile, account, {
      name: 'Servidor',
      iconURL: () => null,
      bannerURL: () => null,
    }).toJSON();
    expect(noAssets.image).toBeUndefined();
    expect(noAssets.footer).toEqual({ text: 'Servidor' });
    expect(profileView(profile, account, null).toJSON().footer?.text).toBe(
      'TRICORD',
    );
  });
});
