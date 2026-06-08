import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';

/**
 * Rolling deploy simulator.
 *
 * Six worker pods, each pinned to a semver. The audience presses
 * "deploy v2.0.0" — pods flip versions one at a time, every 1.2 s.
 * In-flight jobs (shown as pills on each pod) keep running on the
 * version they were pinned to at enqueue time. New incoming jobs are
 * routed by the current constraint.
 *
 * The constraint pill at the top lets you switch between the four
 * match modes. The audience sees which pods are eligible to claim
 * the next job for each constraint, and watches in-flight work survive
 * the rotation.
 */

const VERSIONS = ['1.0.0', '1.2.3', '1.3.0', '2.0.0'] as const;
type Version = typeof VERSIONS[number];

const VERSION_COLOR: Record<Version, string> = {
  '1.0.0': '#94a3b8',
  '1.2.3': '#0ea5e9',
  '1.3.0': '#22c55e',
  '2.0.0': '#a21caf',
};

type Mode = 'AT_LEAST' | 'AT_LEAST_EXACT_MAJOR' | 'AT_LEAST_EXACT_MINOR' | 'EXACT';

const MODES: { id: Mode; label: string; constraint: string; matches: (v: Version, base: Version) => boolean }[] = [
  { id: 'AT_LEAST',              label: 'AT_LEAST',              constraint: '>= 1.2.3',
    matches: (v) => cmp(v, '1.2.3') >= 0 },
  { id: 'AT_LEAST_EXACT_MAJOR',  label: 'AT_LEAST_EXACT_MAJOR',  constraint: '>= 1.2.3, < 2.0.0',
    matches: (v) => cmp(v, '1.2.3') >= 0 && majorOf(v) === 1 },
  { id: 'AT_LEAST_EXACT_MINOR',  label: 'AT_LEAST_EXACT_MINOR',  constraint: '>= 1.2.3, < 1.3.0',
    matches: (v) => cmp(v, '1.2.3') >= 0 && majorOf(v) === 1 && minorOf(v) === 2 },
  { id: 'EXACT',                 label: 'EXACT',                 constraint: '= 1.2.3',
    matches: (v) => v === '1.2.3' },
];

interface Job { id: string; pinnedTo: Version; }
interface Pod { id: string; version: Version; inFlight: Job | null; }

const INITIAL: Pod[] = [
  { id: 'pod-1', version: '1.2.3', inFlight: null },
  { id: 'pod-2', version: '1.2.3', inFlight: null },
  { id: 'pod-3', version: '1.2.3', inFlight: null },
  { id: 'pod-4', version: '1.3.0', inFlight: null },
  { id: 'pod-5', version: '1.3.0', inFlight: null },
  { id: 'pod-6', version: '1.0.0', inFlight: null },
];

let jobSeq = 0;

export const VersioningSlide: React.FC<SlideProps> = ({ isActive }) => {
  const [pods, setPods] = useState<Pod[]>(INITIAL.map(p => ({ ...p })));
  const [modeId, setModeId] = useState<Mode>('AT_LEAST_EXACT_MAJOR');
  const [deploying, setDeploying] = useState(false);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());

  // Job auto-tick: every 1.6s, hand a fresh job to a random eligible
  // pod. Hand it the *current* selected version (max match of the mode).
  useEffect(() => {
    if (!isActive) return;
    const t = setInterval(() => {
      setPods(prev => {
        // resolve current selection against pods
        const mode = MODES.find(m => m.id === modeId)!;
        const eligibleVersions = VERSIONS.filter(v => mode.matches(v, '1.2.3'));
        if (eligibleVersions.length === 0) return prev;
        const pickV = eligibleVersions.reduce((a, b) => cmp(a, b) >= 0 ? a : b);
        const idle = prev.map((p, i) => ({ p, i }))
          .filter(({ p }) => p.inFlight === null && p.version === pickV);
        if (idle.length === 0) return prev;
        const pickIdx = idle[Math.floor(Math.random() * idle.length)].i;
        const next = [...prev];
        const job: Job = { id: `op-${(++jobSeq).toString(16)}`, pinnedTo: pickV };
        next[pickIdx] = { ...next[pickIdx], inFlight: job };
        return next;
      });
    }, 1600);
    return () => clearInterval(t);
  }, [isActive, modeId]);

  // Drain in-flight jobs at a slower cadence.
  useEffect(() => {
    if (!isActive) return;
    const t = setInterval(() => {
      setPods(prev => prev.map(p =>
        p.inFlight != null && Math.random() < 0.45 ? { ...p, inFlight: null } : p
      ));
    }, 2200);
    return () => clearInterval(t);
  }, [isActive]);

  // Rolling deploy: flip pods one at a time. In-flight jobs survive.
  const deploy = (target: Version) => {
    if (deploying) return;
    setDeploying(true);
    let i = 0;
    const step = () => {
      setPods(prev => {
        const next = [...prev];
        if (i < next.length) {
          // Only flip the version. If a job is in-flight, leave it pinned —
          // pinned_to does NOT change. The pod's version label flips, the
          // job's pinned_to (rendered on the pill) stays put.
          next[i] = { ...next[i], version: target };
          setHighlight(s => new Set(s).add(next[i].id));
          setTimeout(() => setHighlight(s => { const n = new Set(s); n.delete(next[i].id); return n; }), 700);
        }
        return next;
      });
      i++;
      if (i < pods.length) setTimeout(step, 1200);
      else setDeploying(false);
    };
    step();
  };

  const reset = () => {
    setDeploying(false);
    setPods(INITIAL.map(p => ({ ...p })));
  };

  const mode = MODES.find(m => m.id === modeId)!;
  const resolvedVersion = VERSIONS.filter(v => mode.matches(v, '1.2.3'))
    .reduce<Version | null>((a, b) => a === null ? b : cmp(a, b) >= 0 ? a : b, null);

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
          rolling deploy, in flight
          <span style={{ fontSize: 15, color: '#0ea5e9', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
            · the constraint decides who claims · the pin protects who's running
          </span>
        </motion.h2>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6, fontFamily: 'monospace' }}>
          new jobs are dropping every 1.6 s · pick a constraint, then deploy a new version and watch what happens
        </div>
      </div>

      {/* Top: constraint dial + controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr auto auto',
        gap: 14,
        padding: '14px 18px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontSize: 11, color: '#475569', fontFamily: 'monospace',
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800,
            marginBottom: 8,
          }}>
            client constraint
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MODES.map(m => {
              const on = m.id === modeId;
              return (
                <button
                  key={m.id}
                  onClick={() => setModeId(m.id)}
                  style={{
                    padding: '7px 12px',
                    background: on ? '#0ea5e9' : '#ffffff',
                    color: on ? '#ffffff' : '#0f172a',
                    border: on ? '2px solid #0ea5e9' : '1px solid #e2e8f0',
                    borderRadius: 7,
                    cursor: 'pointer',
                    fontFamily: 'monospace', fontSize: 11, fontWeight: 800,
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{
          padding: '12px 16px',
          background: '#0f172a', color: '#86efac',
          borderRadius: 8,
          fontFamily: 'monospace', fontSize: 13,
          textAlign: 'center', minWidth: 160,
        }}>
          <div style={{ color: '#94a3b8', fontSize: 10, marginBottom: 2 }}>
            resolves to
          </div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {resolvedVersion ?? '— none —'}
          </div>
          <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>
            {mode.constraint}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={() => deploy('2.0.0')}
            disabled={deploying}
            style={{
              padding: '9px 14px',
              background: deploying ? '#e2e8f0' : '#a21caf',
              color: deploying ? '#94a3b8' : '#ffffff',
              border: 'none', borderRadius: 8,
              fontFamily: 'monospace', fontSize: 12, fontWeight: 800,
              cursor: deploying ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ▶ deploy v2.0.0
          </button>
          <button
            onClick={reset}
            style={{
              padding: '7px 14px',
              background: 'transparent', color: '#475569',
              border: '1px solid #e2e8f0', borderRadius: 8,
              fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ↺ reset fleet
          </button>
        </div>
      </div>

      {/* Pod grid */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        gap: 12,
      }}>
        {pods.map(p => {
          const podColor = VERSION_COLOR[p.version];
          const eligible = mode.matches(p.version, '1.2.3');
          const highlit = highlight.has(p.id);
          return (
            <motion.div
              key={p.id}
              animate={{
                borderColor: highlit ? '#a21caf' : eligible ? podColor : '#e2e8f0',
                boxShadow: highlit ? '0 8px 24px #a21caf55' : 'none',
              }}
              style={{
                position: 'relative',
                padding: 14,
                background: '#ffffff',
                border: '2px solid',
                borderRadius: 10,
                display: 'flex', flexDirection: 'column', gap: 10,
                opacity: eligible ? 1 : 0.55,
                transition: 'opacity 0.3s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{
                  fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: '#0f172a',
                }}>
                  {p.id}
                </span>
                <motion.span
                  key={p.version}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  style={{
                    padding: '3px 8px',
                    background: podColor,
                    color: '#ffffff',
                    borderRadius: 4,
                    fontFamily: 'monospace', fontSize: 11, fontWeight: 800,
                  }}
                >
                  {p.version}
                </motion.span>
              </div>

              <div style={{
                fontSize: 10, color: eligible ? '#16a34a' : '#94a3b8',
                fontFamily: 'monospace', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {eligible ? '✓ can claim under current constraint' : '✗ not eligible right now'}
              </div>

              <div style={{
                flex: 1, minHeight: 50,
                background: '#f8fafc', borderRadius: 6,
                padding: 8,
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
              }}>
                <AnimatePresence mode="wait">
                  {p.inFlight ? (
                    <motion.div
                      key={p.inFlight.id}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{
                        padding: '6px 10px',
                        background: '#0f172a',
                        borderRadius: 999,
                        fontFamily: 'monospace', fontSize: 11,
                        color: '#86efac',
                      }}
                      title={`in-flight, pinned to ${p.inFlight.pinnedTo}`}
                    >
                      ▶ {p.inFlight.id}
                      <span style={{ color: VERSION_COLOR[p.inFlight.pinnedTo], marginLeft: 6 }}>
                        pinned {p.inFlight.pinnedTo}
                      </span>
                    </motion.div>
                  ) : (
                    <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                      idle
                    </span>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div style={{
        padding: '10px 16px',
        background: '#eff6ff',
        border: '1px solid #93c5fd',
        borderRadius: 10,
        fontSize: 13, color: '#1e3a8a', display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <span style={{ fontSize: 16 }}>📌</span>
        <span>
          Notice: when you deploy v2.0.0, the pinned versions on in-flight jobs <strong>don't change</strong> —
          but eligibility for new claims does. That's how rolling deploys stay correct.
        </span>
      </div>
    </div>
  );
};

// ─── semver helpers ─────────────────────────────────────────────────

function parts(v: Version): [number, number, number] {
  const [a, b, c] = v.split('.').map(n => parseInt(n, 10));
  return [a, b, c];
}
function cmp(a: Version, b: Version): number {
  const [a1, a2, a3] = parts(a);
  const [b1, b2, b3] = parts(b);
  return (a1 - b1) || (a2 - b2) || (a3 - b3);
}
function majorOf(v: Version): number { return parts(v)[0]; }
function minorOf(v: Version): number { return parts(v)[1]; }
