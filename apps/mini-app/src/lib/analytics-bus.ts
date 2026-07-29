/**
 * Tiny bus so non-React helpers (e.g. share-game) can enqueue analytics
 * events into the same queue that useAnalytics flushes.
 */
export type AnalyticsEventPayload = {
  type: string;
  screen?: string;
  target?: string;
  meta?: Record<string, unknown>;
};

type EnqueueFn = (event: AnalyticsEventPayload) => void;

let enqueue: EnqueueFn | null = null;

export function setAnalyticsEnqueue(fn: EnqueueFn | null) {
  enqueue = fn;
}

export function trackAnalytics(event: AnalyticsEventPayload) {
  enqueue?.(event);
}
