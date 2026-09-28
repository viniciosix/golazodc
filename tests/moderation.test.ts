import { describe, expect, it } from 'vitest';
import {
  censorFilteredWords,
  containsFilteredWord,
  normalizeModerationText,
  parseDuration,
  parsePrefixCommand,
} from '../src/modules/moderation/parser.js';

describe('moderação por prefixo', () => {
  it('normaliza acentos, caixa e pontuação', () => {
    expect(normalizeModerationText('  SÃO---Paulo!!! ')).toBe('sao paulo');
  });

  it('encontra palavras e frases completas sem bloquear substrings', () => {
    expect(containsFilteredWord('Isso é uma MERDA!', 'merda')).toBe(true);
    expect(containsFilteredWord('vai tomar-no-cu agora', 'tomar no cu')).toBe(
      true,
    );
    expect(containsFilteredWord('palavra merdamente escrita', 'merda')).toBe(
      false,
    );
  });

  it('censura todas as regras preservando espaços e pontuação', () => {
    expect(
      censorFilteredWords('MERDA! Vai tomar-no-cu, mas não merdamente.', [
        'merda',
        'tomar no cu',
      ]),
    ).toEqual({
      content: '*****! Vai *****-**-**, mas não merdamente.',
      matches: ['merda', 'tomar no cu'],
    });
  });

  it('converte durações válidas e rejeita valores inválidos', () => {
    expect(parseDuration('10m')).toBe(600_000);
    expect(parseDuration('2H')).toBe(7_200_000);
    expect(parseDuration('7d')).toBe(604_800_000);
    expect(parseDuration('0m')).toBeUndefined();
    expect(parseDuration('366d')).toBeUndefined();
    expect(parseDuration('amanhã')).toBeUndefined();
  });

  it('interpreta comandos com ponto e ignora mensagens comuns', () => {
    expect(parsePrefixCommand('.MuTe   123  10m teste')).toEqual({
      name: 'mute',
      args: ['123', '10m', 'teste'],
    });
    expect(parsePrefixCommand('texto normal')).toBeUndefined();
    expect(parsePrefixCommand('.   ')).toBeUndefined();
  });
});
