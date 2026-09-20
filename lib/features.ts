/**
 * Which parts of the platform exist yet.
 *
 * The console already knows where the broadcast desk, the auction and the
 * results will live, and it is better that the desk shows the whole evening
 * than that it hides what is coming. But a link that lands on a 404 reads as
 * a bug, so each unbuilt surface is listed here and its entry points render
 * as "coming" until the task that builds it flips the flag.
 *
 *   broadcasts  T3.1  /events/[id]/broadcasts and the pass-page feed
 *   auction     T3.2  /events/[id]/auction (settings and lots)
 *   bidding     T3.3  /p/[token]/auction and /p/[token]/bids
 *   console     T4.2  /events/[id]/auction/console
 *   results     T4.3  /events/[id]/results
 */
export const FEATURES = {
  broadcasts: true,
  auction: false,
  bidding: false,
  console: false,
  results: false,
} as const;

export type Feature = keyof typeof FEATURES;

export function isBuilt(feature: Feature): boolean {
  return FEATURES[feature];
}
