export type LogLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  timestamp: number;
  level: LogLevel;
  namespace: string;
  args: unknown[];
  message: string;
}

type Subscriber = (entries: LogEntry[]) => void;

const MAX_ENTRIES = 2000;
const FLUSH_INTERVAL_MS = 100;

let nextId = 0;
let dirty = false;
let flushTimer: ReturnType<typeof setInterval> | null = null;
const buffer: LogEntry[] = [];
const subscribers = new Set<Subscriber>();

function serializeArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

function flush(): void {
  if (!dirty) return;
  dirty = false;
  const snapshot = buffer.slice();
  subscribers.forEach((cb) => cb(snapshot));
}

function ensureTimer(): void {
  if (flushTimer !== null || typeof window === 'undefined') return;
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
}

export const logStore = {
  push(level: LogLevel, namespace: string, args: unknown[]): void {
    if (buffer.length >= MAX_ENTRIES) {
      buffer.splice(0, buffer.length - MAX_ENTRIES + 1);
    }
    buffer.push({
      id: nextId++,
      timestamp: Date.now(),
      level,
      namespace,
      args,
      message: serializeArgs(args),
    });
    dirty = true;
    ensureTimer();
  },

  subscribe(cb: Subscriber): () => void {
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  },

  getSnapshot(): LogEntry[] {
    return buffer.slice();
  },

  clear(): void {
    buffer.splice(0, buffer.length);
    dirty = true;
    ensureTimer();
  },
};
