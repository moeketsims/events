'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CSV_TEMPLATE, parseContactsCsv } from '@/lib/contacts/csv';
import { importContacts, type ImportState } from './actions';

/**
 * CSV import — TASKS T2.1. Paste or choose a file, see exactly what will
 * happen before it happens, then import.
 *
 * The preview runs the same `parseContactsCsv` the Server Action runs, so what
 * the organiser is shown is what the database will be asked to do. The action
 * re-parses server-side: the preview is a courtesy, never the validation.
 */
export function ImportDialog() {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [state, action] = useActionState<ImportState, FormData>(importContacts, {});
  const fileInput = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => (csv.trim() ? parseContactsCsv(csv) : null), [csv]);

  // A finished import leaves the report on screen; clearing the textarea keeps
  // a second paste from being read as a correction of the first.
  useEffect(() => {
    if (state.report) setCsv('');
  }, [state.report]);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsv(await file.text());
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCsv('');
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-11 px-5">
          <Upload className="size-4" aria-hidden /> Import a CSV
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>
            Columns: <code className="font-mono text-xs">first_name</code>,{' '}
            <code className="font-mono text-xs">last_name</code>,{' '}
            <code className="font-mono text-xs">email</code>,{' '}
            <code className="font-mono text-xs">phone</code>,{' '}
            <code className="font-mono text-xs">organisation</code>,{' '}
            <code className="font-mono text-xs">title</code>,{' '}
            <code className="font-mono text-xs">tags</code>,{' '}
            <code className="font-mono text-xs">alumni_year</code>. Each person needs a name and
            either an email address or a phone number. Someone already on the list is matched by
            email, then by phone, and enriched: a blank cell never erases what is there, and tags
            are added rather than replaced.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={onFile}
              className="sr-only"
              aria-label="Choose a CSV file"
            />
            <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
              Choose a file
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCsv(CSV_TEMPLATE)}
              className="text-cut-700"
            >
              Paste the example
            </Button>
          </div>

          <div>
            <label htmlFor="csv" className="label-caps text-ink-500 mb-2 block">
              CSV
            </label>
            <textarea
              id="csv"
              name="csv"
              required
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={8}
              spellCheck={false}
              placeholder="first_name,last_name,email,phone,organisation,title,tags,alumni_year"
              className="border-hairline-strong focus:border-cut-700 focus:ring-cut-700/20 w-full rounded-md border bg-white p-3 font-mono text-xs focus:ring-4 focus:outline-none"
            />
          </div>

          {preview ? <Preview result={preview} /> : null}

          {state.error ? (
            <p role="alert" className="rounded-md bg-red-700/10 p-3 text-sm text-red-700">
              {state.error}
            </p>
          ) : null}

          {state.report ? <Report report={state.report} /> : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {state.report ? 'Close' : 'Cancel'}
              </Button>
            </DialogClose>
            <Submit count={preview?.rows.length ?? 0} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Submit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || count === 0}>
      {pending
        ? 'Importing…'
        : count === 0
          ? 'Import'
          : `Import ${count} ${count === 1 ? 'row' : 'rows'}`}
    </Button>
  );
}

function Preview({ result }: { result: ReturnType<typeof parseContactsCsv> }) {
  const { rows, errors, ignoredColumns } = result;

  return (
    <div className="border-hairline bg-cut-50/60 rounded-lg border p-4">
      <p className="text-ink-700 text-sm">
        <span className="text-cut-900 font-semibold">{rows.length}</span> row
        {rows.length === 1 ? '' : 's'} ready
        {errors.length > 0 ? (
          <>
            , <span className="font-semibold text-red-700">{errors.length}</span> to fix
          </>
        ) : null}
        .
      </p>

      {ignoredColumns.length > 0 ? (
        <p className="text-ink-500 mt-1 text-xs">
          Ignoring column{ignoredColumns.length === 1 ? '' : 's'}: {ignoredColumns.join(', ')}.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="text-ink-700 mt-3 space-y-1 text-xs">
          {rows.slice(0, 5).map((row) => (
            <li key={row.line} className="truncate">
              <span className="text-ink-500 font-mono">{row.line}</span> {row.firstName}{' '}
              {row.lastName} · {row.email ?? row.phoneE164}
              {row.tags.length > 0 ? ` · ${row.tags.join(', ')}` : ''}
            </li>
          ))}
          {rows.length > 5 ? <li className="text-ink-500">and {rows.length - 5} more…</li> : null}
        </ul>
      ) : null}

      <ErrorList errors={errors} />
    </div>
  );
}

function ErrorList({ errors }: { errors: { line: number; message: string }[] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1 text-xs text-red-700">
      {errors.slice(0, 12).map((e) => (
        <li key={`${e.line}-${e.message}`}>
          <span className="font-mono font-semibold">Line {e.line}</span> — {e.message}
        </li>
      ))}
      {errors.length > 12 ? <li>and {errors.length - 12} more…</li> : null}
    </ul>
  );
}

function Report({ report }: { report: NonNullable<ImportState['report']> }) {
  const { inserted, updated, unchanged, errors } = report;

  return (
    <div role="status" className="border-hairline rounded-lg border bg-white p-4">
      <div className="ledger grid grid-cols-3 rounded-none border-x-0">
        {[
          { label: 'Added', value: inserted },
          { label: 'Updated', value: updated },
          { label: 'Unchanged', value: unchanged },
        ].map((figure) => (
          <div key={figure.label} className="!px-4 !py-3">
            <p className="label-caps text-ink-500 text-[0.625rem]">{figure.label}</p>
            <p className="numeral text-cut-900 mt-1 text-3xl">{figure.value}</p>
          </div>
        ))}
      </div>

      {errors.length === 0 ? (
        <p className="text-ink-500 mt-3 text-sm">Every row was read.</p>
      ) : (
        <>
          <p className="mt-3 text-sm font-semibold text-red-700">
            {errors.length} row{errors.length === 1 ? '' : 's'} could not be imported
          </p>
          <ErrorList errors={errors} />
        </>
      )}
    </div>
  );
}
