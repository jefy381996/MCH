/**
 * Metals do not trade 24/7. Rather than maintain a holiday calendar for three
 * London markets, status comes from how old the newest price is. That is always
 * true, including on days a calendar would get wrong (such as the LME's March
 * 2022 nickel suspension).
 */

export type FeedStatus = 'live' | 'delayed' | 'closed';

export interface FreshnessPolicy {
  /** Newer than this: "live". */
  liveWithinMs: number;
  /** Newer than this (but not live): "delayed". Older: "closed". */
  delayedWithinMs: number;
}

export const DEFAULT_FRESHNESS: FreshnessPolicy = {
  liveWithinMs: 15 * 60_000,
  delayedWithinMs: 2 * 60 * 60_000,
};

export function feedStatus(
  observedAt: Date,
  now: Date,
  policy: FreshnessPolicy = DEFAULT_FRESHNESS,
): FeedStatus {
  const age = now.getTime() - observedAt.getTime();
  if (age <= policy.liveWithinMs) return 'live';
  if (age <= policy.delayedWithinMs) return 'delayed';
  return 'closed';
}
