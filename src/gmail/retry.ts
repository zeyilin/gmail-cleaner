export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Exponential backoff with jitter (ms). */
export const backoff = (attempt: number, base = 400): number =>
  base * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
