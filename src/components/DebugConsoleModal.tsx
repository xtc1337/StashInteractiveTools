import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactDOM from 'react-dom';
import Draggable from 'react-draggable';
import { Button, Dropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowDown,
  faDownload,
  faTrash,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { useDebounce } from 'use-debounce';
import { LogEntry, LogLevel, logStore } from '../utils';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DebugConsoleHandle {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: boolean;
}

export function useDebugConsole(): DebugConsoleHandle {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  return { isOpen, open, close, toggle };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DebugConsoleModalProps {
  handle: DebugConsoleHandle;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
}

/**
 * Floating draggable debug console.
 * Renders nothing when closed so subscriptions and re-renders are zero-cost.
 *
 * Usage:
 *   const debugConsole = useDebugConsole();
 *   <button onClick={debugConsole.toggle}>Debug</button>
 *   <DebugConsoleModal handle={debugConsole} />
 */
export function DebugConsoleModal({
  handle,
  initialPosition = { x: 100, y: 100 },
  initialSize = { width: 700, height: 400 },
}: DebugConsoleModalProps) {
  if (!handle.isOpen) return null;
  return (
    <DebugConsolePanel
      handle={handle}
      initialPosition={initialPosition}
      initialSize={initialSize}
    />
  );
}

// ---------------------------------------------------------------------------
// Inner panel — all hooks live here so they only run when the panel is open
// ---------------------------------------------------------------------------

const LEVELS: LogLevel[] = ['debug', 'log', 'info', 'warn', 'error'];

interface PanelProps {
  handle: DebugConsoleHandle;
  initialPosition: { x: number; y: number };
  initialSize: { width: number; height: number };
}

function exportLogs(entries: LogEntry[], format: 'txt' | 'json' | 'csv') {
  let content: string;
  let mimeType: string;
  let ext: string;

  if (format === 'txt') {
    content = entries
      .map(
        (e) =>
          `[${new Date(e.timestamp).toISOString()}] [${e.level.toUpperCase()}] [${e.namespace}] ${e.message}`,
      )
      .join('\n');
    mimeType = 'text/plain';
    ext = 'txt';
  } else if (format === 'json') {
    content = JSON.stringify(entries, null, 2);
    mimeType = 'application/json';
    ext = 'json';
  } else {
    const rows = entries
      .map((e) =>
        [
          new Date(e.timestamp).toISOString(),
          e.level,
          e.namespace,
          `"${e.message.replace(/\n/g, ' ').replace(/"/g, '""')}"`,
        ].join(','),
      )
      .join('\n');
    content = 'timestamp,level,namespace,message\n' + rows;
    mimeType = 'text/csv';
    ext = 'csv';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stash-debug-${Date.now()}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function DebugConsolePanel({
  handle,
  initialPosition,
  initialSize,
}: PanelProps) {
  const [entries, setEntries] = useState<LogEntry[]>(() =>
    logStore.getSnapshot(),
  );
  const [levelFilter, setLevelFilter] = useState<Set<LogLevel>>(
    () => new Set<LogLevel>(LEVELS),
  );
  const [namespaceInput, setNamespaceInput] = useState('');
  const [debouncedNamespace] = useDebounce(namespaceInput, 200);
  const [isTailing, setIsTailing] = useState(true);

  const listRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);

  // Subscribe to the log store; unsubscribes on unmount (panel close)
  useEffect(() => {
    return logStore.subscribe(setEntries);
  }, []);

  // Filter entries in-memory; recomputes only when deps change
  const filteredEntries = useMemo(
    () =>
      entries.filter(
        (e) =>
          levelFilter.has(e.level) &&
          (!debouncedNamespace ||
            e.namespace
              .toLowerCase()
              .includes(debouncedNamespace.toLowerCase())),
      ),
    [entries, levelFilter, debouncedNamespace],
  );

  // Auto-scroll when tailing
  useEffect(() => {
    if (!isTailing || !listRef.current) return;
    isUserScrolling.current = true;
    listRef.current.scrollTop = listRef.current.scrollHeight;
    requestAnimationFrame(() => {
      isUserScrolling.current = false;
    });
  }, [filteredEntries, isTailing]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (isUserScrolling.current) return;
      const el = e.currentTarget;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
      if (!atBottom && isTailing) {
        setIsTailing(false);
      }
    },
    [setIsTailing, isTailing],
  );

  const toggleLevel = useCallback(
    (level: LogLevel) => {
      setLevelFilter((prev) => {
        const next = new Set(prev);
        if (next.has(level)) {
          next.delete(level);
        } else {
          next.add(level);
        }

        return next;
      });
    },
    [setLevelFilter],
  );

  return ReactDOM.createPortal(
    <Draggable
      nodeRef={nodeRef}
      defaultPosition={initialPosition}
      handle=".sit-debug-console__titlebar"
      bounds="body"
    >
      <div
        ref={nodeRef}
        className="sit-debug-console"
        style={{ width: initialSize.width, height: initialSize.height }}
      >
        {/* Title bar — drag handle */}
        <div className="sit-debug-console__titlebar">
          <span className="sit-debug-console__titlebar-title">
            Debug Console
          </span>
          <button
            className="sit-debug-console__close-btn"
            onClick={handle.close}
            title="Close"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="sit-debug-console__toolbar">
          <div className="sit-debug-console__level-filter">
            {LEVELS.map((level) => (
              <button
                key={level}
                className={[
                  'sit-debug-console__level-btn',
                  `sit-debug-console__level-btn--${level}`,
                  levelFilter.has(level)
                    ? 'sit-debug-console__level-btn--active'
                    : '',
                ]
                  .join(' ')
                  .trim()}
                onClick={() => toggleLevel(level)}
                title={`Toggle ${level} messages`}
              >
                {level.toUpperCase()}
              </button>
            ))}
          </div>

          <input
            className="sit-debug-console__ns-filter"
            type="text"
            placeholder="Filter namespace…"
            value={namespaceInput}
            onChange={(e) => setNamespaceInput(e.target.value)}
          />

          <div className="sit-debug-console__toolbar-right">
            {!isTailing && (
              <Button
                size="sm"
                variant="outline-warning"
                onClick={() => setIsTailing(true)}
                title="Resume auto-scroll"
              >
                <FontAwesomeIcon icon={faArrowDown} /> Tail
              </Button>
            )}

            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => logStore.clear()}
              title="Clear logs"
            >
              <FontAwesomeIcon icon={faTrash} />
            </Button>

            <Dropdown>
              <Dropdown.Toggle
                size="sm"
                variant="outline-secondary"
                id="sit-debug-console-export"
              >
                <FontAwesomeIcon icon={faDownload} /> Export
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item
                  onClick={() => exportLogs(filteredEntries, 'txt')}
                >
                  Export as .txt
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={() => exportLogs(filteredEntries, 'json')}
                >
                  Export as .json
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={() => exportLogs(filteredEntries, 'csv')}
                >
                  Export as .csv
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </div>

        {/* Log list */}
        <div
          className="sit-debug-console__list"
          ref={listRef}
          onScroll={handleScroll}
        >
          {filteredEntries.length === 0 ? (
            <div className="sit-debug-console__empty">No log entries</div>
          ) : (
            filteredEntries.map((e) => (
              <div
                key={e.id}
                className={`sit-debug-console__entry sit-debug-console__entry--${e.level}`}
              >
                <span className="sit-debug-console__entry-time">
                  {new Date(e.timestamp).toLocaleTimeString()}
                </span>
                <span className="sit-debug-console__entry-ns">
                  {e.namespace}
                </span>
                <span className="sit-debug-console__entry-msg">
                  {e.message}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Status bar */}
        <div className="sit-debug-console__statusbar">
          <span
            className={`sit-debug-console__tailing-indicator sit-debug-console__tailing-indicator--${isTailing ? 'active' : 'paused'}`}
          >
            {isTailing ? '● Tailing' : '○ Paused'}
          </span>
          <span>
            {filteredEntries.length} / {entries.length} entries
          </span>
        </div>
      </div>
    </Draggable>,
    document.body,
  );
}
