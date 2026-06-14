/**
 * Runs `fn` over `items` with at most `limit` in flight at once.
 * Keeps us well under Gmail's ~250 quota-units/sec/user budget for bulk metadata reads.
 */
export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let done = 0;
  const total = items.length;
  const workerCount = Math.min(Math.max(1, limit), total || 1);

  const worker = async (): Promise<void> => {
    while (true) {
      const i = next++;
      if (i >= total) break;
      results[i] = await fn(items[i], i);
      done++;
      onProgress?.(done, total);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
