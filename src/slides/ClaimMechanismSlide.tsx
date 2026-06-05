import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';
import { CodeBlock } from '../components/CodeBlock';
import { ArchitectureMini } from '../components/ArchitectureMini';

// ─── Types ───────────────────────────────────────────────────────────

type ItemStatus = 'queued' | 'locked' | 'claimed';

interface WorkerState {
  state: 'idle' | 'scanning' | 'skipping' | 'locked' | 'claimed';
  /** id of the item this worker is currently looking at (visual cursor) */
  target: string | null;
  /** plain-English message displayed inline with the worker row */
  message: string;
}

interface ItemState {
  id: string;
  status: ItemStatus;
  /** Worker name that holds (or claimed) this row */
  claimedBy: string | null;
  /** Worker color so the row tints to its owner */
  claimColor?: string;
}

type RacePhase = 'ask' | 'lock-a' | 'skip' | 'lock-bc' | 'commit';

interface RaceStep {
  phase: RacePhase;
  workers: WorkerState[];
  items: ItemState[];
  /** SQL lines (1-based) to highlight while this step is current */
  sqlLines: number[];
  event: { label: string; color: string; icon: string };
}

interface RaceEvent {
  id: number;
  step: number;
  label: string;
  color: string;
  icon: string;
}

const WORKERS = [
  { id: 'A', name: 'Worker A', color: '#22c55e' },
  { id: 'B', name: 'Worker B', color: '#3b82f6' },
  { id: 'C', name: 'Worker C', color: '#f43f5e' },
];

const ITEM_IDS = ['item-001', 'item-002', 'item-003'];

// ─── SQL (shown only when "Show SQL" is toggled on) ─────────────────

const claimSQL = `-- The magic: FOR UPDATE SKIP LOCKED
UPDATE workitems_active
SET status     = 'running',
    claimed_at = NOW(),
    claimed_count = claimed_count + 1,
    claimed_until = NOW() + interval '300s',
    claimed_by = $worker_id
WHERE id = (
  SELECT id FROM workitems_active
  WHERE expires_at > NOW()
    AND (
      status = 'queued'
      OR (status = 'running'
          AND NOW() > claimed_until
          AND claimed_count < $max_retries)
    )
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *;`;

// ─── Phase metadata + explainer ─────────────────────────────────────

const PHASE_ORDER: RacePhase[] = ['ask', 'lock-a', 'skip', 'lock-bc', 'commit'];

const PHASE_META: Record<RacePhase, { label: string; color: string; icon: string }> = {
  ask:      { label: '1. all workers ask',          color: '#475569', icon: '🔍' },
  'lock-a': { label: '2. Postgres locks for A',     color: '#22c55e', icon: '🔒' },
  skip:     { label: '3. B & C skip locked rows',   color: '#fbbf24', icon: '⏭' },
  'lock-bc':{ label: '4. B & C lock their rows',    color: '#3b82f6', icon: '🔒' },
  commit:   { label: '5. all three claim — done',   color: '#22c55e', icon: '✅' },
};

const PHASE_EXPLAINER: Record<RacePhase, { headline: string; detail: string }> = {
  ask: {
    headline: 'All three workers ask the database for work — at the exact same moment.',
    detail:  'They don\'t coordinate with each other. They don\'t check who else is asking. They each fire a SELECT and let the database sort it out.',
  },
  'lock-a': {
    headline: 'Postgres picks one winner per row. Worker A gets a lock on item-001.',
    detail:  'The FOR UPDATE clause tells Postgres "lock this row while I think about it". Only one transaction can hold a lock at a time — A got there first.',
  },
  skip: {
    headline: 'Workers B and C see item-001 is locked — and instead of waiting, they skip it.',
    detail:  'That\'s what SKIP LOCKED means. Without it, B and C would block, waiting for A. With it, they immediately move on and try the next row.',
  },
  'lock-bc': {
    headline: 'Worker B locks item-002. Worker C skips both locked rows and locks item-003.',
    detail:  'Each worker ends up with a different row — automatically. No retry logic, no application-level coordination, no "who gets what" negotiation.',
  },
  commit: {
    headline: 'All three workers commit their claims and start processing. Zero conflicts.',
    detail:  'Three workers, three rows, three claims, in one round-trip per worker. No duplicates. No deadlocks. No application code needed beyond the SQL itself.',
  },
};

// ─── Helpers to build step state ────────────────────────────────────

const idleWorkers = (): WorkerState[] => WORKERS.map(() => ({
  state: 'idle', target: null, message: 'Idle — waiting to claim',
}));

const queuedItems = (): ItemState[] => ITEM_IDS.map(id => ({
  id, status: 'queued', claimedBy: null,
}));

// ─── Race steps (state snapshots) ───────────────────────────────────

const RACE_STEPS: RaceStep[] = [
  // Step 1 — All workers fire SELECT concurrently
  {
    phase: 'ask',
    workers: [
      { state: 'scanning', target: null, message: 'SELECT FROM workitems_active WHERE status = queued …' },
      { state: 'scanning', target: null, message: 'SELECT FROM workitems_active WHERE status = queued …' },
      { state: 'scanning', target: null, message: 'SELECT FROM workitems_active WHERE status = queued …' },
    ],
    items: queuedItems(),
    sqlLines: [10, 11, 12, 13, 14, 15, 16],
    event: { label: 'All 3 workers fire SELECT at the same time — none of them coordinate with each other', color: '#475569', icon: '🔍' },
  },
  // Step 2 — Postgres applies FOR UPDATE: A wins item-001
  {
    phase: 'lock-a',
    workers: [
      { state: 'locked', target: 'item-001', message: 'FOR UPDATE → locked item-001 ✓' },
      { state: 'scanning', target: 'item-001', message: 'examining item-001 …' },
      { state: 'scanning', target: 'item-001', message: 'examining item-001 …' },
    ],
    items: [
      { id: 'item-001', status: 'locked', claimedBy: 'Worker A', claimColor: '#22c55e' },
      { id: 'item-002', status: 'queued', claimedBy: null },
      { id: 'item-003', status: 'queued', claimedBy: null },
    ],
    sqlLines: [17],
    event: { label: 'Postgres locks item-001 for Worker A (FOR UPDATE) — A is the winner for this row', color: '#22c55e', icon: '🔒' },
  },
  // Step 3 — B and C see lock, SKIP LOCKED to next row
  {
    phase: 'skip',
    workers: [
      { state: 'locked', target: 'item-001', message: 'FOR UPDATE → locked item-001 ✓' },
      { state: 'skipping', target: 'item-002', message: 'item-001 locked → SKIP LOCKED → trying item-002' },
      { state: 'skipping', target: 'item-002', message: 'item-001 locked → SKIP LOCKED → trying item-002' },
    ],
    items: [
      { id: 'item-001', status: 'locked', claimedBy: 'Worker A', claimColor: '#22c55e' },
      { id: 'item-002', status: 'queued', claimedBy: null },
      { id: 'item-003', status: 'queued', claimedBy: null },
    ],
    sqlLines: [18],
    event: { label: 'B & C see item-001 is locked — they SKIP it instead of waiting, and try item-002 next', color: '#fbbf24', icon: '⏭' },
  },
  // Step 4 — Postgres locks item-002 for B, C skips again to item-003
  {
    phase: 'lock-bc',
    workers: [
      { state: 'locked', target: 'item-001', message: 'holds item-001 ✓' },
      { state: 'locked', target: 'item-002', message: 'FOR UPDATE → locked item-002 ✓' },
      { state: 'locked', target: 'item-003', message: 'SKIP LOCKED → locked item-003 ✓' },
    ],
    items: [
      { id: 'item-001', status: 'locked', claimedBy: 'Worker A', claimColor: '#22c55e' },
      { id: 'item-002', status: 'locked', claimedBy: 'Worker B', claimColor: '#3b82f6' },
      { id: 'item-003', status: 'locked', claimedBy: 'Worker C', claimColor: '#f43f5e' },
    ],
    sqlLines: [17, 18],
    event: { label: 'B locks item-002. C skips both locked rows and locks item-003. All three workers now hold different rows.', color: '#3b82f6', icon: '🔒' },
  },
  // Step 5 — All three commit UPDATE status=running
  {
    phase: 'commit',
    workers: [
      { state: 'claimed', target: 'item-001', message: 'UPDATE status=running → claimed item-001' },
      { state: 'claimed', target: 'item-002', message: 'UPDATE status=running → claimed item-002' },
      { state: 'claimed', target: 'item-003', message: 'UPDATE status=running → claimed item-003' },
    ],
    items: [
      { id: 'item-001', status: 'claimed', claimedBy: 'Worker A', claimColor: '#22c55e' },
      { id: 'item-002', status: 'claimed', claimedBy: 'Worker B', claimColor: '#3b82f6' },
      { id: 'item-003', status: 'claimed', claimedBy: 'Worker C', claimColor: '#f43f5e' },
    ],
    sqlLines: [2, 3, 4, 5, 6, 7],
    event: { label: 'All three workers commit their claims (UPDATE SET status=running). Zero conflicts, zero waits, zero deadlocks.', color: '#22c55e', icon: '🎯' },
  },
];

// ─── Keyboard hint style ────────────────────────────────────────────

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

// ─── Main Slide ─────────────────────────────────────────────────────

let raceEventId = 0;

export const ClaimMechanismSlide: React.FC<SlideProps> = ({ isActive, goToSlide }) => {
  // Pulse the mini-architecture for the first ~1.6s after the slide opens — the
  // "zoom in" cue that orients the audience to which part of the system this slide is about.
  const [zoomPulse, setZoomPulse] = useState(true);
  // -1 = nothing fired; otherwise index of last fired step
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [workers, setWorkers] = useState<WorkerState[]>(idleWorkers());
  const [items, setItems] = useState<ItemState[]>(queuedItems());
  const [highlightLines, setHighlightLines] = useState<number[]>([]);
  const [events, setEvents] = useState<RaceEvent[]>([]);
  const [showSQL, setShowSQL] = useState(true);

  const currentStepIdxRef = useRef(-1);
  const logScrollRef = useRef<HTMLDivElement | null>(null);
  currentStepIdxRef.current = currentStepIdx;

  // Auto-scroll the log container to its bottom on every new event.
  // We drive scrollTop directly (instead of scrollIntoView) because the new
  // event mounts with height: 0 and grows via AnimatePresence, which made the
  // earlier scrollIntoView land short. Two rAFs let the new row reach its
  // final height before we measure scrollHeight.
  useEffect(() => {
    const el = logScrollRef.current;
    if (!el) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      });
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [events.length]);

  const fireStep = useCallback((i: number) => {
    const step = RACE_STEPS[i];
    if (!step) return;
    setWorkers(step.workers);
    setItems(step.items);
    setHighlightLines(step.sqlLines);
    raceEventId++;
    setEvents(prev => [...prev.slice(-15), {
      id: raceEventId, step: i + 1,
      label: step.event.label, color: step.event.color, icon: step.event.icon,
    }]);
    setCurrentStepIdx(i);
    currentStepIdxRef.current = i;
  }, []);

  const clearState = useCallback(() => {
    setWorkers(idleWorkers());
    setItems(queuedItems());
    setHighlightLines([]);
    setEvents([]);
    setCurrentStepIdx(-1);
    currentStepIdxRef.current = -1;
    raceEventId = 0;
  }, []);

  const runRace = useCallback(() => {
    clearState();
    fireStep(0);
  }, [clearState, fireStep]);

  const stepForward = useCallback(() => {
    const next = currentStepIdxRef.current + 1;
    if (next >= RACE_STEPS.length) return;
    fireStep(next);
  }, [fireStep]);

  const reset = useCallback(() => {
    clearState();
  }, [clearState]);

  const jumpToPhase = useCallback((p: RacePhase) => {
    const firstIdx = RACE_STEPS.findIndex(s => s.phase === p);
    if (firstIdx < 0) return;
    clearState();
    fireStep(firstIdx);
  }, [clearState, fireStep]);

  // Keyboard shortcuts (capture phase to win against App's slide-nav handler)
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const key = e.key;
      const idx = currentStepIdxRef.current;
      const atEnd = idx >= RACE_STEPS.length - 1;
      const atStart = idx < 0;

      if (key === ' ' || key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown') {
        if (!atEnd) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (atStart) runRace();
          else stepForward();
        }
        return;
      }
      if (key === 'r' || key === 'R') {
        e.preventDefault();
        e.stopImmediatePropagation();
        runRace();
        return;
      }
      if (key === 'Escape' || key === '0') {
        e.preventDefault();
        e.stopImmediatePropagation();
        reset();
        return;
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true } as any);
  }, [isActive, runRace, stepForward, reset]);

  // Reset on slide deactivate
  useEffect(() => {
    if (!isActive) {
      clearState();
    }
  }, [isActive, clearState]);

  // Stop the zoom-pulse after ~1.6s when the slide opens
  useEffect(() => {
    if (!isActive) return;
    setZoomPulse(true);
    const t = setTimeout(() => setZoomPulse(false), 1600);
    return () => clearTimeout(t);
  }, [isActive]);

  if (!isActive) return null;

  const isAtEnd = currentStepIdx >= RACE_STEPS.length - 1;
  const isAtStart = currentStepIdx < 0;
  const currentPhase: RacePhase | null = currentStepIdx >= 0 ? RACE_STEPS[currentStepIdx].phase : null;

  const phaseState = (p: RacePhase): 'pending' | 'active' | 'done' => {
    if (isAtStart) return 'pending';
    const firstIdx = RACE_STEPS.findIndex(s => s.phase === p);
    const lastIdx = RACE_STEPS.map(s => s.phase).lastIndexOf(p);
    if (currentStepIdx < firstIdx) return 'pending';
    if (currentStepIdx >= firstIdx && currentStepIdx <= lastIdx) return 'active';
    return 'done';
  };

  const ctrlBtn = (label: string, onClick: () => void, opts: { color?: string; disabled?: boolean; primary?: boolean } = {}) => (
    <motion.button
      whileHover={opts.disabled ? undefined : { scale: 1.05 }}
      whileTap={opts.disabled ? undefined : { scale: 0.95 }}
      onClick={onClick}
      disabled={opts.disabled}
      style={{
        padding: '7px 14px',
        borderRadius: 8,
        border: `2px solid ${opts.disabled ? '#e2e8f0' : (opts.color || '#475569')}`,
        background: opts.disabled ? '#f8fafc' : opts.primary ? `${opts.color || '#fbbf24'}20` : 'transparent',
        color: opts.disabled ? '#475569' : (opts.color || '#334155'),
        cursor: opts.disabled ? 'not-allowed' : 'pointer',
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'monospace',
      }}
    >{label}</motion.button>
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '24px 36px',
      gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <motion.h2
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0 }}
          >
            the claim mechanism
            <span style={{ fontSize: 12, color: '#fbbf24', marginLeft: 10, fontFamily: 'monospace', fontWeight: 500 }}>
              · zoom in · Worker ↔ Postgres
            </span>
          </motion.h2>
          <ArchitectureMini
            highlight={['worker', 'postgres']}
            pulse={zoomPulse}
            onClick={goToSlide ? () => goToSlide('Architecture') : undefined}
            caption="you are here"
            subcaption="the queue handoff"
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', marginRight: 4 }}>
            Step {Math.max(currentStepIdx + 1, 0)} / {RACE_STEPS.length}
          </span>
          {isAtStart
            ? ctrlBtn('▶ run race', runRace, { color: '#fbbf24', primary: true })
            : isAtEnd
              ? ctrlBtn('↻ restart', runRace, { color: '#fbbf24', primary: true })
              : ctrlBtn('step →', stepForward, { color: '#22c55e', primary: true })
          }
          {ctrlBtn('Reset', reset, { color: '#475569', disabled: isAtStart })}
        </div>
      </div>

      {/* Phase chip strip */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {PHASE_ORDER.map((p, i) => {
          const meta = PHASE_META[p];
          const state = phaseState(p);
          const isActive = state === 'active';
          const isDone = state === 'done';
          const bg = isActive ? `${meta.color}25` : isDone ? `${meta.color}10` : '#f8fafc';
          const border = isActive ? meta.color : isDone ? `${meta.color}60` : '#e2e8f0';
          const textColor = isActive ? meta.color : isDone ? `${meta.color}aa` : '#475569';
          return (
            <React.Fragment key={p}>
              <motion.button
                onClick={() => jumpToPhase(p)}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                animate={isActive ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={isActive ? { repeat: Infinity, duration: 1.5 } : { duration: 0.2 }}
                title={`Jump to “${meta.label}”`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 16px',
                  borderRadius: 999,
                  background: bg,
                  border: `2px solid ${border}`,
                  fontSize: isActive ? 16 : 14,
                  fontWeight: isActive ? 800 : 700,
                  color: textColor,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: isActive ? 18 : 16 }}>{isDone ? '✓' : meta.icon}</span>
                <span>{meta.label}</span>
              </motion.button>
              {i < PHASE_ORDER.length - 1 && (
                <span style={{ color: '#cbd5e1', fontSize: 16 }}>→</span>
              )}
            </React.Fragment>
          );
        })}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#475569', fontFamily: 'monospace' }} title="Keyboard shortcuts">
          <kbd style={kbdStyle}>Space</kbd> next ·{' '}
          <kbd style={kbdStyle}>R</kbd> restart ·{' '}
          <kbd style={kbdStyle}>Esc</kbd> reset
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 14, minHeight: 0 }}>
        {/* Left column: queue + workers */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          {/* Queue items */}
          <div style={{
            background: '#f8fafc',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: 18,
          }}>
            <div style={{ fontSize: 13, color: '#334155', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.05em' }}>
              work items queue (in Postgres)
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {items.map(item => {
                const ringColor = item.status === 'locked' ? (item.claimColor || '#fbbf24')
                  : item.status === 'claimed' ? (item.claimColor || '#22c55e')
                  : '#e2e8f0';
                const bg = item.status === 'locked' ? `${item.claimColor || '#fbbf24'}15`
                  : item.status === 'claimed' ? `${item.claimColor || '#22c55e'}15`
                  : '#ffffff';
                return (
                  <motion.div
                    key={item.id}
                    layout
                    animate={{ borderColor: ringColor, background: bg }}
                    style={{
                      flex: 1,
                      padding: '18px 14px',
                      borderRadius: 8,
                      border: '2px solid',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                      {item.id}
                    </div>
                    <div style={{
                      fontSize: 15,
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      marginTop: 6,
                      color: item.status === 'queued' ? '#475569' : ringColor,
                    }}>
                      {item.status === 'locked' && '🔒 '}{item.status === 'claimed' && '✓ '}{item.status.toUpperCase()}
                    </div>
                    {item.claimedBy && (
                      <div style={{ fontSize: 14, color: ringColor, marginTop: 4, fontFamily: 'monospace', fontWeight: 700 }}>
                        {item.claimedBy}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Workers */}
          <div style={{
            background: '#f8fafc',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: 18,
          }}>
            <div style={{ fontSize: 13, color: '#334155', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.05em' }}>
              three workers racing
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {WORKERS.map((w, i) => {
                const wState = workers[i];
                const dotColor = wState.state === 'claimed' || wState.state === 'locked' ? w.color
                  : wState.state === 'scanning' ? '#fbbf24'
                  : wState.state === 'skipping' ? '#f97316'
                  : '#475569';
                const pulsing = wState.state === 'scanning' || wState.state === 'skipping';
                const isActiveWorker = wState.state !== 'idle';
                return (
                  <motion.div
                    key={w.id}
                    layout
                    animate={{
                      borderColor: (wState.state === 'claimed' || wState.state === 'locked')
                        ? `${w.color}80`
                        : pulsing ? '#fbbf2480' : '#cbd5e180',
                      scale: isActiveWorker ? 1.025 : 1,
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 18px',
                      background: '#ffffff',
                      borderRadius: 8,
                      border: isActiveWorker ? '2px solid' : '1.5px solid',
                      transformOrigin: 'left center',
                    }}
                  >
                    <motion.div
                      animate={pulsing
                        ? { scale: [1, 1.35, 1], opacity: [0.8, 1, 0.8] }
                        : { scale: 1, opacity: 1 }}
                      transition={pulsing ? { repeat: Infinity, duration: 0.9 } : { duration: 0.2 }}
                      style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: dotColor, flexShrink: 0,
                      }}
                    />
                    <span style={{
                      fontSize: isActiveWorker ? 18 : 16,
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      color: w.color,
                      minWidth: 96,
                    }}>
                      {w.name}
                    </span>
                    <span style={{
                      fontSize: isActiveWorker ? 16 : 14,
                      color: isActiveWorker ? '#0f172a' : '#334155',
                      fontFamily: 'monospace',
                      flex: 1,
                      fontWeight: isActiveWorker ? 700 : 500,
                    }}>
                      {wState.message}
                    </span>
                    {wState.state === 'claimed' && (
                      <span style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: '#16a34a',
                        background: '#22c55e18',
                        padding: '4px 12px',
                        borderRadius: 4,
                      }}>
                        CLAIMED
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Event log */}
          <div style={{
            flex: 1,
            background: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}>
            <div style={{
              padding: '10px 14px',
              borderBottom: '1px solid #e2e8f0',
              fontSize: 14,
              fontWeight: 700,
              color: '#334155',
              fontFamily: 'monospace',
            }}>
              📋 race events
            </div>
            <div ref={logScrollRef} style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
              <AnimatePresence>
                {events.map((ev, i) => {
                  const isLatest = i === events.length - 1;
                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, x: 10, height: 0 }}
                      animate={{ opacity: 1, x: 0, height: 'auto' }}
                      style={{
                        padding: isLatest ? '16px 14px' : '9px 14px',
                        borderBottom: '1px solid #f8fafc',
                        borderLeft: isLatest ? `4px solid ${ev.color}` : '4px solid transparent',
                        background: isLatest ? `${ev.color}0e` : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{
                          flexShrink: 0,
                          width: isLatest ? 36 : 26,
                          height: isLatest ? 36 : 26,
                          borderRadius: '50%',
                          background: `${ev.color}22`,
                          border: `1.5px solid ${ev.color}`,
                          color: ev.color,
                          fontSize: isLatest ? 17 : 13,
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: 1,
                        }}>{ev.step}</span>
                        <span style={{ fontSize: isLatest ? 26 : 18, flexShrink: 0 }}>{ev.icon}</span>
                        <div style={{
                          fontSize: isLatest ? 20 : 15,
                          color: ev.color,
                          lineHeight: 1.4,
                          fontWeight: isLatest ? 800 : 600,
                        }}>{ev.label}</div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {events.length === 0 && (
                <div style={{ padding: 22, textAlign: 'center', color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
                  Press <kbd style={kbdStyle}>Space</kbd> or click <strong>▶ run race</strong> — walk the race one step at a time.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: SQL panel (open by default, maximized) */}
        <div style={{
          width: showSQL ? 540 : 48,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 0.25s',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setShowSQL(s => !s)}
            style={{
              padding: '12px 14px',
              border: 'none',
              borderBottom: showSQL ? '1px solid #e2e8f0' : 'none',
              background: '#f8fafc',
              color: '#0f172a',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'monospace',
              textAlign: showSQL ? 'left' : 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: showSQL ? 'space-between' : 'center',
              gap: 6,
              flexShrink: 0,
            }}
            title={showSQL ? 'Hide the SQL' : 'Show the SQL behind this'}
          >
            {showSQL ? (
              <>
                <span>📜 behind the scenes — the SQL</span>
                <span style={{ fontSize: 16, opacity: 0.6 }}>✕</span>
              </>
            ) : (
              <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>show SQL ▸</span>
            )}
          </button>
          {showSQL && (
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              <CodeBlock
                code={claimSQL}
                language="sql"
                title="repository.go — ClaimWorkItem"
                highlightLines={highlightLines}
                fontSize={14}
              />
              <div style={{ marginTop: 12, padding: '12px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
                <strong style={{ color: '#d97706' }}>FOR UPDATE</strong> = "lock this row while I think about it".<br />
                <strong style={{ color: '#d97706' }}>SKIP LOCKED</strong> = "if another transaction has it locked, skip it — give me the next one."
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phase explainer (plain English) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPhase ?? 'idle'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          style={{
            padding: '10px 16px',
            background: currentPhase ? `${PHASE_META[currentPhase].color}10` : '#ffffff',
            border: `1.5px solid ${currentPhase ? `${PHASE_META[currentPhase].color}60` : '#f8fafc'}`,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span style={{ fontSize: 26, flexShrink: 0 }}>
            {currentPhase ? PHASE_META[currentPhase].icon : '💡'}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            {currentPhase ? (
              <>
                <div style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: PHASE_META[currentPhase].color,
                  fontFamily: 'monospace',
                  marginBottom: 3,
                }}>
                  {PHASE_META[currentPhase].label}
                </div>
                <div style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.4 }}>
                  {PHASE_EXPLAINER[currentPhase].headline}
                </div>
                <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.45, marginTop: 3 }}>
                  {PHASE_EXPLAINER[currentPhase].detail}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', fontFamily: 'monospace', marginBottom: 3 }}>
                  the one clever trick
                </div>
                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.45 }}>
                  many workers, one queue. <strong>How does Postgres make sure no two workers grab the same job?</strong> The answer is one SQL clause: <code style={{ background: '#f8fafc', padding: '1px 6px', borderRadius: 3, color: '#fbbf24' }}>FOR UPDATE SKIP LOCKED</code>. Watch three workers race for three jobs — and never collide.
                </div>
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
