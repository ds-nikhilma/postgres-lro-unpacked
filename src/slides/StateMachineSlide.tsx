import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';
import { ArchitectureMini } from '../components/ArchitectureMini';

// ─── State positions ─────────────────────────────────────────────────

interface StateNode {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  /** Plain-English, audience-facing description shown in the explainer card */
  description: string;
  /** Where this status lives in the schema — gives the audience an anchor */
  table: string;
  terminal: boolean;
}

interface Transition {
  from: string;
  to: string;
  /** Plain-English label shown by default ("Worker grabs it") */
  label: string;
  /** Technical Go-API label shown when "Show technical" is toggled on */
  technical: string;
  curved?: number;
}

const states: StateNode[] = [
  { id: 'queued',   label: 'QUEUED',   x: 140, y: 180, color: '#fbbf24', terminal: false,
    description: 'The job is waiting in line. No worker has picked it up yet.',
    table: 'lives in workitems_active' },
  { id: 'running',  label: 'RUNNING',  x: 420, y: 180, color: '#3b82f6', terminal: false,
    description: 'A worker has grabbed this job and is processing it. Heartbeats keep the claim alive.',
    table: 'lives in workitems_active' },
  { id: 'done',     label: 'DONE',     x: 700, y: 80,  color: '#22c55e', terminal: true,
    description: 'The job finished successfully. The result is stored — the client can poll for it.',
    table: 'moved to workitems_inactive' },
  { id: 'failed',   label: 'FAILED',   x: 700, y: 180, color: '#ef4444', terminal: true,
    description: 'The worker reported an error. The error details are stored; the client can read them.',
    table: 'moved to workitems_inactive' },
  { id: 'canceled', label: 'CANCELED', x: 700, y: 280, color: '#a855f7', terminal: true,
    description: 'The client gave up on the job and canceled it before completion.',
    table: 'moved to workitems_inactive' },
  { id: 'expired',  label: 'EXPIRED',  x: 420, y: 330, color: '#f97316', terminal: true,
    description: 'The job exceeded its retry limit or its overall time budget. It will not run again.',
    table: 'moved to workitems_inactive' },
];

const transitions: Transition[] = [
  { from: 'queued',  to: 'running',  label: 'worker grabs it',   technical: 'ClaimWorkItem()' },
  { from: 'running', to: 'done',     label: 'worker finishes',    technical: 'ReleaseOnSuccess()' },
  { from: 'running', to: 'failed',   label: 'worker errors',      technical: 'ReleaseOnError()' },
  { from: 'running', to: 'canceled', label: 'client cancels',     technical: 'CancelOperation()' },
  { from: 'running', to: 'queued',   label: 'worker crashes →\nre-queued', technical: 'claim expires', curved: -70 },
  { from: 'running', to: 'expired',  label: 'too many retries',   technical: 'MAX_CLAIM_RETRIES hit' },
  { from: 'queued',  to: 'expired',  label: 'waited too long',    technical: 'DEFAULT_LRO_LIFETIME hit', curved: 50 },
];

// Actions available from each non-terminal state.
interface Action { label: string; technical: string; icon: string; target: string; color: string; desc: string; }
const availableActions: Record<string, Action[]> = {
  queued: [
    { label: 'worker grabs it', technical: 'ClaimWorkItem()',         icon: '🔒', target: 'running',  color: '#3b82f6', desc: 'A worker claims this job and starts processing' },
    { label: 'waited too long', technical: 'DEFAULT_LRO_LIFETIME hit', icon: '⏰', target: 'expired',  color: '#f97316', desc: 'The job sat in the queue past its time budget' },
  ],
  running: [
    { label: 'worker finishes',   technical: 'ReleaseOnSuccess()',     icon: '✅', target: 'done',     color: '#22c55e', desc: 'The job completed successfully' },
    { label: 'worker errors',     technical: 'ReleaseOnError()',       icon: '❌', target: 'failed',   color: '#ef4444', desc: 'The worker reported a failure' },
    { label: 'client cancels',    technical: 'CancelOperation()',      icon: '🚫', target: 'canceled', color: '#a855f7', desc: 'The client gave up on this job' },
    { label: 'worker crashes',    technical: 'claim expires → reclaim',icon: '💥', target: 'queued',   color: '#fbbf24', desc: 'Heartbeats stop, claim expires, job is back up for grabs' },
    { label: 'too many retries',  technical: 'MAX_CLAIM_RETRIES hit',  icon: '⚠️', target: 'expired',  color: '#f97316', desc: 'The job crashed too many times — give up' },
  ],
};

// The "happy path" the audience expects to see first: queued → running → done.
const HAPPY_PATH = [
  { from: 'queued',  to: 'running', actionLabel: 'Worker grabs it',   icon: '🔒', color: '#3b82f6' },
  { from: 'running', to: 'done',    actionLabel: 'Worker finishes',   icon: '✅', color: '#22c55e' },
] as const;

interface HistoryEntry {
  id: number;
  from: string;
  to: string;
  action: string;
  icon: string;
  color: string;
}

let historyId = 0;

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

export const StateMachineSlide: React.FC<SlideProps> = ({ isActive, goToSlide }) => {
  const [currentState, setCurrentState] = useState('queued');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [animatingTransition, setAnimatingTransition] = useState<string | null>(null);
  const [transitionCount, setTransitionCount] = useState(0);
  const [showTechnical, setShowTechnical] = useState(false);
  const [happyPathRunning, setHappyPathRunning] = useState(false);
  const [zoomPulse, setZoomPulse] = useState(true);

  const stateMap = Object.fromEntries(states.map(s => [s.id, s]));
  const currentNode = stateMap[currentState];
  const actions = availableActions[currentState] || [];

  const happyPathTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    if (happyPathTimer.current) {
      clearTimeout(happyPathTimer.current);
      happyPathTimer.current = null;
    }
  };

  // Auto-scroll the transition-history container to the bottom on every new entry.
  // Two rAFs let the AnimatePresence height-grow animation reach its final size
  // before we measure scrollHeight (same pattern as ClaimMechanism's race log).
  const historyScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = historyScrollRef.current;
    if (!el) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      });
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [history.length]);

  const handleAction = useCallback((action: { label: string; target: string; icon: string; color: string }) => {
    if (animatingTransition) return;
    historyId++;
    setHistory(prev => [...prev.slice(-10), {
      id: historyId,
      from: currentState,
      to: action.target,
      action: action.label,
      icon: action.icon,
      color: action.color,
    }]);
    setAnimatingTransition(`${currentState}-${action.target}`);
    setTransitionCount(prev => prev + 1);

    setTimeout(() => {
      setCurrentState(action.target);
      setAnimatingTransition(null);
    }, 1200);
  }, [currentState, animatingTransition]);

  const reset = useCallback(() => {
    clearTimer();
    setHappyPathRunning(false);
    setCurrentState('queued');
    setHistory([]);
    setAnimatingTransition(null);
    setTransitionCount(0);
    historyId = 0;
  }, []);

  // Walk the happy path automatically: queued → running → done
  const walkHappyPath = useCallback(() => {
    clearTimer();
    reset();
    setHappyPathRunning(true);
    // Fire each step on a timer; transitions take 1.2s themselves
    let cursorState = 'queued';
    const fireStep = (i: number) => {
      if (i >= HAPPY_PATH.length) {
        setHappyPathRunning(false);
        return;
      }
      const step = HAPPY_PATH[i];
      historyId++;
      setHistory(prev => [...prev, {
        id: historyId, from: cursorState, to: step.to,
        action: step.actionLabel, icon: step.icon, color: step.color,
      }]);
      setAnimatingTransition(`${cursorState}-${step.to}`);
      setTransitionCount(prev => prev + 1);
      happyPathTimer.current = setTimeout(() => {
        setCurrentState(step.to);
        setAnimatingTransition(null);
        cursorState = step.to;
        happyPathTimer.current = setTimeout(() => fireStep(i + 1), 700);
      }, 1300);
    };
    happyPathTimer.current = setTimeout(() => fireStep(0), 300);
  }, [reset]);

  // Keyboard shortcuts (capture, so they win against App's slide-nav)
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const key = e.key;
      // H = walk happy path
      if (key === 'h' || key === 'H') {
        e.preventDefault();
        e.stopImmediatePropagation();
        walkHappyPath();
        return;
      }
      // R = reset
      if (key === 'r' || key === 'R') {
        e.preventDefault();
        e.stopImmediatePropagation();
        reset();
        return;
      }
      // Esc = reset
      if (key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        reset();
        return;
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true } as any);
  }, [isActive, walkHappyPath, reset]);

  useEffect(() => {
    if (!isActive) reset();
  }, [isActive, reset]);

  // Zoom-in cue: pulse the mini-architecture for ~1.6s on slide enter
  useEffect(() => {
    if (!isActive) return;
    setZoomPulse(true);
    const t = setTimeout(() => setZoomPulse(false), 1600);
    return () => clearTimeout(t);
  }, [isActive]);

  if (!isActive) return null;

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
        background: opts.disabled ? '#f8fafc' : opts.primary ? `${opts.color || '#22c55e'}20` : 'transparent',
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
            the states a job lives in
            <span style={{ fontSize: 12, color: '#06b6d4', marginLeft: 10, fontFamily: 'monospace', fontWeight: 500 }}>
              · zoom in · the status column
            </span>
          </motion.h2>
          <ArchitectureMini
            highlight={['postgres']}
            pulse={zoomPulse}
            onClick={goToSlide ? () => goToSlide('Architecture') : undefined}
            caption="you are here"
            subcaption="inside Postgres"
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', marginRight: 4 }}>
            transitions: {transitionCount}
          </span>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
            color: '#475569', cursor: 'pointer', fontFamily: 'monospace',
            padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 6,
          }}>
            <input
              type="checkbox"
              checked={showTechnical}
              onChange={e => setShowTechnical(e.target.checked)}
              style={{ accentColor: '#fbbf24' }}
            />
            show technical labels
          </label>
          {ctrlBtn('▶ walk happy path', walkHappyPath, { color: '#22c55e', primary: true, disabled: happyPathRunning })}
          {ctrlBtn('↺ reset', reset, { color: '#475569' })}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 14, minHeight: 0 }}>
        {/* SVG State Machine */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 0 }}>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 820 380"
            preserveAspectRatio="xMidYMid meet"
            style={{ maxHeight: '100%' }}
          >
            {/* Transitions */}
            {transitions.map((t, i) => {
              const from = stateMap[t.from];
              const to = stateMap[t.to];
              if (!from || !to) return null;

              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const ux = dx / len;
              const uy = dy / len;
              const sx = from.x + ux * 55;
              const sy = from.y + uy * 28;
              const ex = to.x - ux * 55;
              const ey = to.y - uy * 28;
              const midX = (sx + ex) / 2;
              const midY = (sy + ey) / 2;

              const isActive = animatingTransition === `${t.from}-${t.to}`;
              const path = t.curved
                ? `M ${sx} ${sy} Q ${midX + (t.curved * -uy)} ${midY + (t.curved * ux)} ${ex} ${ey}`
                : `M ${sx} ${sy} L ${ex} ${ey}`;
              const labelX = t.curved ? midX + (t.curved * -uy * 0.4) : midX;
              const labelY = t.curved ? midY + (t.curved * ux * 0.4) - 10 : midY - 12;
              const labelText = showTechnical ? t.technical : t.label;

              return (
                <g key={i}>
                  <defs>
                    <marker id={`arr-${i}`} markerWidth="10" markerHeight="10" refX="8" refY="5"
                      orient="auto" markerUnits="strokeWidth">
                      <polygon points="0,0 10,5 0,10" fill={isActive ? '#0f172a' : '#475569'} />
                    </marker>
                  </defs>
                  <path d={path} fill="none"
                    stroke={isActive ? '#0f172a' : '#475569'}
                    strokeWidth={isActive ? 3 : 2}
                    strokeDasharray={isActive ? '0' : '5 4'}
                    markerEnd={`url(#arr-${i})`}
                    style={{ transition: 'stroke 0.3s, stroke-width 0.3s' }}
                  />
                  {isActive && (
                    <motion.circle
                      r={7}
                      fill="#fbbf24"
                      initial={{ offsetDistance: '0%' }}
                      animate={{ offsetDistance: '100%' }}
                      style={{ offsetPath: `path('${path}')` } as any}
                      transition={{ duration: 1.0 }}
                    />
                  )}
                  {labelText.split('\n').map((line, li) => (
                    <text key={li} x={labelX} y={labelY + li * 13} textAnchor="middle"
                      fill={isActive ? '#0f172a' : '#475569'}
                      fontSize={isActive ? 14 : 12} fontFamily="monospace"
                      fontWeight={isActive ? 800 : 500}
                      style={{ transition: 'fill 0.3s' }}>
                      {line}
                    </text>
                  ))}
                </g>
              );
            })}

            {/* State nodes */}
            {states.map((state) => {
              const isCurrent = state.id === currentState;
              return (
                <motion.g key={state.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring' }}
                >
                  {isCurrent && (
                    <motion.rect
                      x={state.x - 58} y={state.y - 32}
                      width={116} height={64}
                      rx="16" ry="16"
                      fill="none" stroke={state.color}
                      animate={{
                        strokeWidth: [2, 4.5, 2],
                        opacity: [0.35, 0.85, 0.35],
                      }}
                      transition={{ repeat: Infinity, duration: 1.4 }}
                    />
                  )}
                  <rect
                    x={state.x - 52} y={state.y - 27}
                    width={104} height={54}
                    rx="12" ry="12"
                    fill={isCurrent ? `${state.color}30` : `${state.color}10`}
                    stroke={state.color}
                    strokeWidth={isCurrent ? 3 : 2}
                    style={{ transition: 'fill 0.3s, stroke-width 0.3s' }}
                  />
                  <circle cx={state.x - 32} cy={state.y} r={4.5}
                    fill={state.color}
                    opacity={isCurrent ? 1 : 0.5}
                  />
                  <text x={state.x + 6} y={state.y + 6} textAnchor="middle"
                    fill={state.color} fontSize={isCurrent ? 18 : 15} fontWeight={isCurrent ? 800 : 700} fontFamily="monospace"
                    style={{ transition: 'font-size 0.3s' }}>
                    {state.label}
                  </text>
                  {isCurrent && (
                    <motion.g
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <rect x={state.x - 22} y={state.y - 44} width={44} height={18}
                        rx="4" fill={state.color} />
                      <text x={state.x} y={state.y - 31} textAnchor="middle"
                        fill="#ffffff" fontSize="10" fontWeight="700" fontFamily="monospace">
                        HERE
                      </text>
                    </motion.g>
                  )}
                  {state.terminal && (
                    <text x={state.x} y={state.y + 44} textAnchor="middle"
                      fill="#475569" fontSize="10" fontFamily="monospace">
                      (final)
                    </text>
                  )}
                </motion.g>
              );
            })}
          </svg>
        </div>

        {/* Right panel: actions + history */}
        <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0, minHeight: 0 }}>
          {/* Actions */}
          {actions.length > 0 ? (
            <div style={{
              background: '#f8fafc',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              padding: 12,
            }}>
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
                what can happen next?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {actions.map(action => (
                  <motion.button
                    key={action.label}
                    whileHover={{ scale: 1.02, backgroundColor: `${action.color}20` }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleAction(action)}
                    disabled={animatingTransition !== null}
                    title={action.technical}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${action.color}40`,
                      background: `${action.color}10`,
                      color: action.color,
                      cursor: animatingTransition ? 'not-allowed' : 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      textAlign: 'left',
                      opacity: animatingTransition ? 0.5 : 1,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{action.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div>{action.label}</div>
                      <div style={{ fontSize: 10, color: '#475569', fontWeight: 400 }}>
                        {showTechnical ? action.technical : action.desc}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              background: '#f8fafc',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              padding: 16,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>
                final state reached
              </div>
              {ctrlBtn('↺ start over', reset, { color: '#3b82f6', primary: true })}
            </div>
          )}

          {/* Transition history */}
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
              color: '#334155',
              fontWeight: 700,
              fontFamily: 'monospace',
            }}>
              📋 transition history
            </div>
            <div ref={historyScrollRef} style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
              <AnimatePresence>
                {history.map((h, i) => {
                  const isLatest = i === history.length - 1;
                  const toColor = stateMap[h.to]?.color || '#475569';
                  return (
                    <motion.div
                      key={h.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      style={{
                        padding: isLatest ? '15px 14px' : '8px 14px',
                        borderBottom: '1px solid #f8fafc',
                        borderLeft: isLatest ? `4px solid ${toColor}` : '4px solid transparent',
                        background: isLatest ? `${toColor}0e` : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: isLatest ? 24 : 15 }}>{h.icon}</span>
                        <span style={{
                          color: stateMap[h.from]?.color || '#475569',
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          fontSize: isLatest ? 19 : 13,
                        }}>
                          {h.from}
                        </span>
                        <span style={{ color: '#475569', fontSize: isLatest ? 19 : 13 }}>→</span>
                        <span style={{
                          color: toColor,
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          fontSize: isLatest ? 19 : 13,
                        }}>
                          {h.to}
                        </span>
                      </div>
                      <div style={{
                        fontSize: isLatest ? 16 : 12,
                        color: isLatest ? '#0f172a' : '#475569',
                        marginLeft: isLatest ? 34 : 27,
                        marginTop: 3,
                        fontWeight: isLatest ? 700 : 500,
                      }}>
                        {h.action}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {history.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
                  click an action — or press <kbd style={kbdStyle}>H</kbd> for the happy path.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Plain-English explainer for the current state */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentState}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          style={{
            padding: '10px 16px',
            background: `${currentNode.color}10`,
            border: `1.5px solid ${currentNode.color}60`,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            style={{
              width: 14, height: 14, borderRadius: '50%',
              background: currentNode.color, flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: currentNode.color,
              fontFamily: 'monospace',
              marginBottom: 2,
            }}>
              current state: {currentNode.label}
              <span style={{ color: '#475569', fontWeight: 500, marginLeft: 10 }}>
                · {currentNode.table}
              </span>
            </div>
            <div style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.4 }}>
              {currentNode.description}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Color legend + keyboard hint */}
      <div style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '6px 12px',
        background: '#ffffff',
        border: '1px solid #f8fafc',
        borderRadius: 8,
      }}>
        <span style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', marginRight: 4 }}>states:</span>
        {states.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 11, height: 11, borderRadius: 3,
              background: `${s.color}30`,
              border: `1.5px solid ${s.color}`,
            }} />
            <span style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace' }}>{s.label}</span>
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#475569', fontFamily: 'monospace' }} title="Keyboard shortcuts">
          <kbd style={kbdStyle}>H</kbd> happy path ·{' '}
          <kbd style={kbdStyle}>R</kbd> reset ·{' '}
          <kbd style={kbdStyle}>Esc</kbd> reset
        </span>
      </div>
    </div>
  );
};
