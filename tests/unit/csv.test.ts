import { describe, expect, it } from 'vitest';
import { csvCell, csvFile, csvSlug } from '@/lib/csv';

describe('csvCell', () => {
  it('leaves ordinary values alone', () => {
    expect(csvCell('Naledi Mokoena')).toBe('Naledi Mokoena');
    expect(csvCell(42)).toBe('42');
    expect(csvCell('')).toBe('');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes a value containing a comma, a quote or a newline', () => {
    expect(csvCell('Ndlovu, Sipho')).toBe('"Ndlovu, Sipho"');
    expect(csvCell('He said "yes"')).toBe('"He said ""yes"""');
    expect(csvCell('Line one\nLine two')).toBe('"Line one\nLine two"');
  });

  it('neutralises a value Excel would run as a formula', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('=cmd|"/c calc"!A1')).toBe('"\'=cmd|""/c calc""!A1"');
    expect(csvCell('+cmd|calc')).toBe("'+cmd|calc");
    expect(csvCell('-2+3+cmd|calc')).toBe("'-2+3+cmd|calc");
  });

  it('leaves a phone number unprefixed, because that is not an attack', () => {
    expect(csvCell('+27820000001')).toBe('+27820000001');
    expect(csvCell('+27 82 000 0001')).toBe('+27 82 000 0001');
    expect(csvCell('+27 (82) 000-0001')).toBe('+27 (82) 000-0001');
    expect(csvCell('-15')).toBe('-15');
  });
});

describe('csvFile', () => {
  const file = csvFile(
    ['Name', 'Phone'],
    [
      ['Naledi Mokoena', '+27820000001'],
      ['Ndlovu, Sipho', null],
    ],
  );

  it('starts with the byte-order mark Excel needs to read UTF-8', () => {
    expect(file.charCodeAt(0)).toBe(0xfeff);
  });

  it('separates rows with CRLF and ends with one', () => {
    expect(file.endsWith('\r\n')).toBe(true);
    expect(file.replace(/^﻿/, '').split('\r\n')).toEqual([
      'Name,Phone',
      'Naledi Mokoena,+27820000001',
      '"Ndlovu, Sipho",',
      '',
    ]);
  });

  it('writes a header and nothing else for an empty export', () => {
    expect(csvFile(['Name'], [])).toBe('﻿Name\r\n');
  });
});

describe('csvSlug', () => {
  it('slugifies a title for a filename', () => {
    expect(csvSlug('CUT Fundraising Gala Dinner (Demo)')).toBe('cut-fundraising-gala-dinner-demo');
  });

  it('strips diacritics rather than dropping the letters', () => {
    expect(csvSlug('Sèance à Bloemfontein')).toBe('seance-a-bloemfontein');
  });

  it('falls back rather than producing a nameless file', () => {
    expect(csvSlug('— ·', 'event')).toBe('event');
  });
});
