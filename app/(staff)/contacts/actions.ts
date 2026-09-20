'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseContactsCsv, type CsvRowError, type ParsedContact } from '@/lib/contacts/csv';

export type ImportState = {
  /** Present once an import has run. */
  report?: {
    inserted: number;
    updated: number;
    unchanged: number;
    failed: number;
    errors: CsvRowError[];
    ignoredColumns: string[];
  };
  error?: string;
};

const schema = z.object({
  // 2 MB of CSV is about 20 000 contacts; the Server Action body limit in
  // next.config.ts is 10 MB, so this is the honest stop, not the platform's.
  csv: z.string().min(1, 'Paste a CSV or choose a file.').max(2_000_000, 'That file is too large.'),
});

/** What we hold about an existing contact, for matching and for comparison. */
type Existing = {
  id: string;
  email: string | null;
  phone_e164: string | null;
  first_name: string;
  last_name: string;
  organisation: string | null;
  title: string | null;
  tags: string[];
  alumni_year: number | null;
};

/**
 * The fields an import may change on a contact that already exists.
 *
 * Enrichment, not replacement: a blank cell never erases a value that is
 * already on the record, and tags are added rather than swapped. An
 * organiser's second spreadsheet is usually a partial one, and a re-import
 * that quietly emptied a donor's organisation or dropped their `donor` tag
 * would be discovered only when a segment came back short.
 */
function diffFor(row: ParsedContact, existing: Existing) {
  const patch: Record<string, unknown> = {};

  if (row.firstName !== existing.first_name) patch.first_name = row.firstName;
  if (row.lastName !== existing.last_name) patch.last_name = row.lastName;
  if (row.email && row.email !== (existing.email?.toLowerCase() ?? null)) patch.email = row.email;
  if (row.phoneE164 && row.phoneE164 !== existing.phone_e164) patch.phone_e164 = row.phoneE164;
  if (row.organisation && row.organisation !== existing.organisation) {
    patch.organisation = row.organisation;
  }
  if (row.title && row.title !== existing.title) patch.title = row.title;
  if (row.alumniYear !== null && row.alumniYear !== existing.alumni_year) {
    patch.alumni_year = row.alumniYear;
  }

  const merged = Array.from(new Set([...existing.tags, ...row.tags])).sort();
  const current = [...existing.tags].sort();
  if (merged.length !== current.length || merged.some((t, i) => t !== current[i])) {
    patch.tags = merged;
  }

  return patch;
}

/**
 * Import contacts from a pasted or uploaded CSV, de-duplicating by email and
 * then by phone within the organiser's own department.
 *
 * Reads and writes go through the session client, so RLS decides what is
 * visible and writable: an organiser cannot reach another department's
 * contacts even if a row in their spreadsheet matches one.
 */
export async function importContacts(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const profile = await requireStaff(['organiser']);
  if (!profile.departmentId) {
    return { error: 'Your profile has no department, so contacts have nowhere to live.' };
  }

  const parsedInput = schema.safeParse({ csv: formData.get('csv') });
  if (!parsedInput.success) {
    return { error: parsedInput.error.issues[0]?.message ?? 'Check the file and try again.' };
  }

  const { rows, errors, ignoredColumns } = parseContactsCsv(parsedInput.data.csv);
  const rowErrors: CsvRowError[] = [...errors];

  if (rows.length === 0) {
    return {
      report: {
        inserted: 0,
        updated: 0,
        unchanged: 0,
        failed: rowErrors.length,
        errors: rowErrors,
        ignoredColumns,
      },
    };
  }

  const supabase = await createClient();

  const { data: existingRows, error: readError } = await supabase
    .from('contacts')
    .select('id, email, phone_e164, first_name, last_name, organisation, title, tags, alumni_year')
    .eq('department_id', profile.departmentId);

  if (readError) {
    return { error: `The existing contacts could not be read: ${readError.message}` };
  }

  const byEmail = new Map<string, Existing>();
  const byPhone = new Map<string, Existing>();
  for (const contact of (existingRows ?? []) as Existing[]) {
    if (contact.email) byEmail.set(contact.email.toLowerCase(), contact);
    if (contact.phone_e164) byPhone.set(contact.phone_e164, contact);
  }

  const toInsert: { row: ParsedContact; values: Record<string, unknown> }[] = [];
  const toUpdate: { row: ParsedContact; id: string; patch: Record<string, unknown> }[] = [];
  let unchanged = 0;

  for (const row of rows) {
    const emailMatch = row.email ? byEmail.get(row.email) : undefined;
    const phoneMatch = row.phoneE164 ? byPhone.get(row.phoneE164) : undefined;

    // Email says one person, phone says another. Merging two donor records is
    // a decision for the organiser, not for an importer.
    if (emailMatch && phoneMatch && emailMatch.id !== phoneMatch.id) {
      rowErrors.push({
        line: row.line,
        message:
          `${row.email} and ${row.phoneE164} belong to two different contacts ` +
          '(merge them by hand, then import again)',
      });
      continue;
    }

    const match = emailMatch ?? phoneMatch;

    if (!match) {
      toInsert.push({
        row,
        values: {
          department_id: profile.departmentId,
          first_name: row.firstName,
          last_name: row.lastName,
          email: row.email,
          phone_e164: row.phoneE164,
          organisation: row.organisation,
          title: row.title,
          tags: row.tags,
          alumni_year: row.alumniYear,
        },
      });
      // So a later row in the same file matches this insert rather than
      // duplicating it under the other key.
      const placeholder: Existing = {
        id: `pending:${row.line}`,
        email: row.email,
        phone_e164: row.phoneE164,
        first_name: row.firstName,
        last_name: row.lastName,
        organisation: row.organisation,
        title: row.title,
        tags: row.tags,
        alumni_year: row.alumniYear,
      };
      if (row.email) byEmail.set(row.email, placeholder);
      if (row.phoneE164) byPhone.set(row.phoneE164, placeholder);
      continue;
    }

    // Matched a row this same import is about to create: the file repeats the
    // person under a different key, which parseContactsCsv cannot see.
    if (match.id.startsWith('pending:')) {
      rowErrors.push({
        line: row.line,
        message: `the same person already appears on line ${match.id.slice('pending:'.length)}`,
      });
      continue;
    }

    const patch = diffFor(row, match);

    // Filling in a blank email or phone can collide with a different contact's
    // unique index. Report it instead of letting Postgres 23505 surface.
    if (typeof patch.email === 'string') {
      const owner = byEmail.get(patch.email);
      if (owner && owner.id !== match.id) {
        rowErrors.push({
          line: row.line,
          message: `${patch.email} is already on another contact in your department`,
        });
        continue;
      }
    }
    if (typeof patch.phone_e164 === 'string') {
      const owner = byPhone.get(patch.phone_e164);
      if (owner && owner.id !== match.id) {
        rowErrors.push({
          line: row.line,
          message: `${patch.phone_e164} is already on another contact in your department`,
        });
        continue;
      }
    }

    if (Object.keys(patch).length === 0) {
      unchanged++;
      continue;
    }

    toUpdate.push({ row, id: match.id, patch });
    // Keep the maps honest for the rest of the file.
    if (typeof patch.email === 'string')
      byEmail.set(patch.email, { ...match, ...patch } as Existing);
    if (typeof patch.phone_e164 === 'string') {
      byPhone.set(patch.phone_e164, { ...match, ...patch } as Existing);
    }
  }

  // ---- write ----
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200);
    const { data, error } = await supabase
      .from('contacts')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- values is built field by field above
      .insert(chunk.map((c) => c.values) as any)
      .select('id');

    if (error) {
      // One bad row fails the whole chunk, so fall back to one at a time and
      // name the line that is actually at fault.
      for (const item of chunk) {
        const { error: rowError } = await supabase
          .from('contacts')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as above
          .insert(item.values as any);
        if (rowError) {
          rowErrors.push({ line: item.row.line, message: rowError.message });
        } else {
          inserted++;
        }
      }
      continue;
    }
    inserted += data?.length ?? chunk.length;
  }

  for (const item of toUpdate) {
    const { error } = await supabase
      .from('contacts')
      .update({ ...item.patch, updated_at: new Date().toISOString() })
      .eq('id', item.id);

    if (error) {
      rowErrors.push({ line: item.row.line, message: error.message });
    } else {
      updated++;
    }
  }

  // Bringing a list of people into the system is a POPIA-relevant act, so it
  // is audit-logged even though the audit UI is Stage B.
  if (inserted > 0 || updated > 0) {
    await createAdminClient().rpc('log_audit', {
      p_actor_id: profile.id,
      p_action: 'contacts.imported',
      p_entity: 'contacts',
      p_metadata: { inserted, updated, unchanged, failed: rowErrors.length },
    });
  }

  revalidatePath('/contacts');

  return {
    report: {
      inserted,
      updated,
      unchanged,
      failed: rowErrors.length,
      errors: rowErrors.sort((a, b) => a.line - b.line),
      ignoredColumns,
    },
  };
}
