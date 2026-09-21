'use client';

/** The one control on the print sheet. Hidden on paper. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print bg-cut-900 hover:bg-cut-700 inline-flex h-11 items-center rounded-md px-5 text-sm font-semibold text-white transition-colors"
    >
      Print
    </button>
  );
}
