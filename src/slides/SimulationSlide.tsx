import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';
import { ArchitectureMini } from '../components/ArchitectureMini';

// ─── Types ───────────────────────────────────────────────────────────

type ItemStatus = 'queued' | 'running' | 'done' | 'failed' | 'expired';

interface SimWorkItem {
  id: string;
  shortId: string;
  status: ItemStatus;
  createdAt: number;
  claimedBy: string | null;       // full technical name ("worker-pod-a1b2")
  claimedByLabel: string | null;  // simple display name ("Worker A")
  claimedUntil: number | null;
  claimedCount: number;
  progress: number; // 0-100
  processingDuration: number; // ms total
  table: 'active' | 'inactive';
  result: string | null;
  flashClaimed?: boolean;
  flashDone?: boolean;
}

type WorkerStatus = 'idle' | 'claiming' | 'processing' | 'crashed' | 'releasing';

interface SimWorker {
  id: string;
  label: string;        // simple ("Worker A")
  technical: string;    // pod name ("worker-pod-a1b2")
  status: WorkerStatus;
  currentItemId: string | null;
  progress: number;
  claimRenewals: number;
  crashedAt: number | null;
}

interface LogEntry {
  id: number;
  time: string;
  actorSimple: string;
  actorTechnical: string;
  color: string;
  icon: string;
  /** Plain-English message; shown when log mode = simple */
  messageSimple: string;
  /** Original technical message (Go API names, SQL clauses, full ids) */
  messageTechnical: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

let itemCounter = 0;
let logCounter = 0;

function makeId(): string {
  itemCounter++;
  const hex = itemCounter.toString(16).padStart(4, '0');
  return `a${hex}b3d4-e5f6-7890-abcd-ef12345${hex}`;
}

function shortTime(): string {
  const d = new Date();
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function randomDuration(): number {
  return 8000 + Math.random() * 12000; // 8-20 seconds at 1× speed
}

// ─── Status colors ───────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  queued: '#fbbf24',
  running: '#3b82f6',
  done: '#22c55e',
  failed: '#ef4444',
  expired: '#f97316',
};

const workerStatusColors: Record<string, string> = {
  idle: '#475569',
  claiming: '#fbbf24',
  processing: '#3b82f6',
  crashed: '#ef4444',
  releasing: '#22c55e',
};

const workerStatusLabel: Record<string, string> = {
  idle: 'idle',
  claiming: 'grabbing a job',
  processing: 'working',
  crashed: '💥 crashed',
  releasing: 'finishing',
};

const initialWorkers: SimWorker[] = [
  { id: 'w1', label: 'Worker A', technical: 'worker-pod-a1b2', status: 'idle', currentItemId: null, progress: 0, claimRenewals: 0, crashedAt: null },
  { id: 'w2', label: 'Worker B', technical: 'worker-pod-c3d4', status: 'idle', currentItemId: null, progress: 0, claimRenewals: 0, crashedAt: null },
  { id: 'w3', label: 'Worker C', technical: 'worker-pod-e5f6', status: 'idle', currentItemId: null, progress: 0, claimRenewals: 0, crashedAt: null },
];

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 5px',
  margin: '0 2px',
  fontSize: 10,
  fontFamily: 'monospace',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 3,
  color: '#334155',
};

// ─── Component ───────────────────────────────────────────────────────

export const SimulationSlide: React.FC<SlideProps> = ({ isActive, goToSlide }) => {
  const [items, setItems] = useState<SimWorkItem[]>([]);
  const [workers, setWorkers] = useState<SimWorker[]>(initialWorkers);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({ submitted: 0, completed: 0, failed: 0, crashed: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);
  const [logMode, setLogMode] = useState<'simple' | 'technical'>('simple');
  const [hasCrashed, setHasCrashed] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [zoomPulse, setZoomPulse] = useState(true);

  const itemsRef = useRef(items);
  const workersRef = useRef(workers);
  const isPausedRef = useRef(false);
  const simSpeedRef = useRef(1);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  itemsRef.current = items;
  workersRef.current = workers;
  isPausedRef.current = isPaused;
  simSpeedRef.current = simSpeed;

  const addLog = useCallback((
    actorSimple: string,
    actorTechnical: string,
    messageSimple: string,
    messageTechnical: string,
    color: string,
    icon: string,
  ) => {
    logCounter++;
    setLogs(prev => [...prev.slice(-50), {
      id: logCounter, time: shortTime(),
      actorSimple, actorTechnical, messageSimple, messageTechnical, color, icon,
    }]);
  }, []);

  // ─── Submit a new request ──────────────────────────────────────────

  const submitRequest = useCallback(() => {
    const id = makeId();
    const shortId = id.substring(0, 8);
    const item: SimWorkItem = {
      id, shortId,
      status: 'queued',
      createdAt: Date.now(),
      claimedBy: null,
      claimedByLabel: null,
      claimedUntil: null,
      claimedCount: 0,
      progress: 0,
      processingDuration: randomDuration(),
      table: 'active',
      result: null,
    };
    setItems(prev => [...prev, item]);
    setStats(prev => ({ ...prev, submitted: prev.submitted + 1 }));
    setHasSubmitted(true);
    addLog('Client', 'Client', `Submitted a new job (#${shortId})`, `Compute() → enqueued ${shortId}`, '#22c55e', '📥');
  }, [addLog]);

  const submitBurst = useCallback(() => {
    submitRequest();
    setTimeout(submitRequest, 100);
    setTimeout(submitRequest, 200);
  }, [submitRequest]);

  // ─── Crash a worker ────────────────────────────────────────────────

  const crashWorker = useCallback((workerId: string) => {
    const w = workersRef.current.find(w => w.id === workerId);
    if (!w || w.status === 'crashed' || w.status === 'idle') return;

    const itemId = w.currentItemId;
    setHasCrashed(true);
    addLog(w.label, w.technical, `${w.label} crashed!`, 'POD CRASHED! Claim will expire...', '#ef4444', '💥');
    setStats(prev => ({ ...prev, crashed: prev.crashed + 1 }));

    setWorkers(prev => prev.map(wk =>
      wk.id === workerId
        ? { ...wk, status: 'crashed' as WorkerStatus, currentItemId: null, progress: 0, crashedAt: Date.now() }
        : wk
    ));

    // Mark the item's claim as expired after a short delay (simulating claim expiry)
    if (itemId) {
      setTimeout(() => {
        setItems(prev => prev.map(it =>
          it.id === itemId && it.status === 'running'
            ? { ...it, status: 'queued' as ItemStatus, claimedBy: null, claimedByLabel: null, claimedUntil: null, progress: 0, flashClaimed: false }
            : it
        ));
        const short = itemId.substring(0, 8);
        addLog('System', 'System',
          `Job #${short} is back up for grabs — another worker can pick it up`,
          `Claim expired on ${short} — available for reclaim`,
          '#f97316', '⏰');
      }, 4000 / simSpeedRef.current);

      // Recover the worker after a bit
      setTimeout(() => {
        setWorkers(prev => prev.map(wk =>
          wk.id === workerId && wk.status === 'crashed'
            ? { ...wk, status: 'idle' as WorkerStatus, crashedAt: null, claimRenewals: 0 }
            : wk
        ));
        addLog(w.label, w.technical,
          `${w.label} came back online`,
          'Pod restarted, rejoining worker pool',
          '#22c55e', '🔄');
      }, 8000 / simSpeedRef.current);
    }
  }, [addLog]);

  // ─── Simulation tick (runs every 200ms / simSpeed) ─────────────────

  useEffect(() => {
    if (!isActive) return;

    const startTick = () => {
      if (tickRef.current) clearInterval(tickRef.current);
      const interval = 200 / simSpeedRef.current;
      tickRef.current = setInterval(() => {
        if (isPausedRef.current) return;

        const currentItems = itemsRef.current;
        const currentWorkers = workersRef.current;

        // Phase 1: Idle workers try to claim queued items.
        // IMPORTANT: exclude items that another worker is mid-claim on.
        // The item only transitions to 'running' 1200ms after a worker starts
        // claiming it (inside the setTimeout below). During that window the
        // item is still 'queued' in state — without this filter, the next
        // idle worker on the next tick would grab the same row and we'd have
        // multiple workers "processing" the same job. (This is exactly what
        // FOR UPDATE SKIP LOCKED prevents in real Postgres.)
        const itemsBeingClaimed = new Set(
          currentWorkers
            .filter(w => w.status === 'claiming' && w.currentItemId)
            .map(w => w.currentItemId as string)
        );
        const queuedItems = currentItems.filter(
          i => i.status === 'queued'
            && i.table === 'active'
            && !itemsBeingClaimed.has(i.id)
        );
        const idleWorkers = currentWorkers.filter(w => w.status === 'idle');

        if (queuedItems.length > 0 && idleWorkers.length > 0) {
          const item = queuedItems[0];
          const worker = idleWorkers[0];

          setWorkers(prev => prev.map(w =>
            w.id === worker.id
              ? { ...w, status: 'claiming' as WorkerStatus, currentItemId: item.id }
              : w
          ));

          setTimeout(() => {
            if (isPausedRef.current) return; // bailout if paused mid-claim
            setItems(prev => prev.map(i =>
              i.id === item.id && i.status === 'queued'
                ? {
                    ...i,
                    status: 'running' as ItemStatus,
                    claimedBy: worker.technical,
                    claimedByLabel: worker.label,
                    claimedUntil: Date.now() + 10000,
                    claimedCount: i.claimedCount + 1,
                    flashClaimed: true,
                  }
                : i
            ));
            setWorkers(prev => prev.map(w =>
              w.id === worker.id && w.currentItemId === item.id
                ? { ...w, status: 'processing' as WorkerStatus }
                : w
            ));
            addLog(worker.label, worker.technical,
              `${worker.label} grabbed job #${item.shortId}`,
              `Claimed ${item.shortId} (FOR UPDATE SKIP LOCKED)`,
              '#3b82f6', '🔒');

            setTimeout(() => {
              setItems(prev => prev.map(i =>
                i.id === item.id ? { ...i, flashClaimed: false } : i
              ));
            }, 1500 / simSpeedRef.current);
          }, 1200 / simSpeedRef.current);
        }

        // Phase 2: Processing workers advance progress
        currentWorkers.forEach(worker => {
          if (worker.status === 'processing' && worker.currentItemId) {
            const item = currentItems.find(i => i.id === worker.currentItemId);
            if (!item || item.status !== 'running') return;

            const increment = (interval / item.processingDuration) * 100;
            const newProgress = Math.min(item.progress + increment, 100);

            setItems(prev => prev.map(i =>
              i.id === item.id ? { ...i, progress: newProgress } : i
            ));
            setWorkers(prev => prev.map(w =>
              w.id === worker.id ? { ...w, progress: newProgress } : w
            ));

            // Heartbeat at ~40% and ~75%
            if (
              (item.progress < 40 && newProgress >= 40) ||
              (item.progress < 75 && newProgress >= 75)
            ) {
              setWorkers(prev => prev.map(w =>
                w.id === worker.id ? { ...w, claimRenewals: w.claimRenewals + 1 } : w
              ));
              setItems(prev => prev.map(i =>
                i.id === item.id ? { ...i, claimedUntil: Date.now() + 10000 } : i
              ));
              addLog(worker.label, worker.technical,
                `${worker.label} sent a heartbeat — still working on #${item.shortId}`,
                `RefreshClaim() on ${item.shortId} — heartbeat`,
                '#8b5cf6', '💓');
            }

            // Completion
            if (newProgress >= 100) {
              setWorkers(prev => prev.map(w =>
                w.id === worker.id
                  ? { ...w, status: 'releasing' as WorkerStatus }
                  : w
              ));
              addLog(worker.label, worker.technical,
                `${worker.label} finished #${item.shortId}, writing result`,
                `Processing complete for ${item.shortId}, releasing...`,
                '#22c55e', '✨');

              setTimeout(() => {
                setItems(prev => prev.map(i =>
                  i.id === item.id
                    ? {
                        ...i,
                        status: 'done' as ItemStatus,
                        table: 'inactive' as const,
                        result: '<Result>',
                        progress: 100,
                        flashDone: true,
                      }
                    : i
                ));
                setWorkers(prev => prev.map(w =>
                  w.id === worker.id
                    ? { ...w, status: 'idle' as WorkerStatus, currentItemId: null, progress: 0, claimRenewals: 0 }
                    : w
                ));
                setStats(prev => ({ ...prev, completed: prev.completed + 1 }));
                addLog(worker.label, worker.technical,
                  `${worker.label} marked #${item.shortId} done — result is stored`,
                  `ReleaseOnSuccess(${item.shortId}) → moved to inactive`,
                  '#22c55e', '✅');

                setTimeout(() => {
                  setItems(prev => prev.map(i =>
                    i.id === item.id ? { ...i, flashDone: false } : i
                  ));
                }, 2000 / simSpeedRef.current);
              }, 1500 / simSpeedRef.current);
            }
          }
        });
      }, interval);
    };

    startTick();
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [isActive, simSpeed, addLog]);

  // Auto-scroll the log container to its bottom on every new entry.
  // Drives scrollTop directly (instead of scrollIntoView) because the new row
  // mounts at height: 0 and grows; two rAFs let it reach its final height first.
  useEffect(() => {
    const el = logEndRef.current;
    if (!el) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      });
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [logs.length]);

  // Pre-seed when slide activates (so audience sees motion immediately)
  useEffect(() => {
    if (!isActive) return;
    const t = setTimeout(() => {
      submitRequest();
      setTimeout(submitRequest, 350);
    }, 400);
    return () => clearTimeout(t);
  // intentional: only fire on activation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const key = e.key;
      if (key === 'p' || key === 'P') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setIsPaused(p => !p);
        return;
      }
      if (key === 's' || key === 'S') {
        e.preventDefault();
        e.stopImmediatePropagation();
        submitRequest();
        return;
      }
      if (key === 'b' || key === 'B') {
        e.preventDefault();
        e.stopImmediatePropagation();
        submitBurst();
        return;
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true } as any);
  }, [isActive, submitRequest, submitBurst]);

  // Reset on deactivate
  useEffect(() => {
    if (!isActive) {
      setItems([]);
      setWorkers(initialWorkers);
      setLogs([]);
      setStats({ submitted: 0, completed: 0, failed: 0, crashed: 0 });
      setIsPaused(false);
      setHasCrashed(false);
      setHasSubmitted(false);
      itemCounter = 0;
      logCounter = 0;
    }
  }, [isActive]);

  // Zoom cue: pulse the mini-architecture briefly when the slide opens
  useEffect(() => {
    if (!isActive) return;
    setZoomPulse(true);
    const t = setTimeout(() => setZoomPulse(false), 1600);
    return () => clearTimeout(t);
  }, [isActive]);

  if (!isActive) return null;

  const activeItems = items.filter(i => i.table === 'active');
  const inactiveItems = items.filter(i => i.table === 'inactive');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '20px 28px',
      gap: 10,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div>
            <motion.h2
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0 }}
            >
              sandbox — try it yourself
              <span style={{ fontSize: 12, color: '#22c55e', marginLeft: 10, fontFamily: 'monospace', fontWeight: 500 }}>
                · zoom out · everything, live
              </span>
            </motion.h2>
            <div style={{ fontSize: 12, color: '#334155', marginTop: 3 }}>
              You've seen each piece in isolation — now watch them all run together.
            </div>
          </div>
          <ArchitectureMini
            highlight={['client', 'handler', 'service', 'repository', 'postgres', 'worker']}
            pulse={zoomPulse}
            onClick={goToSlide ? () => goToSlide('Architecture') : undefined}
            caption="all of it"
            subcaption="live, end to end"
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={submitRequest}
            title="Keyboard: S"
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '2px solid #22c55e',
              background: '#22c55e20',
              color: '#22c55e',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'monospace',
            }}
          >
            + submit job
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={submitBurst}
            title="Keyboard: B"
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #3b82f6',
              background: '#3b82f620',
              color: '#2563eb',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'monospace',
            }}
          >
            burst ×3
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsPaused(p => !p)}
            title="Keyboard: P"
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: `2px solid ${isPaused ? '#22c55e' : '#fbbf24'}`,
              background: isPaused ? '#22c55e20' : '#fbbf2420',
              color: isPaused ? '#22c55e' : '#fbbf24',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'monospace',
            }}
          >
            {isPaused ? '▶ Resume' : '❚❚ Pause'}
          </motion.button>

          {/* Speed control */}
          <div style={{
            display: 'flex',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            overflow: 'hidden',
          }}>
            {[0.5, 1, 2].map(s => (
              <button
                key={s}
                onClick={() => setSimSpeed(s)}
                style={{
                  padding: '6px 10px',
                  border: 'none',
                  background: simSpeed === s ? '#fbbf2420' : '#f8fafc',
                  color: simSpeed === s ? '#fbbf24' : '#475569',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                }}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {[
          { label: 'submitted', value: stats.submitted, color: '#475569' },
          { label: 'in queue', value: activeItems.filter(i => i.status === 'queued').length, color: '#fbbf24' },
          { label: 'working', value: activeItems.filter(i => i.status === 'running').length, color: '#3b82f6' },
          { label: 'done', value: stats.completed, color: '#22c55e' },
          { label: 'crashes', value: stats.crashed, color: '#ef4444' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '5px 12px',
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
            <span style={{ fontSize: 11, color: '#475569' }}>{s.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</span>
          </div>
        ))}

        {isPaused && (
          <motion.span
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            style={{
              fontSize: 11,
              color: '#fbbf24',
              fontFamily: 'monospace',
              fontWeight: 700,
              padding: '4px 12px',
              background: '#fbbf2415',
              borderRadius: 6,
              border: '1px solid #fbbf2440',
            }}
          >
            ❚❚ PAUSED
          </motion.span>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#475569', fontFamily: 'monospace' }} title="Keyboard shortcuts">
          <kbd style={kbdStyle}>S</kbd> submit ·{' '}
          <kbd style={kbdStyle}>B</kbd> burst ·{' '}
          <kbd style={kbdStyle}>P</kbd> pause
        </span>
      </div>

      {/* Main layout: workers + tables + logs */}
      <div style={{ flex: 1, display: 'flex', gap: 10, minHeight: 0 }}>
        {/* Left column: worker pool */}
        <div style={{ width: 270, display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#334155',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '0 4px',
          }}>
            worker pool
          </div>
          {workers.map(worker => {
            const canCrash = worker.status === 'processing' || worker.status === 'claiming';
            const isActiveWorker = worker.status !== 'idle';
            return (
              <motion.div
                key={worker.id}
                layout
                animate={{
                  scale: isActiveWorker ? 1.03 : 1,
                  boxShadow: isActiveWorker
                    ? `0 6px 20px ${workerStatusColors[worker.status]}30`
                    : '0 0 0 rgba(0,0,0,0)',
                }}
                transition={{ duration: 0.25 }}
                style={{
                  background: '#f8fafc',
                  borderRadius: 10,
                  border: `2px solid ${workerStatusColors[worker.status]}${isActiveWorker ? 'cc' : '60'}`,
                  padding: 16,
                  position: 'relative',
                  overflow: 'hidden',
                  transformOrigin: 'left center',
                }}
              >
                {canCrash && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => crashWorker(worker.id)}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 28,
                      height: 28,
                      borderRadius: 5,
                      border: '1.5px solid #ef4444',
                      background: '#ef444425',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: 15,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                    }}
                    title="Crash this worker"
                  >
                    ✕
                  </motion.button>
                )}

                {/* First-time crash hint */}
                {canCrash && !hasCrashed && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: [0.4, 1, 0.4], x: [10, 0, 10] }}
                    transition={{ repeat: Infinity, duration: 1.6 }}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 42,
                      fontSize: 12,
                      color: '#ef4444',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      pointerEvents: 'none',
                    }}
                  >
                    crash me →
                  </motion.div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <motion.div
                    animate={{
                      background: workerStatusColors[worker.status],
                      boxShadow: worker.status === 'processing'
                        ? ['0 0 0 0 rgba(59, 130, 246, 0.4)', '0 0 0 8px rgba(59, 130, 246, 0)']
                        : worker.status === 'crashed'
                        ? '0 0 10px rgba(239, 68, 68, 0.5)'
                        : 'none',
                    }}
                    transition={{
                      boxShadow: worker.status === 'processing' ? { repeat: Infinity, duration: 1.2 } : {},
                    }}
                    style={{
                      width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                    }}
                  />
                  <span style={{
                    fontSize: isActiveWorker ? 18 : 16,
                    fontFamily: 'monospace',
                    color: '#0f172a',
                    fontWeight: 800,
                  }}>
                    {logMode === 'simple' ? worker.label : worker.technical}
                  </span>
                </div>

                <div style={{
                  fontSize: isActiveWorker ? 15 : 13,
                  color: workerStatusColors[worker.status],
                  fontWeight: isActiveWorker ? 800 : 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: worker.status === 'processing' ? 8 : 0,
                }}>
                  {workerStatusLabel[worker.status]}
                  {worker.claimRenewals > 0 && worker.status === 'processing' && (
                    <span style={{ color: '#8b5cf6', marginLeft: 8, textTransform: 'none' }}>
                      ♥ {worker.claimRenewals}
                    </span>
                  )}
                </div>

                {worker.status === 'processing' && (
                  <div style={{
                    width: '100%',
                    height: 7,
                    background: '#e2e8f0',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}>
                    <motion.div
                      animate={{ width: `${worker.progress}%` }}
                      transition={{ duration: 0.2 }}
                      style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                        borderRadius: 3,
                      }}
                    />
                  </div>
                )}

                {worker.currentItemId && worker.status === 'processing' && (
                  <div style={{
                    fontSize: 12,
                    color: '#475569',
                    fontFamily: 'monospace',
                    marginTop: 6,
                    fontWeight: 600,
                  }}>
                    → #{worker.currentItemId.substring(0, 8)} ({Math.round(worker.progress)}%)
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Caption */}
          <div style={{
            marginTop: 'auto',
            padding: 12,
            background: '#ffffff',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.55 }}>
              Click <span style={{ color: '#ef4444', fontWeight: 800 }}>✕</span> on a working worker to crash it. Its claim will expire, another worker will pick the job up — no work lost.
            </div>
          </div>
        </div>

        {/* Center: Database tables */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          {/* Active table */}
          <div style={{
            flex: 1,
            background: '#f8fafc',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}>
            <div style={{
              padding: '12px 16px',
              background: '#ffffff',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} />
              <span style={{ fontFamily: 'monospace', fontSize: 15, color: '#0f172a', fontWeight: 800 }}>
                workitems_active
              </span>
              <span style={{ fontSize: 12, color: '#475569' }}>· jobs not yet complete</span>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#475569', marginLeft: 'auto', fontWeight: 600 }}>
                {activeItems.length} row{activeItems.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, fontFamily: 'monospace' }}>
                <thead>
                  <tr>
                    {['id', 'status', 'claimed_by', 'progress'].map(col => (
                      <th key={col} style={{
                        padding: '10px 14px',
                        textAlign: 'left',
                        color: '#475569',
                        fontWeight: 700,
                        borderBottom: '1px solid #e2e8f0',
                        fontSize: 12,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        position: 'sticky',
                        top: 0,
                        background: '#f8fafc',
                      }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {activeItems.map(item => (
                      <motion.tr
                        key={item.id}
                        initial={{ opacity: 0, backgroundColor: 'rgba(59, 130, 246, 0.3)' }}
                        animate={{
                          opacity: 1,
                          backgroundColor: item.flashClaimed
                            ? 'rgba(59, 130, 246, 0.2)'
                            : 'transparent',
                        }}
                        exit={{ opacity: 0, x: 30, transition: { duration: 0.3 } }}
                        layout
                      >
                        <td style={{ padding: '8px 14px', color: '#0f172a', fontWeight: 600 }}>{item.shortId}…</td>
                        <td style={{ padding: '8px 14px' }}>
                          <span style={{
                            color: statusColors[item.status],
                            fontWeight: 800,
                          }}>
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 14px', color: item.claimedBy ? '#2563eb' : '#475569', fontWeight: item.claimedBy ? 700 : 500 }}>
                          {item.claimedByLabel
                            ? (logMode === 'simple' ? item.claimedByLabel : item.claimedBy)
                            : '—'}
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          {item.status === 'running' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 80,
                                height: 7,
                                background: '#e2e8f0',
                                borderRadius: 3,
                                overflow: 'hidden',
                              }}>
                                <div style={{
                                  width: `${item.progress}%`,
                                  height: '100%',
                                  background: '#3b82f6',
                                  borderRadius: 3,
                                  transition: 'width 0.2s',
                                }} />
                              </div>
                              <span style={{ color: '#475569', fontSize: 12, fontWeight: 600 }}>
                                {Math.round(item.progress)}%
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: '#475569' }}>—</span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {activeItems.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '20px 14px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: 13 }}>
                        No active jobs — click <strong style={{ color: '#22c55e' }}>+ submit job</strong>{!hasSubmitted ? ' (or wait a moment, one is starting…)' : ''}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inactive table */}
          <div style={{
            flex: 1,
            background: '#f8fafc',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}>
            <div style={{
              padding: '12px 16px',
              background: '#ffffff',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
              <span style={{ fontFamily: 'monospace', fontSize: 15, color: '#0f172a', fontWeight: 800 }}>
                workitems_inactive
              </span>
              <span style={{ fontSize: 12, color: '#475569' }}>· finished, waiting to be polled</span>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#475569', marginLeft: 'auto', fontWeight: 600 }}>
                {inactiveItems.length} row{inactiveItems.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, fontFamily: 'monospace' }}>
                <thead>
                  <tr>
                    {['id', 'status', 'finished_by', 'result'].map(col => (
                      <th key={col} style={{
                        padding: '10px 14px',
                        textAlign: 'left',
                        color: '#475569',
                        fontWeight: 700,
                        borderBottom: '1px solid #e2e8f0',
                        fontSize: 12,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        position: 'sticky',
                        top: 0,
                        background: '#f8fafc',
                      }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {inactiveItems.map(item => (
                      <motion.tr
                        key={item.id}
                        initial={{ opacity: 0, backgroundColor: 'rgba(34, 197, 94, 0.3)' }}
                        animate={{
                          opacity: 1,
                          backgroundColor: item.flashDone
                            ? 'rgba(34, 197, 94, 0.15)'
                            : 'transparent',
                        }}
                        layout
                      >
                        <td style={{ padding: '8px 14px', color: '#0f172a', fontWeight: 600 }}>{item.shortId}…</td>
                        <td style={{ padding: '8px 14px' }}>
                          <span style={{ color: statusColors[item.status], fontWeight: 800 }}>
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 14px', color: '#2563eb', fontWeight: 700 }}>
                          {logMode === 'simple' ? item.claimedByLabel : item.claimedBy}
                        </td>
                        <td style={{ padding: '8px 14px', color: '#16a34a', fontWeight: 700 }}>{item.result}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {inactiveItems.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '20px 14px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: 13 }}>
                        Finished jobs land here. Their result is durable — the client can poll for it any time.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Event log */}
        <div style={{
          width: 380,
          background: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          minHeight: 0,
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#334155', fontFamily: 'monospace' }}>
              event log
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
              {(['simple', 'technical'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setLogMode(m)}
                  style={{
                    padding: '5px 12px',
                    border: 'none',
                    background: logMode === m ? '#3b82f620' : '#f8fafc',
                    color: logMode === m ? '#2563eb' : '#475569',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div ref={logEndRef} style={{
            flex: 1,
            overflow: 'auto',
            padding: '4px 0',
          }}>
            <AnimatePresence>
              {logs.map((log, i) => {
                const isLatest = i === logs.length - 1;
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: 10, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    style={{
                      padding: isLatest ? '14px 14px' : '8px 14px',
                      borderBottom: '1px solid #f8fafc',
                      borderLeft: isLatest ? `4px solid ${log.color}` : '4px solid transparent',
                      background: isLatest ? `${log.color}0e` : 'transparent',
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: isLatest ? 26 : 14 }}>{log.icon}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div>
                          <span style={{ color: '#475569', fontSize: 11 }}>{log.time}</span>
                          <span style={{ color: log.color, fontWeight: 800, marginLeft: 6, fontSize: isLatest ? 16 : 12 }}>
                            {logMode === 'simple' ? log.actorSimple : log.actorTechnical}
                          </span>
                        </div>
                        <div style={{
                          color: isLatest ? '#0f172a' : '#334155',
                          fontFamily: logMode === 'technical' ? 'monospace' : 'inherit',
                          fontSize: isLatest ? 18 : 12,
                          marginTop: 3,
                          fontWeight: isLatest ? 700 : 500,
                          lineHeight: isLatest ? 1.4 : 1.5,
                        }}>
                          {logMode === 'simple' ? log.messageSimple : log.messageTechnical}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {logs.length === 0 && (
              <div style={{
                padding: 22,
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: 13,
                fontStyle: 'italic',
              }}>
                Events will appear here…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
