import { describe, expect, it } from 'vitest';
import { normalisePhone, parseContactsCsv, parseCsvRecords, parseTags } from '@/lib/contacts/csv';

describe('normalisePhone', () => {
  it('turns South African local formats into E.164', () => {
    expect(normalisePhone('0821234567')).toBe('+27821234567');
    expect(normalisePhone('082 123 4567')).toBe('+27821234567');
    expect(normalisePhone('082-123-4567')).toBe('+27821234567');
    expect(normalisePhone('(082) 123 4567')).toBe('+27821234567');
    expect(normalisePhone('0027821234567')).toBe('+27821234567');
    expect(normalisePhone('27821234567')).toBe('+27821234567');
  });

  it('keeps a number that is already E.164', () => {
    expect(normalisePhone('+27821234567')).toBe('+27821234567');
    expect(normalisePhone('+27 82 123 4567')).toBe('+27821234567');
  });

  it('keeps another country code rather than rewriting it', () => {
    expect(normalisePhone('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('reads a blank value as absent, not as an error', () => {
    expect(normalisePhone('')).toBeNull();
    expect(normalisePhone('   ')).toBeNull();
    expect(normalisePhone(null)).toBeNull();
    expect(normalisePhone(undefined)).toBeNull();
  });

  it('refuses anything the database check constraint would reject', () => {
    expect(normalisePhone('not a phone')).toBeUndefined();
    expect(normalisePhone('12345')).toBeUndefined(); // no zero, no country code
    expect(normalisePhone('082123')).toBeUndefined(); // too short for a SA number
    expect(normalisePhone('08212345678')).toBeUndefined(); // one digit too many
    expect(normalisePhone('+0821234567')).toBeUndefined(); // country code cannot start at 0
  });
});

describe('parseTags', () => {
  it('splits on comma, semicolon and pipe, lowercases and de-duplicates', () => {
    expect(parseTags('Alumni, donor')).toEqual(['alumni', 'donor']);
    expect(parseTags('alumni;DONOR|alumni')).toEqual(['alumni', 'donor']);
    expect(parseTags('')).toEqual([]);
    expect(parseTags(null)).toEqual([]);
  });
});

describe('parseCsvRecords', () => {
  it('keeps commas inside quoted fields', () => {
    const records = parseCsvRecords('a,b\n1,"x,y"\n');
    expect(records).toHaveLength(2);
    expect(records[1]!.fields).toEqual(['1', 'x,y']);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsvRecords('a\n"he said ""hi"""\n')[1]!.fields).toEqual(['he said "hi"']);
  });

  it('handles CRLF and a missing final newline', () => {
    const records = parseCsvRecords('a,b\r\n1,2');
    expect(records.map((r) => r.fields)).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('counts the line a record starts on, even across a quoted newline', () => {
    const records = parseCsvRecords('a,b\n1,"two\nlines"\n3,4\n');
    expect(records[1]!.line).toBe(2);
    expect(records[2]!.line).toBe(4);
  });
});

const HEADER = 'first_name,last_name,email,phone,organisation,title,tags,alumni_year';

describe('parseContactsCsv', () => {
  it('parses a well-formed file', () => {
    const { rows, errors } = parseContactsCsv(
      `${HEADER}\n` +
        `Naledi,Mokoena,Naledi.Mokoena@example.com,0820000001,,,"alumni,donor",2009\n` +
        `Sipho,Ndlovu,,+27820000004,Bloem Engineering Works,Managing Director,partner,\n`,
    );

    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      line: 2,
      firstName: 'Naledi',
      lastName: 'Mokoena',
      email: 'naledi.mokoena@example.com',
      phoneE164: '+27820000001',
      tags: ['alumni', 'donor'],
      alumniYear: 2009,
    });
    expect(rows[1]).toMatchObject({
      firstName: 'Sipho',
      email: null,
      phoneE164: '+27820000004',
      organisation: 'Bloem Engineering Works',
      title: 'Managing Director',
      alumniYear: null,
    });
  });

  it('accepts the header spellings a spreadsheet actually produces', () => {
    const { rows, errors, ignoredColumns } = parseContactsCsv(
      'First Name,Surname,Email Address,Mobile,Company,Segments,Class Of,Donor Tier\n' +
        'Thabo,Mofokeng,thabo@example.com,0820000002,,alumni,2014,gold\n',
    );

    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      firstName: 'Thabo',
      email: 'thabo@example.com',
      phoneE164: '+27820000002',
      organisation: null,
      tags: ['alumni'],
      alumniYear: 2014,
    });
    expect(ignoredColumns).toEqual(['donor_tier']);
  });

  it('strips a BOM from the first header', () => {
    const { rows, errors } = parseContactsCsv(
      '﻿first_name,last_name,email\nAyanda,Khumalo,ayanda@example.com\n',
    );
    expect(errors).toEqual([]);
    expect(rows[0]!.firstName).toBe('Ayanda');
  });

  it('lists malformed rows with their line numbers and keeps the good ones', () => {
    const { rows, errors } = parseContactsCsv(
      `${HEADER}\n` +
        `Naledi,Mokoena,naledi@example.com,0820000001,,,,\n` + // line 2, fine
        `,Mofokeng,thabo@example.com,,,,,\n` + // line 3, no first name
        `Lerato,Dlamini,not-an-email,,,,,\n` + // line 4, bad email and nothing to match on
        `Sipho,Ndlovu,sipho@example.com,banana,,,,\n` + // line 5, bad phone
        `Palesa,Radebe,palesa@example.com,0820000005,,,,1066\n` + // line 6, impossible year
        `Karabo,Sithole,,,,,,\n`, // line 7, no email and no phone
    );

    expect(rows.map((r) => r.line)).toEqual([2]);
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5, 6, 7]);
    expect(errors[0]!.message).toContain('first_name is blank');
    expect(errors[1]!.message).toContain('not an email address');
    expect(errors[2]!.message).toContain('not a phone number');
    expect(errors[3]!.message).toContain('not a graduation year');
    expect(errors[4]!.message).toContain('needs an email address or a phone number');
  });

  it('reports a repeat inside the same file against the line it repeats', () => {
    const { rows, errors } = parseContactsCsv(
      `${HEADER}\n` +
        `Naledi,Mokoena,naledi@example.com,0820000001,,,,\n` +
        `Naledi,Mokoena,NALEDI@example.com,,,,,\n` +
        `Someone,Else,,0820000001,,,,\n`,
    );

    expect(rows).toHaveLength(1);
    expect(errors).toEqual([
      { line: 3, message: 'naledi@example.com already appears on line 2' },
      { line: 4, message: '+27820000001 already appears on line 2' },
    ]);
  });

  it('skips blank lines in the middle of a file', () => {
    const { rows, errors } = parseContactsCsv(
      `${HEADER}\n` +
        `Naledi,Mokoena,naledi@example.com,,,,,\n` +
        `,,,,,,,\n` +
        `\n` +
        `Thabo,Mofokeng,thabo@example.com,,,,,\n`,
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
  });

  it('refuses a file whose header has no name columns', () => {
    const { rows, errors } = parseContactsCsv('email,phone\nnaledi@example.com,0820000001\n');
    expect(rows).toEqual([]);
    expect(errors[0]!.line).toBe(1);
    expect(errors[0]!.message).toContain('first_name and last_name');
  });

  it('refuses an empty file', () => {
    expect(parseContactsCsv('').errors[0]!.message).toBe('The file is empty.');
    expect(parseContactsCsv('   \n').errors[0]!.message).toContain('first_name and last_name');
  });
});
