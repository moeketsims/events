/**
 * CSV parsing and phone normalisation for the contacts importer (TASKS T2.1).
 *
 * Pure functions, no database and no Next.js: the Server Action in
 * `app/(staff)/contacts/actions.ts` calls these, and `tests/unit/contacts-csv.test.ts`
 * pins the behaviour. Everything an organiser can get wrong in a spreadsheet —
 * a missing surname, a phone in five different formats, a stray blank line, the
 * same person twice — has to come back as a message naming the line, because
 * the alternative is a silent half-import of a donor list.
 */

export type ParsedContact = {
  /** 1-based line in the original file, header included, for error messages. */
  line: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneE164: string | null;
  organisation: string | null;
  title: string | null;
  tags: string[];
  alumniYear: number | null;
};

export type CsvRowError = { line: number; message: string };

export type ParseResult = {
  rows: ParsedContact[];
  errors: CsvRowError[];
  /** Header names that were present but are not columns we import. */
  ignoredColumns: string[];
};

/** The columns the importer reads, in the order the dialog documents them. */
export const CSV_COLUMNS = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'organisation',
  'title',
  'tags',
  'alumni_year',
] as const;

export const CSV_TEMPLATE =
  'first_name,last_name,email,phone,organisation,title,tags,alumni_year\n' +
  'Naledi,Mokoena,naledi.mokoena@example.com,0820000001,,,"alumni,donor",2009\n';

/** Header spellings we accept for each canonical column. */
const HEADER_ALIASES: Record<(typeof CSV_COLUMNS)[number], string[]> = {
  first_name: ['first_name', 'firstname', 'first', 'given_name', 'name'],
  last_name: ['last_name', 'lastname', 'last', 'surname', 'family_name'],
  email: ['email', 'email_address', 'e_mail'],
  phone: ['phone', 'phone_e164', 'mobile', 'cell', 'cellphone', 'phone_number', 'telephone'],
  organisation: ['organisation', 'organization', 'company', 'employer'],
  title: ['title', 'job_title', 'position'],
  tags: ['tags', 'tag', 'segments', 'segment'],
  alumni_year: ['alumni_year', 'alumniyear', 'year', 'graduation_year', 'class_of'],
};

/** `Alumni Year` and `alumni-year` both become `alumni_year`. */
function normaliseHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^﻿/, '') // a BOM on the first header of an Excel export
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * RFC 4180 enough for a spreadsheet export: quoted fields may hold commas,
 * newlines and doubled quotes. Returns one array of fields per record, with the
 * 1-based line number the record started on, so `"alumni,donor"` survives and a
 * multi-line quoted note does not shift every error message after it.
 */
export function parseCsvRecords(text: string): { line: number; fields: string[] }[] {
  const records: { line: number; fields: string[] }[] = [];
  let fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let started = false;

  const pushField = () => {
    fields.push(field);
    field = '';
  };
  const pushRecord = () => {
    pushField();
    // A trailing newline should not produce a final empty record.
    if (!(fields.length === 1 && fields[0] === '')) {
      records.push({ line: recordLine, fields });
    }
    fields = [];
    started = false;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (!started && char !== '\n' && char !== '\r') {
      recordLine = line;
      started = true;
    }

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === '\n') line++;
        field += char;
      }
      continue;
    }

    if (char === '"' && field.trim() === '') {
      field = '';
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\n') {
      pushRecord();
      line++;
    } else if (char === '\r') {
      // Swallow CR; the LF that follows ends the record.
    } else {
      field += char;
    }
  }

  if (started || fields.length > 0 || field !== '') pushRecord();

  return records;
}

/**
 * South African mobile numbers as people actually type them, to E.164.
 *
 *   0821234567        -> +27821234567
 *   082 123 4567      -> +27821234567
 *   +27 82 123 4567   -> +27821234567
 *   0027821234567     -> +27821234567
 *   27821234567       -> +27821234567
 *
 * Returns null for an empty value and `undefined` for something that is not a
 * phone number at all, which the caller reports as a row error. A number that
 * already carries another country code is kept as given, because CUT has
 * international alumni and rewriting their number would be worse than
 * accepting it.
 */
export function normalisePhone(raw: string | null | undefined): string | null | undefined {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '') return null;

  // Keep a leading +, drop spaces, dashes, brackets and dots.
  const plus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (digits === '') return undefined;

  let e164: string;
  if (plus) {
    e164 = `+${digits}`;
  } else if (digits.startsWith('0027')) {
    e164 = `+27${digits.slice(4)}`;
  } else if (digits.startsWith('27') && digits.length >= 11) {
    e164 = `+${digits}`;
  } else if (digits.startsWith('0')) {
    e164 = `+27${digits.slice(1)}`;
  } else {
    // No country code and no leading zero: cannot be guessed safely.
    return undefined;
  }

  // The same rule as the contacts_phone_e164_format check in migration 0003,
  // so a row that would be rejected by the database is reported here instead.
  if (!/^\+[1-9][0-9]{6,14}$/.test(e164)) return undefined;

  // A South African number is +27 and nine more digits. The constraint above
  // accepts seven, so `082123` would pass it as `+2782123` and be stored as a
  // number nobody can dial. Anything shorter or longer is a typo.
  if (e164.startsWith('+27') && e164.length !== 12) return undefined;

  return e164;
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

/** Tags arrive comma-, semicolon- or pipe-separated; stored lowercase. */
export function parseTags(raw: string | null | undefined): string[] {
  return Array.from(
    new Set(
      (raw ?? '')
        .split(/[,;|]/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

const THIS_YEAR = new Date().getFullYear();

/**
 * Parse a pasted or uploaded CSV. Rows that cannot be imported are returned as
 * errors with their line number rather than dropped, and a duplicate inside the
 * file is reported against the line that repeats, naming the line it repeats.
 */
export function parseContactsCsv(text: string): ParseResult {
  const errors: CsvRowError[] = [];
  const rows: ParsedContact[] = [];

  const [header, ...body] = parseCsvRecords(text);
  if (!header) {
    return { rows, errors: [{ line: 1, message: 'The file is empty.' }], ignoredColumns: [] };
  }

  // ---- header ----
  const normalised = header.fields.map(normaliseHeader);
  const index = {} as Record<(typeof CSV_COLUMNS)[number], number>;
  const matched = new Set<number>();

  for (const column of CSV_COLUMNS) {
    const position = normalised.findIndex(
      (h, i) => !matched.has(i) && HEADER_ALIASES[column].includes(h),
    );
    index[column] = position;
    if (position >= 0) matched.add(position);
  }

  const ignoredColumns = normalised.filter((h, i) => h !== '' && !matched.has(i));

  if (index.first_name < 0 || index.last_name < 0) {
    return {
      rows,
      errors: [
        {
          line: header.line,
          message:
            'The header row needs at least first_name and last_name. ' +
            `Found: ${normalised.filter(Boolean).join(', ') || '(nothing)'}.`,
        },
      ],
      ignoredColumns,
    };
  }

  const at = (fields: string[], column: (typeof CSV_COLUMNS)[number]): string => {
    const position = index[column];
    return position < 0 ? '' : (fields[position] ?? '').trim();
  };

  // ---- rows ----
  const seenEmail = new Map<string, number>();
  const seenPhone = new Map<string, number>();

  for (const record of body) {
    const { line, fields } = record;

    // A blank line in the middle of a spreadsheet export is not an error.
    if (fields.every((f) => f.trim() === '')) continue;

    const firstName = at(fields, 'first_name');
    const lastName = at(fields, 'last_name');
    const emailRaw = at(fields, 'email');
    const phoneRaw = at(fields, 'phone');
    const alumniRaw = at(fields, 'alumni_year');

    const problems: string[] = [];

    if (!firstName) problems.push('first_name is blank');
    if (!lastName) problems.push('last_name is blank');

    let email: string | null = null;
    if (emailRaw) {
      if (EMAIL_RE.test(emailRaw)) {
        email = emailRaw.toLowerCase();
      } else {
        problems.push(`"${emailRaw}" is not an email address`);
      }
    }

    const phone = normalisePhone(phoneRaw);
    if (phone === undefined) problems.push(`"${phoneRaw}" is not a phone number we can read`);

    let alumniYear: number | null = null;
    if (alumniRaw) {
      const year = Number(alumniRaw);
      if (!Number.isInteger(year) || year < 1900 || year > THIS_YEAR + 10) {
        problems.push(`"${alumniRaw}" is not a graduation year`);
      } else {
        alumniYear = year;
      }
    }

    // Without an email or a phone there is nothing to de-duplicate on, so the
    // same file imported twice would create the person twice. Refuse the row.
    if (problems.length === 0 && !email && !phone) {
      problems.push('needs an email address or a phone number');
    }

    if (problems.length > 0) {
      errors.push({ line, message: problems.join('; ') });
      continue;
    }

    if (email && seenEmail.has(email)) {
      errors.push({ line, message: `${email} already appears on line ${seenEmail.get(email)}` });
      continue;
    }
    if (phone && seenPhone.has(phone)) {
      errors.push({ line, message: `${phone} already appears on line ${seenPhone.get(phone)}` });
      continue;
    }
    if (email) seenEmail.set(email, line);
    if (phone) seenPhone.set(phone, line);

    rows.push({
      line,
      firstName,
      lastName,
      email,
      phoneE164: phone ?? null,
      organisation: at(fields, 'organisation') || null,
      title: at(fields, 'title') || null,
      tags: parseTags(at(fields, 'tags')),
      alumniYear,
    });
  }

  return { rows, errors, ignoredColumns };
}
