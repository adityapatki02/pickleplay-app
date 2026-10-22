import { useEffect, useState } from 'react';

/** The current time, refreshed every minute, so events move between Upcoming / Live / Past on their own. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

type Loaded<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

/**
 * Load something and keep it fresh: refetches every `pollMs` while `live` is
 * true (20s, like the event sites), and on demand through `reload`.
 */
export function useLoad<T>(key: string, load: () => Promise<T>, opts: { pollMs?: number; live?: (d: T) => boolean } = {}) {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      try {
        const data = await load();
        if (!alive) return;
        setState({ status: 'ready', data });
        if (opts.pollMs && opts.live?.(data)) timer = setTimeout(run, opts.pollMs);
      } catch {
        if (alive) setState((prev) => (prev.status === 'ready' ? prev : { status: 'error' }));
      }
    };
    run();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  return { state, reload: () => setVersion((v) => v + 1) };
}
