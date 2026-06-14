import { useCallback, useState } from 'react';
import { send } from '../../messaging/client';
import type { GroupSnapshot } from '../../types';

export function useGroups() {
  const [snapshot, setSnapshot] = useState<GroupSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(undefined);
    try {
      setSnapshot(await send({ type: 'GET_SNAPSHOT', force }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setSnapshot(null);
    setError(undefined);
  }, []);

  return { snapshot, loading, error, reload: load, clear };
}
