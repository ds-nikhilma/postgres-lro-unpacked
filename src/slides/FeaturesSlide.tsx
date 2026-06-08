import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { SlideProps } from '../types';

/**
 * "While you sleep."
 *
 * Four mini-instruments running side-by-side, all at once. No tabs.
 * The audience walks up and sees the framework's quiet background
 * work — heartbeats ticking, the cache running counter, the GC sweep
 * crawling, the orchestration tree ebbing and flowing.
 *
 * The point is the *parallel* nature of the work, not a tour of
 * separate features. It's a control-room view.
 */

export const FeaturesSlide: React.FC<SlideProps> = ({ isActive }) => {
  if (!isActive) return null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', padding: '24px 32px', gap: 14,
    }}>
      <div>
        <motion.h2
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0 }}
        >
          while you sleep
          <span style={{ fontSize: 15, color: '#8b5cf6', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
            · the four things postgres-lro does on its own
          </span>
        </motion.h2>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6, fontFamily: 'monospace' }}>
          all four are running right now · nothing to click · this is what the framework looks like idling in production
        </div>
      </div>

      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 14,
      }}>
        <Panel title="heartbeat" subtitle="claim stays alive while the worker is alive" color="#ec4899" icon="💓">
          <HeartbeatInstrument color="#ec4899" />
        </Panel>
        <Panel title="request cache" subtitle="same input · same op · billed once" color="#06b6d4" icon="🗃️">
          <CacheInstrument color="#06b6d4" />
        </Panel>
        <Panel title="garbage collection" subtitle="terminal rows swept on a schedule" color="#f59e0b" icon="🧹">
          <GCInstrument color="#f59e0b" />
        </Panel>
        <Panel title="orchestration" subtitle="parent stays running until all children done" color="#22c55e" icon="🌳">
          <OrchestrationInstrument color="#22c55e" />
        </Panel>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Panel scaffold — header + body slot
// ─────────────────────────────────────────────────────────────────────

const Panel: React.FC<{
  title: string; subtitle: string; color: string; icon: string;
  children: React.ReactNode;
}> = ({ title, subtitle, color, icon, children }) => (
  <div style={{
    display: 'flex', flexDirection: 'column',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderTop: `4px solid ${color}`,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 0,
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 16px',
      borderBottom: '1px solid #f1f5f9',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `${color}1a`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: 'monospace', fontSize: 14, fontWeight: 800, color: '#0f172a',
        }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
          {subtitle}
        </div>
      </div>
      <span style={{
        marginLeft: 'auto',
        fontSize: 10, fontFamily: 'monospace',
        color: color, fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        ● live
      </span>
    </div>
    <div style={{ flex: 1, minHeight: 0, padding: 14 }}>
      {children}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// Heartbeat instrument — a sparkline of beats over time + "claim
// until" timestamp that bumps forward on every beat
// ─────────────────────────────────────────────────────────────────────

const HeartbeatInstrument: React.FC<{ color: string }> = ({ color }) => {
  const [beats, setBeats] = useState<number[]>([]);   // millis ago for each beat in the window
  const [now, setNow] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const beatT = setInterval(() => {
      setBeats(prev => [...prev, Date.now() - start].slice(-12));
    }, 1400);
    const nowT = setInterval(() => setNow(Date.now() - start), 100);
    return () => { clearInterval(beatT); clearInterval(nowT); };
  }, []);

  const sinceLast = beats.length > 0 ? Math.max(0, now - beats[beats.length - 1]) : 0;
  const claimUntilMs = 5 * 60 * 1000;
  const claimUntilSec = Math.max(0, (claimUntilMs - sinceLast) / 1000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* sparkline */}
      <div style={{
        flex: 1, minHeight: 0,
        background: '#f8fafc', borderRadius: 8,
        display: 'flex', alignItems: 'flex-end', gap: 3,
        padding: '8px 10px',
      }}>
        {Array.from({ length: 12 }).map((_, i) => {
          const t = beats[i];
          const age = t == null ? 999999 : now - t;
          const h = Math.max(8, 50 - age / 80);
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: h,
                background: t == null ? '#e2e8f0' : color,
                opacity: t == null ? 0.3 : 1,
                borderRadius: 3,
                transition: 'height 0.18s',
              }}
            />
          );
        })}
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12,
        fontSize: 12, fontFamily: 'monospace',
      }}>
        <span style={{ color: '#475569' }}>beats sent</span>
        <span style={{ color: '#0f172a', fontWeight: 700, textAlign: 'right' }}>
          {beats.length}
        </span>
        <span style={{ color: '#475569' }}>claim_until (s remaining)</span>
        <motion.span
          key={beats.length}
          initial={{ color, scale: 1.06 }}
          animate={{ color: '#0f172a', scale: 1 }}
          transition={{ duration: 0.4 }}
          style={{ fontWeight: 700, textAlign: 'right' }}
        >
          {Math.round(claimUntilSec)}
        </motion.span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Cache instrument — hit/miss ratio over time, simulated requests
// arrive on a poisson-ish schedule
// ─────────────────────────────────────────────────────────────────────

const CacheInstrument: React.FC<{ color: string }> = ({ color }) => {
  const [hits, setHits] = useState(0);
  const [miss, setMiss] = useState(0);
  const [trail, setTrail] = useState<('hit' | 'miss')[]>([]);
  const seenKeysRef = useRef(new Set<string>());

  useEffect(() => {
    const t = setInterval(() => {
      // 70% of new requests reuse one of N keys → naturally cache-hit
      const space = ['a', 'b', 'c', 'd', 'e', 'f'];
      const key = Math.random() < 0.7
        ? space[Math.floor(Math.random() * 3)]                 // hot keys
        : space[Math.floor(Math.random() * space.length)];     // any key
      const isHit = seenKeysRef.current.has(key);
      seenKeysRef.current.add(key);
      if (isHit) setHits(h => h + 1); else setMiss(m => m + 1);
      setTrail(prev => [...prev, (isHit ? 'hit' : 'miss') as 'hit' | 'miss'].slice(-30));
    }, 600);
    return () => clearInterval(t);
  }, []);

  const total = hits + miss;
  const hitRate = total === 0 ? 0 : Math.round((hits / total) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{
        flex: 1, minHeight: 0,
        background: '#f8fafc', borderRadius: 8,
        padding: '8px 10px',
        display: 'flex', alignItems: 'flex-end', gap: 3,
      }}>
        {Array.from({ length: 30 }).map((_, i) => {
          const v = trail[i];
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: v === 'hit' ? 42 : v === 'miss' ? 22 : 6,
                background:
                  v === 'hit'  ? color :
                  v === 'miss' ? '#fda4af' :
                                 '#e2e8f0',
                borderRadius: 2,
                transition: 'height 0.2s',
              }}
            />
          );
        })}
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: 10,
        fontSize: 12, fontFamily: 'monospace',
      }}>
        <span style={{ color: '#16a34a', fontWeight: 700 }}>{hits} hits</span>
        <span style={{ color: '#dc2626', fontWeight: 700 }}>{miss} miss</span>
        <span style={{ color: '#0f172a', fontWeight: 800, textAlign: 'right' }}>
          hit-rate {hitRate}%
        </span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// GC instrument — a broom sweeping across rows, rows fade out as
// they're swept
// ─────────────────────────────────────────────────────────────────────

const GCInstrument: React.FC<{ color: string }> = ({ color }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => (x + 1) % 14), 700);
    return () => clearInterval(t);
  }, []);

  const rows = Array.from({ length: 12 }, (_, i) => i);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        background: '#f8fafc', borderRadius: 8,
        padding: 6,
        display: 'flex', flexDirection: 'column', gap: 3,
      }}>
        {rows.map(i => {
          const swept = i < tick - 1;
          const sweeping = i === tick - 1;
          const ageDays = 30 + i * 3;
          return (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 8,
                padding: '3px 8px',
                background:
                  swept    ? '#fef2f2' :
                  sweeping ? `${color}26` :
                             'transparent',
                opacity: swept ? 0.5 : 1,
                borderRadius: 4,
                transition: 'all 0.3s',
                alignItems: 'center',
              }}
            >
              <span style={{
                fontFamily: 'monospace', fontSize: 11,
                color: swept ? '#94a3b8' : '#334155',
                textDecoration: swept ? 'line-through' : 'none',
              }}>
                op-{(0xab + i).toString(16)}
              </span>
              <span style={{
                fontFamily: 'monospace', fontSize: 10,
                color:
                  swept    ? '#dc2626' :
                  sweeping ? color :
                             '#16a34a',
                fontWeight: 700,
              }}>
                {swept ? '🗑 swept' : sweeping ? '🧹 …' : `${ageDays}d`}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{
        fontSize: 11, fontFamily: 'monospace', color: '#475569', textAlign: 'right',
      }}>
        retention 30d · sweep every 5 min
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Orchestration instrument — parent + children, randomized state
// transitions
// ─────────────────────────────────────────────────────────────────────

interface Node { name: string; state: 'queued' | 'running' | 'done'; }

const OrchestrationInstrument: React.FC<{ color: string }> = ({ color }) => {
  const [parent, setParent] = useState<Node>({ name: 'ortho-plan-lro', state: 'running' });
  const [kids, setKids] = useState<Node[]>([
    { name: 'margin-line-detection',    state: 'queued'  },
    { name: 'cbct-anatomy-segmentation',state: 'queued'  },
    { name: 'tooth-recognition',        state: 'queued'  },
  ]);

  useEffect(() => {
    const tick = setInterval(() => {
      setKids(prev => {
        const all = prev.every(k => k.state === 'done');
        if (all) {
          // restart cycle
          setParent({ name: 'ortho-plan-lro', state: 'running' });
          return prev.map(k => ({ ...k, state: 'queued' as const }));
        }
        // advance one random non-done child
        const candidates = prev.map((k, i) => ({ k, i })).filter(({ k }) => k.state !== 'done');
        if (candidates.length === 0) return prev;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        const next = [...prev];
        next[pick.i] = {
          ...pick.k,
          state: pick.k.state === 'queued' ? 'running' : 'done',
        };
        if (next.every(k => k.state === 'done')) setParent(p => ({ ...p, state: 'done' }));
        return next;
      });
    }, 1100);
    return () => clearInterval(tick);
  }, []);

  const stateColor = (s: Node['state']) =>
    s === 'done'    ? '#22c55e' :
    s === 'running' ? color     :
                      '#94a3b8';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      gap: 10, height: '100%', justifyContent: 'center', alignItems: 'center',
    }}>
      <div style={{
        padding: '8px 14px',
        background: `${stateColor(parent.state)}12`,
        border: `2px solid ${stateColor(parent.state)}`,
        borderRadius: 8,
        fontFamily: 'monospace', fontSize: 13,
        fontWeight: 800, color: '#0f172a',
      }}>
        {parent.name}
        <span style={{ marginLeft: 8, color: stateColor(parent.state), fontSize: 11 }}>
          · {parent.state}
        </span>
      </div>
      <svg viewBox="0 0 200 28" style={{ width: '90%', height: 28 }} preserveAspectRatio="none">
        <line x1="100" y1="0"  x2="100" y2="14" stroke="#cbd5e1" strokeWidth="1" />
        <line x1="20"  y1="14" x2="180" y2="14" stroke="#cbd5e1" strokeWidth="1" />
        <line x1="20"  y1="14" x2="20"  y2="28" stroke="#cbd5e1" strokeWidth="1" />
        <line x1="100" y1="14" x2="100" y2="28" stroke="#cbd5e1" strokeWidth="1" />
        <line x1="180" y1="14" x2="180" y2="28" stroke="#cbd5e1" strokeWidth="1" />
      </svg>
      <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'space-around' }}>
        {kids.map(k => (
          <div
            key={k.name}
            style={{
              padding: '6px 10px',
              background: '#ffffff',
              border: `2px solid ${stateColor(k.state)}`,
              borderRadius: 6,
              minWidth: 0,
              textAlign: 'center',
            }}
          >
            <div style={{
              fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
              color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              maxWidth: 130,
            }}>
              {k.name}
            </div>
            <div style={{ fontSize: 10, color: stateColor(k.state), fontFamily: 'monospace', fontWeight: 700 }}>
              {k.state}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
