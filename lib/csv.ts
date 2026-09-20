/**
 * CSV writing for the exports an organiser opens in Excel.
 *
 * Three things make a CSV that Excel reads correctly and safely, and all three
 * are easy to get wrong:
 *
 *  - **the byte-order mark.** Without it Excel on Windows reads a UTF-8 file as
 *    the system codepage and mangles every surname with a diacritic.
 *  - **CRLF.** Excel accepts LF, older versions do not.
 *  - **formula neutralisation.** A cell beginning `=`, `@`, `+` or `-` can be
 *    executed by Excel when the file is opened.
 *
 * Pure, so `tests/unit/csv.test.ts` can hold it to all three.
 */

/**
 * Quote and escape one cell, RFC 4180, with the formula guard.
 *
 * `+` and `-` are excepted when what follows is only digits, spaces, brackets
 * and dashes — which is to say, a phone number. Every South African mobile in
 * an export starts with `+27`, and prefixing all of them would put a stray
 * apostrophe in front of the most common column in the file for the sake of an
 * attack that `+27820000001` cannot carry.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);

  const risky = /^[=@]/.test(text) || /^[+-](?![\d\s()+-]*$)/.test(text);
  const safe = risky ? `'${text}` : text;

  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** A whole file: header, rows, BOM, CRLF. */
export function csvFile(
  header: readonly string[],
  rows: readonly (string | number | null | undefined)[][],
): string {
  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** `CUT Fundraising Gala Dinner (Demo)` → `cut-fundraising-gala-dinner-demo`. */
export function csvSlug(title: string, fallback = 'export'): string {
  return (
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || fallback
  );
}
