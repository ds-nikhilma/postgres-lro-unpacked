import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';

// ─── Types ───────────────────────────────────────────────────────────

type ScenarioId = 'crash' | 'retries' | 'cache';

interface TimelineEvent {
  id: number;
  time: string;
  actor: string;
  action: string;
  color: string;
  icon: string;
}

interface WorkerState {
  name: string;
  status: 'idle' | 'processing' | 'crashed' | 'done';
  color: string;
  progress: number;
  itemId: string | null;
}

interface ItemState {
  id: string;
  status: 'queued' | 'running' | 'done' | 'expired';
  claimedBy: string | null;
  claimedCount: number;
}

let timeEvtId = 0;
let simTime = 0;

function fmtTime(s: number): string {
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `10:${String(30 + min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ─── Component ───────────────────────────────────────────────────────

export const FailureScenariosSlide: React.FC<SlideProps> = ({ isActive }) => {
  const [activeScenario, setActiveScenario] = useState<ScenarioId>('crash');
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [workers, setWorkers] = useState<WorkerState[]>([]);
  const [item, setItem] = useState<ItemState | null>(null);
  const [phase, setPhase] = useState<string>('ready');
  const [cacheHits, setCacheHits] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addEvent = useCallback((actor: string, action: string, color: string, icon: string) => {
    timeEvtId++;
    simTime += 2;
    setEvents(prev => [...prev.slice(-20), { id: timeEvtId, time: fmtTime(simTime), actor, action, color, icon }]);
  }, []);

  const resetScenario = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setEvents([]);
    setPhase('ready');
    timeEvtId = 0;
    simTime = 0;
    setCacheHits(0);

    if (activeScenario === 'crash') {
      setWorkers([
        { name: 'Worker A', status: 'idle', color: '#3b82f6', progress: 0, itemId: null },
        { name: 'Worker B', status: 'idle', color: '#22c55e', progress: 0, itemId: null },
      ]);
      setItem({ id: 'item-x7f2', status: 'queued', claimedBy: null, claimedCount: 0 });
    } else if (activeScenario === 'retries') {
      setWorkers([
        { name: 'Worker A', status: 'idle', color: '#3b82f6', progress: 0, itemId: null },
        { name: 'Worker B', status: 'idle', color: '#22c55e', progress: 0, itemId: null },
        { name: 'Worker C', status: 'idle', color: '#f97316', progress: 0, itemId: null },
      ]);
      setItem({ id: 'item-bad1', status: 'queued', claimedBy: null, claimedCount: 0 });
    } else {
      setWorkers([
        { name: 'Worker', status: 'idle', color: '#3b82f6', progress: 0, itemId: null },
      ]);
      setItem({ id: 'item-abc1', status: 'queued', claimedBy: null, claimedCount: 0 });
    }
  }, [activeScenario]);

  useEffect(() => { resetScenario(); }, [activeScenario, resetScenario]);
  useEffect(() => { if (!isActive) resetScenario(); }, [isActive, resetScenario]);

  // ─── Crash & Recovery scenario ─────────────────────────────────

  const runCrashScenario = useCallback(() => {
    if (phase !== 'ready') return;
    setPhase('running');
    simTime = 0;

    // Worker A claims
    addEvent('Worker A', 'ClaimWorkItem() → claimed item-x7f2', '#3b82f6', '🔒');
    setWorkers(prev => prev.map(w => w.name === 'Worker A' ? { ...w, status: 'processing', itemId: 'item-x7f2' } : w));
    setItem(prev => prev ? { ...prev, status: 'running', claimedBy: 'Worker A', claimedCount: 1 } : null);

    // Processing...
    const progressTimer = setInterval(() => {
      setWorkers(prev => prev.map(w =>
        w.name === 'Worker A' && w.status === 'processing'
          ? { ...w, progress: Math.min(w.progress + 4, 45) }
          : w
      ));
    }, 300);

    // Heartbeat
    timerRef.current = setTimeout(() => {
      addEvent('Worker A', 'RefreshClaim() — heartbeat sent', '#8b5cf6', '💓');
    }, 3000);

    // CRASH at ~5s
    setTimeout(() => {
      clearInterval(progressTimer);
      addEvent('Worker A', 'POD CRASHES! No more heartbeats!', '#ef4444', '💥');
      setWorkers(prev => prev.map(w => w.name === 'Worker A' ? { ...w, status: 'crashed', progress: 0, itemId: null } : w));
      setPhase('crashed');
    }, 2500);
  }, [phase, addEvent]);

  const triggerClaimExpiry = useCallback(() => {
    if (phase !== 'crashed') return;
    setPhase('expired');

    addEvent('System', 'NOW() > claimed_until — claim expired!', '#f97316', '⏰');
    setItem(prev => prev ? { ...prev, status: 'queued', claimedBy: null } : null);

    // Worker B picks it up
    setTimeout(() => {
      addEvent('Worker B', 'ClaimWorkItem() → reclaimed item-x7f2 (count: 2)', '#22c55e', '🔒');
      setWorkers(prev => prev.map(w =>
        w.name === 'Worker B' ? { ...w, status: 'processing', itemId: 'item-x7f2' } : w
      ));
      setItem(prev => prev ? { ...prev, status: 'running', claimedBy: 'Worker B', claimedCount: 2 } : null);

      let prog = 0;
      const interval = setInterval(() => {
        prog += 2;
        setWorkers(prev => prev.map(w =>
          w.name === 'Worker B' ? { ...w, progress: Math.min(prog, 100) } : w
        ));
        if (prog >= 100) {
          clearInterval(interval);
          addEvent('Worker B', 'ReleaseOnSuccess() — task completed!', '#22c55e', '✅');
          setWorkers(prev => prev.map(w =>
            w.name === 'Worker B' ? { ...w, status: 'done', itemId: null } : w
          ));
          setItem(prev => prev ? { ...prev, status: 'done' } : null);
          addEvent('System', 'Self-healed! No manual intervention needed.', '#22c55e', '🎉');
          setPhase('done');
        }
      }, 250);
    }, 2500);
  }, [phase, addEvent]);

  // ─── Max retries scenario ─────────────────────────────────────

  const runRetriesScenario = useCallback(() => {
    if (phase !== 'ready') return;
    setPhase('running');
    simTime = 0;

    const workerNames = ['Worker A', 'Worker B', 'Worker C'];
    const workerColors = ['#3b82f6', '#22c55e', '#f97316'];
    let claimIdx = 0;

    const crashNext = () => {
      if (claimIdx >= 3) {
        addEvent('Cleanup', `claimed_count (3) >= MAX_CLAIM_RETRIES → status: "expired"`, '#f97316', '⚠️');
        setItem(prev => prev ? { ...prev, status: 'expired', claimedBy: null } : null);
        addEvent('System', 'Moved to workitems_inactive — prevents infinite retry loops', '#64748b', '📦');
        setPhase('done');
        return;
      }

      const name = workerNames[claimIdx];
      const color = workerColors[claimIdx];
      addEvent(name, `ClaimWorkItem() → claim #${claimIdx + 1}`, color, '🔒');
      setWorkers(prev => prev.map(w =>
        w.name === name ? { ...w, status: 'processing', itemId: 'item-bad1' } : w
      ));
      setItem(prev => prev ? { ...prev, status: 'running', claimedBy: name, claimedCount: claimIdx + 1 } : null);

      setTimeout(() => {
        addEvent(name, 'Processing fails — worker crashes!', '#ef4444', '💥');
        setWorkers(prev => prev.map(w =>
          w.name === name ? { ...w, status: 'crashed', itemId: null } : w
        ));
        setItem(prev => prev ? { ...prev, status: 'queued', claimedBy: null } : null);
        claimIdx++;
        setTimeout(crashNext, 2000);
      }, 2500);
    };

    crashNext();
  }, [phase, addEvent]);

  // ─── Cache scenario ────────────────────────────────────────────

  const runCacheScenario = useCallback(() => {
    if (phase !== 'ready' && phase !== 'cached') return;

    if (phase === 'ready') {
      setPhase('running');
      simTime = 0;
      addEvent('Client A', 'Compute(input_x) → cache_key: "hash-abc"', '#3b82f6', '📥');
      setWorkers(prev => prev.map(w => ({ ...w, status: 'processing', itemId: 'item-abc1' })));
      setItem(prev => prev ? { ...prev, status: 'running', claimedBy: 'Worker', claimedCount: 1 } : null);

      let prog = 0;
      const interval = setInterval(() => {
        prog += 2;
        setWorkers(prev => prev.map(w => ({ ...w, progress: Math.min(prog, 100) })));
        if (prog >= 100) {
          clearInterval(interval);
          addEvent('Worker', 'Done! Result stored with cache_key "hash-abc"', '#22c55e', '✅');
          setWorkers(prev => prev.map(w => ({ ...w, status: 'done', itemId: null })));
          setItem(prev => prev ? { ...prev, status: 'done' } : null);
          setPhase('cached');
        }
      }, 200);
    } else {
      // Cache hit!
      setCacheHits(prev => prev + 1);
      addEvent(`Client ${String.fromCharCode(66 + cacheHits)}`, 'Compute(input_x) → cache_key: "hash-abc" — CACHE HIT!', '#fbbf24', '⚡');
      addEvent('System', 'Returns cached result instantly. No recompute!', '#22c55e', '🎯');
    }
  }, [phase, cacheHits, addEvent]);

  if (!isActive) return null;

  const scenarios: { id: ScenarioId; label: string; icon: string }[] = [
    { id: 'crash', label: 'Worker Crash', icon: '💥' },
    { id: 'retries', label: 'Max Retries', icon: '⚠️' },
    { id: 'cache', label: 'Cache Hit', icon: '⚡' },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '30px 40px',
      gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <motion.h2
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ fontSize: 30, fontWeight: 700, color: '#e2e8f0', margin: 0 }}
        >
          Failure Scenarios & Features
        </motion.h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeScenario === 'crash' && (
            <>
              {phase === 'ready' && (
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={runCrashScenario}
                  style={actionBtnStyle('#3b82f6')}>▶ Start Processing</motion.button>
              )}
              {phase === 'crashed' && (
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={triggerClaimExpiry}
                  style={actionBtnStyle('#f97316')}>⏰ Trigger Claim Expiry</motion.button>
              )}
            </>
          )}
          {activeScenario === 'retries' && phase === 'ready' && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={runRetriesScenario}
              style={actionBtnStyle('#f97316')}>▶ Start (all will fail)</motion.button>
          )}
          {activeScenario === 'cache' && (
            <>
              {(phase === 'ready') && (
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={runCacheScenario}
                  style={actionBtnStyle('#3b82f6')}>▶ Submit First Request</motion.button>
              )}
              {phase === 'cached' && (
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={runCacheScenario}
                  style={actionBtnStyle('#fbbf24')}>⚡ Submit Duplicate</motion.button>
              )}
            </>
          )}
          {(phase === 'done' || phase === 'cached') && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={resetScenario}
              style={actionBtnStyle('#64748b')}>↺ Reset</motion.button>
          )}
        </div>
      </div>

      {/* Scenario tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {scenarios.map(s => (
          <motion.button
            key={s.id}
            onClick={() => setActiveScenario(s.id)}
            whileHover={{ scale: 1.02 }}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: s.id === activeScenario ? '2px solid #3b82f6' : '1px solid #334155',
              background: s.id === activeScenario ? '#3b82f620' : '#1e293b',
              color: s.id === activeScenario ? '#93c5fd' : '#94a3b8',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {s.icon} {s.label}
          </motion.button>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
        {/* Left: Visual state */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Work item state */}
          {item && (
            <motion.div
              layout
              style={{
                background: '#1e293b',
                borderRadius: 10,
                border: '1px solid #334155',
                padding: 16,
              }}
            >
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                Work Item
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <code style={{ fontSize: 14, color: '#cbd5e1' }}>{item.id}</code>
                <motion.span
                  key={item.status}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    color: item.status === 'queued' ? '#fbbf24' :
                           item.status === 'running' ? '#3b82f6' :
                           item.status === 'done' ? '#22c55e' : '#f97316',
                    background: item.status === 'queued' ? '#fbbf2415' :
                               item.status === 'running' ? '#3b82f615' :
                               item.status === 'done' ? '#22c55e15' : '#f9731615',
                  }}
                >
                  {item.status}
                </motion.span>
                <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                  claimed_by: {item.claimedBy || '—'}
                </span>
                <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                  count: {item.claimedCount}
                </span>
                {activeScenario === 'cache' && (
                  <span style={{ fontSize: 11, color: '#fbbf24', fontFamily: 'monospace' }}>
                    cache_key: "hash-abc"
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {/* Workers */}
          <div style={{
            background: '#1e293b',
            borderRadius: 10,
            border: '1px solid #334155',
            padding: 16,
          }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 10 }}>
              Worker Pool
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {workers.map(w => (
                <motion.div
                  key={w.name}
                  layout
                  style={{
                    flex: 1,
                    padding: 14,
                    background: '#0f172a',
                    borderRadius: 8,
                    border: `1px solid ${w.status === 'crashed' ? '#ef444460' :
                             w.status === 'done' ? '#22c55e60' :
                             w.status === 'processing' ? `${w.color}40` : '#33415580'}`,
                    textAlign: 'center',
                  }}
                >
                  <div style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: w.color,
                    fontFamily: 'monospace',
                    marginBottom: 6,
                  }}>
                    {w.name}
                  </div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: w.status === 'crashed' ? '#ef4444' :
                           w.status === 'done' ? '#22c55e' :
                           w.status === 'processing' ? '#3b82f6' : '#475569',
                  }}>
                    {w.status === 'crashed' ? '💥 CRASHED' :
                     w.status === 'done' ? '✅ Done' :
                     w.status === 'processing' ? '⚙️ Processing' : '⏸ Idle'}
                  </div>
                  {w.status === 'processing' && (
                    <div style={{
                      width: '100%',
                      height: 4,
                      background: '#334155',
                      borderRadius: 2,
                      overflow: 'hidden',
                      marginTop: 8,
                    }}>
                      <motion.div
                        animate={{ width: `${w.progress}%` }}
                        style={{
                          height: '100%',
                          background: w.color,
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Cache hit counter */}
          {activeScenario === 'cache' && cacheHits > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: '12px 20px',
                background: '#fbbf2415',
                border: '1px solid #fbbf2430',
                borderRadius: 10,
                textAlign: 'center',
                fontSize: 14,
                color: '#fbbf24',
                fontWeight: 600,
              }}
            >
              ⚡ {cacheHits} cache hit{cacheHits > 1 ? 's' : ''} — saved {cacheHits * 5}s of compute time!
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400, marginTop: 4 }}>
                Click "Submit Duplicate" again to see more cache hits
              </div>
            </motion.div>
          )}
        </div>

        {/* Right: Event log */}
        <div style={{
          width: 320,
          background: '#0f172a',
          borderRadius: 10,
          border: '1px solid #334155',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}>
          <div style={{
            padding: '8px 14px',
            borderBottom: '1px solid #334155',
            fontSize: 11,
            fontWeight: 600,
            color: '#64748b',
            textTransform: 'uppercase',
          }}>
            Timeline
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
            <AnimatePresence>
              {events.map(ev => (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: 10, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  style={{
                    padding: '6px 12px',
                    borderBottom: '1px solid #1e293b',
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11 }}>
                    <span>{ev.icon}</span>
                    <div>
                      <span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 10 }}>{ev.time}</span>
                      <span style={{ color: ev.color, fontWeight: 600, fontFamily: 'monospace', marginLeft: 6 }}>{ev.actor}</span>
                      <div style={{ color: '#94a3b8', marginTop: 2, lineHeight: 1.4 }}>{ev.action}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {events.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: '#334155', fontSize: 11, fontStyle: 'italic' }}>
                Start the scenario to see events
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function actionBtnStyle(color: string): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 8,
    border: `2px solid ${color}`,
    background: `${color}20`,
    color,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'monospace',
  };
}
