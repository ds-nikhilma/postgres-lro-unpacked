import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';

/**
 * Four built-in features, presented as tabs with a small live visual
 * each:
 *   - Heartbeat: a clock that ticks claim_until forward each beat
 *   - Cache:     same key → "hit", different key → "miss"
 *   - GC:        sweep across an inactive table marking old rows
 *   - Orchestration: a parent op fanning out to two child ops
 */

type FeatureId = 'heartbeat' | 'cache' | 'gc' | 'orchestration';

interface Feature {
  id: FeatureId;
  icon: string;
  label: string;
  oneLiner: string;
  body: string;
  color: string;
}

const FEATURES: Feature[] = [
  {
    id: 'heartbeat',
    icon: '💓',
    label: 'heartbeat & reclaim',
    oneLiner: 'workers extend their claim while alive',
    body: 'A worker that took a long claim sends periodic heartbeats. Each heartbeat just bumps claimed_until forward. If the worker dies, heartbeats stop, claimed_until lapses, and another worker can claim the orphan — no work is ever lost.',
    color: '#8b5cf6',
  },
  {
    id: 'cache',
    icon: '🗃️',
    label: 'request caching',
    oneLiner: 'same input → same operation, no rework',
    body: 'Submit with a cache_key (e.g. hash of the input + worker version). If a non-failed operation with that key already exists, the call returns the existing operation_id. Two clients asking for the same expensive GPU job get billed once.',
    color: '#06b6d4',
  },
  {
    id: 'gc',
    icon: '🧹',
    label: 'garbage collection',
    oneLiner: 'old rows are swept on a schedule',
    body: 'A background sweep moves terminal items from the active table to the inactive table (keeps claim queries fast), and later soft-deletes very old inactive rows per the configured retention. No external cron job needed.',
    color: '#f59e0b',
  },
  {
    id: 'orchestration',
    icon: '🌳',
    label: 'multi-service orchestration',
    oneLiner: 'one operation fans out to many',
    body: 'A parent operation enqueues children in other LRO services. The parent stays in running until all children reach a terminal state. Status, cancel and progress propagate down the tree — without a separate workflow engine.',
    color: '#22c55e',
  },
];

export const FeaturesSlide: React.FC<SlideProps> = ({ isActive }) => {
  const [active, setActive] = useState<FeatureId>('heartbeat');
  if (!isActive) return null;

  const feature = FEATURES.find(f => f.id === active) ?? FEATURES[0];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', padding: '24px 32px', gap: 16,
    }}>
      <div>
        <motion.h2
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0 }}
        >
          built-in features
          <span style={{ fontSize: 15, color: '#8b5cf6', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
            · the four things you'd otherwise reinvent
          </span>
        </motion.h2>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6, fontFamily: 'monospace' }}>
          tab through to see each in action
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
      }}>
        {FEATURES.map(f => {
          const on = f.id === active;
          return (
            <motion.button
              key={f.id}
              onClick={() => setActive(f.id)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              style={{
                textAlign: 'left',
                padding: '14px 16px',
                background: on ? `${f.color}12` : '#f8fafc',
                border: on ? `2px solid ${f.color}` : '1px solid #e2e8f0',
                borderRadius: 10,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>{f.icon}</span>
                <span style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>
                  {f.label}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.4 }}>
                {f.oneLiner}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Detail body */}
      <AnimatePresence mode="wait">
        <motion.div
          key={feature.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr',
            gap: 14,
            minHeight: 0,
          }}
        >
          {/* Left: narration */}
          <div style={{
            background: '#fff', borderRadius: 12,
            border: `1px solid ${feature.color}40`,
            padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{
              fontSize: 12, color: feature.color, fontWeight: 800,
              fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {feature.label}
            </div>
            <div style={{ fontSize: 18, color: '#0f172a', lineHeight: 1.55 }}>
              {feature.body}
            </div>
          </div>

          {/* Right: live visual */}
          <div style={{
            background: '#f8fafc', borderRadius: 12,
            border: '1px solid #e2e8f0',
            padding: 18,
            display: 'flex', flexDirection: 'column',
            minHeight: 0,
          }}>
            <Visualizer id={feature.id} color={feature.color} />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Visualizers — one per feature, lightweight
// ─────────────────────────────────────────────────────────────────────

const Visualizer: React.FC<{ id: FeatureId; color: string }> = ({ id, color }) => {
  switch (id) {
    case 'heartbeat':     return <HeartbeatViz color={color} />;
    case 'cache':         return <CacheViz color={color} />;
    case 'gc':            return <GcViz color={color} />;
    case 'orchestration': return <OrchestrationViz color={color} />;
  }
};

const HeartbeatViz: React.FC<{ color: string }> = ({ color }) => {
  // Beat every 1.6s. Each beat extends claimed_until by 5 minutes.
  // A "crash" stops the heart; after 2 beats with no heartbeat, the
  // claim expires and another worker reclaims.
  const [beats, setBeats] = useState(0);
  const [crashed, setCrashed] = useState(false);
  const [reclaimed, setReclaimed] = useState(false);
  const start = useRef(new Date('2025-04-16T10:00:00Z').getTime()).current;

  useEffect(() => {
    if (crashed) return;
    const t = setInterval(() => setBeats(b => b + 1), 1600);
    return () => clearInterval(t);
  }, [crashed]);

  useEffect(() => {
    if (!crashed) return;
    const t = setTimeout(() => setReclaimed(true), 3000);
    return () => clearTimeout(t);
  }, [crashed]);

  const claimedUntil = new Date(start + (5 * 60 * 1000 * (beats + 1))).toISOString().slice(11, 19);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <motion.div
          animate={crashed ? { scale: 1, color: '#94a3b8' } : { scale: [1, 1.18, 1] }}
          transition={crashed ? {} : { duration: 1.6, repeat: Infinity }}
          style={{ fontSize: 56 }}
        >
          {crashed ? '💀' : '💓'}
        </motion.div>
        <div>
          <div style={{ fontSize: 13, color: '#475569', fontFamily: 'monospace' }}>
            worker-pod-7x9k
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: crashed ? '#94a3b8' : color, fontFamily: 'monospace' }}>
            {crashed ? 'no heartbeat' : `beat #${beats + 1}`}
          </div>
        </div>
      </div>

      <div style={{
        padding: '14px 18px', background: '#ffffff',
        border: '1px solid #e2e8f0', borderRadius: 10,
      }}>
        <div style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', marginBottom: 4 }}>
          claimed_until
        </div>
        <motion.div
          key={beats}
          initial={{ color: color, scale: 1.06 }}
          animate={{ color: crashed ? '#dc2626' : '#0f172a', scale: 1 }}
          transition={{ duration: 0.6 }}
          style={{ fontSize: 22, fontFamily: 'monospace', fontWeight: 800 }}
        >
          10:{claimedUntil.slice(3)}
        </motion.div>
      </div>

      {reclaimed && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '12px 16px', background: '#dcfce7',
            border: '1px solid #86efac', borderRadius: 10,
            fontSize: 14, color: '#166534', fontWeight: 600,
          }}
        >
          ✅ claim_until lapsed — <strong>worker-pod-3a2m</strong> claimed the orphaned work
        </motion.div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setCrashed(true)}
          disabled={crashed}
          style={{
            padding: '8px 14px', background: crashed ? '#e2e8f0' : '#ef4444',
            color: crashed ? '#94a3b8' : '#fff',
            border: 'none', borderRadius: 8,
            fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
            cursor: crashed ? 'not-allowed' : 'pointer',
          }}
        >
          💥 crash worker
        </button>
        <button
          onClick={() => { setBeats(0); setCrashed(false); setReclaimed(false); }}
          style={{
            padding: '8px 14px', background: '#ffffff',
            border: '1px solid #e2e8f0', borderRadius: 8,
            color: '#475569', fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ↺ reset
        </button>
      </div>
    </div>
  );
};

const CacheViz: React.FC<{ color: string }> = ({ color }) => {
  const [log, setLog] = useState<{ key: string; hit: boolean }[]>([]);
  const submit = (key: string) => {
    setLog(l => {
      const prev = l.find(e => e.key === key);
      return [...l, { key, hit: !!prev }].slice(-8);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['hash-a', 'hash-b', 'hash-c'].map(k => (
          <button
            key={k}
            onClick={() => submit(k)}
            style={{
              padding: '8px 14px', background: '#ffffff',
              border: `1px solid ${color}55`, borderRadius: 8,
              color: '#0f172a', fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            POST /jobs · cache_key={k}
          </button>
        ))}
        <button
          onClick={() => setLog([])}
          style={{
            marginLeft: 'auto',
            padding: '8px 14px', background: 'transparent',
            border: '1px solid #e2e8f0', borderRadius: 8,
            color: '#475569', fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ↺ clear
        </button>
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflow: 'auto',
        background: '#0f172a', borderRadius: 10,
        padding: 14,
        fontFamily: 'monospace', fontSize: 13,
      }}>
        {log.length === 0 && (
          <div style={{ color: '#475569', fontStyle: 'italic' }}>
            {'// submit a few requests to see hits stack up'}
          </div>
        )}
        {log.map((e, i) => (
          <motion.div
            key={`${i}-${e.key}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
              color: e.hit ? '#86efac' : '#fda4af',
              padding: '3px 0',
            }}
          >
            {e.hit ? '✓ HIT' : '✗ MISS'} · cache_key={e.key} {e.hit ? '→ returned existing op' : '→ enqueued new op'}
          </motion.div>
        ))}
      </div>

      <div style={{
        padding: '10px 14px', background: '#ecfeff',
        border: '1px solid #67e8f9', borderRadius: 8,
        fontSize: 13, color: '#155e75',
      }}>
        same cache_key → same operation_id is returned. nothing re-runs.
      </div>
    </div>
  );
};

const GcViz: React.FC<{ color: string }> = ({ color }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => (x + 1) % 12), 700);
    return () => clearInterval(t);
  }, []);

  const rows = Array.from({ length: 10 }, (_, i) => ({
    id: `op-${(0xab + i).toString(16)}`,
    state: i < tick - 1 ? 'swept' : i === tick - 1 ? 'sweeping' : 'kept',
    age: `${30 + i * 12}d`,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{
        fontSize: 13, color: '#475569', fontFamily: 'monospace',
      }}>
        inactive_workitems · GC pass · retention = 30 d
      </div>
      <div style={{
        flex: 1, minHeight: 0, overflow: 'auto',
        background: '#ffffff', borderRadius: 10,
        border: '1px solid #e2e8f0',
      }}>
        {rows.map(r => (
          <div
            key={r.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 80px 1fr',
              gap: 10,
              padding: '8px 14px',
              borderBottom: '1px solid #f1f5f9',
              alignItems: 'center',
              background:
                r.state === 'swept'    ? '#fef2f2' :
                r.state === 'sweeping' ? `${color}1a` :
                                          'transparent',
              transition: 'background 0.3s',
            }}
          >
            <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#0f172a', fontWeight: 600 }}>
              {r.id}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>
              {r.age} old
            </span>
            <span style={{
              fontSize: 12, fontFamily: 'monospace', fontWeight: 700,
              color:
                r.state === 'swept'    ? '#dc2626' :
                r.state === 'sweeping' ? color :
                                          '#16a34a',
            }}>
              {r.state === 'swept'    ? '🗑 deleted' :
               r.state === 'sweeping' ? '🧹 sweeping...' :
                                        '✓ kept'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const OrchestrationViz: React.FC<{ color: string }> = ({ color }) => {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStage(s => (s + 1) % 4), 1800);
    return () => clearInterval(t);
  }, []);

  const Node: React.FC<{
    label: string; subtitle: string;
    state: 'queued' | 'running' | 'done';
    x: number; y: number;
  }> = ({ label, subtitle, state, x, y }) => {
    const stateColor =
      state === 'done'    ? '#22c55e' :
      state === 'running' ? color :
                            '#94a3b8';
    return (
      <motion.div
        animate={{ borderColor: stateColor, boxShadow: state === 'running' ? `0 0 18px ${stateColor}55` : 'none' }}
        style={{
          position: 'absolute',
          left: `${x}%`, top: y, transform: 'translateX(-50%)',
          width: 200,
          padding: '10px 14px',
          background: '#fff',
          border: `2px solid ${stateColor}`,
          borderRadius: 10,
        }}
      >
        <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>
          {label}
        </div>
        <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#475569', marginTop: 2 }}>
          {subtitle}
        </div>
        <div style={{
          fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
          color: stateColor, marginTop: 4, textTransform: 'uppercase',
        }}>
          {state}
        </div>
      </motion.div>
    );
  };

  const parentState = stage >= 3 ? 'done' : 'running';
  const child1 = stage >= 1 ? (stage >= 3 ? 'done' : 'running') : 'queued';
  const child2 = stage >= 2 ? (stage >= 3 ? 'done' : 'running') : 'queued';

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 0 }}>
      <Node x={50} y={4}   label="ortho-plan-lro"        subtitle="parent op"           state={parentState as any} />
      <Node x={26} y={130} label="margin-line-detection" subtitle="child 1"             state={child1 as any} />
      <Node x={74} y={130} label="cbct-segmentation"     subtitle="child 2"             state={child2 as any} />

      {/* Edges */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <line x1="50" y1="20" x2="26" y2="55" stroke={color} strokeWidth="0.5" strokeDasharray="1 1" opacity={stage >= 1 ? 1 : 0.3} />
        <line x1="50" y1="20" x2="74" y2="55" stroke={color} strokeWidth="0.5" strokeDasharray="1 1" opacity={stage >= 2 ? 1 : 0.3} />
      </svg>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '10px 14px', background: '#f0fdf4',
        border: '1px solid #86efac', borderRadius: 8,
        fontSize: 13, color: '#166534',
      }}>
        parent stays <strong>running</strong> until every child reaches a terminal state. cancel propagates down.
      </div>
    </div>
  );
};
