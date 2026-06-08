import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';

/**
 * The problem, shown not told.
 *
 * Two parallel timelines tick in real-time (1 second of wall clock =
 * 12 seconds of simulated work):
 *
 *   - "Without postgres-lro": HTTP request goes out, the connection
 *     sits open while the work runs, the gateway times out at 60 s,
 *     the work *still finishes in the background* (server doesn't know
 *     the client gave up), the result is dropped on the floor. Client
 *     sees an error.
 *
 *   - "With postgres-lro": submit returns in 80 ms with an operation
 *     handle. The connection closes. The client polls every few
 *     seconds. The work runs at its own pace. At t≈4 min the poll
 *     comes back with the result.
 *
 * No bullet-point cards. No category labels. The whole point is to
 * watch one fail and one succeed on the same time axis.
 */

const SIMULATED_TOTAL_S = 240;      // 4 minutes of "real" work
const PLAYBACK_S = 20;               // we replay it in 20s
const GATEWAY_TIMEOUT_S = 60;
const POLL_INTERVAL_S = 30;
const SUBMIT_LATENCY_S = 0.08;

type LaneId = 'without' | 'with';

interface BarSegment {
  lane: LaneId;
  startS: number;
  endS: number;
  kind: 'connection' | 'work' | 'background' | 'poll' | 'idle';
  color: string;
  label?: string;
}

const SEGMENTS: BarSegment[] = [
  // ── Without postgres-lro ─────────────────────────────────────────────
  // One long-held HTTP connection from t=0 until the gateway kills it.
  { lane: 'without', startS: 0, endS: GATEWAY_TIMEOUT_S, kind: 'connection',
    color: '#3b82f6', label: 'HTTP connection held open' },
  // Server-side work keeps running even after the gateway timeout.
  { lane: 'without', startS: 0, endS: SIMULATED_TOTAL_S, kind: 'work',
    color: '#f59e0b', label: 'work running on server' },
  // After the gateway times out, the server is still computing —
  // but the client connection is gone. Result is dropped.
  { lane: 'without', startS: GATEWAY_TIMEOUT_S, endS: SIMULATED_TOTAL_S, kind: 'background',
    color: '#94a3b8', label: 'connection gone — result orphaned' },

  // ── With postgres-lro ────────────────────────────────────────────────
  // Submit returns in 80ms with an op handle.
  { lane: 'with', startS: 0, endS: SUBMIT_LATENCY_S, kind: 'connection',
    color: '#22c55e', label: 'POST /jobs → returns op_id' },
  // Work runs in the background.
  { lane: 'with', startS: SUBMIT_LATENCY_S, endS: SIMULATED_TOTAL_S, kind: 'work',
    color: '#3b82f6', label: 'worker processes the job' },
];

// Client polls every POLL_INTERVAL_S after submission. We render each
// poll as a tiny vertical tick so the audience sees the rhythm.
const POLL_TICKS: number[] = (() => {
  const out: number[] = [];
  for (let t = POLL_INTERVAL_S; t < SIMULATED_TOTAL_S; t += POLL_INTERVAL_S) out.push(t);
  return out;
})();

const TIMELINE_HEIGHT = 60;

export const ProblemSlide: React.FC<SlideProps> = ({ isActive }) => {
  const [playing, setPlaying] = useState(false);
  const [tSim, setTSim] = useState(0);             // simulated seconds elapsed
  const startedAt = useRef<number | null>(null);
  const lastFrame = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) { setPlaying(false); setTSim(0); startedAt.current = null; }
  }, [isActive]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = (now: number) => {
      if (startedAt.current == null) startedAt.current = now;
      const elapsedMs = now - startedAt.current;
      const sim = Math.min(SIMULATED_TOTAL_S, (elapsedMs / 1000) * (SIMULATED_TOTAL_S / PLAYBACK_S));
      setTSim(sim);
      lastFrame.current = now;
      if (sim < SIMULATED_TOTAL_S) raf = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const play = () => {
    startedAt.current = null;
    setTSim(0);
    setPlaying(true);
  };
  const reset = () => {
    setPlaying(false);
    startedAt.current = null;
    setTSim(0);
  };

  // Headline that flips depending on what the audience is looking at.
  const phase: 'idle' | 'before-timeout' | 'after-timeout' | 'done' =
    tSim === 0                       ? 'idle' :
    tSim < GATEWAY_TIMEOUT_S         ? 'before-timeout' :
    tSim < SIMULATED_TOTAL_S         ? 'after-timeout' :
                                       'done';

  const headline = {
    idle:            { withoutClaim: 'a 4-minute job is about to start',     withClaim: 'a 4-minute job is about to start' },
    'before-timeout':{ withoutClaim: 'browser is waiting on the connection', withClaim: 'client already has the op handle' },
    'after-timeout': { withoutClaim: '504 Gateway Timeout · result orphaned',withClaim: 'client polls every 30 s · work continues' },
    done:            { withoutClaim: 'client never got a result',             withClaim: 'final poll returns the completed op' },
  }[phase];

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
          a 4-minute request, two ways
          <span style={{ fontSize: 15, color: '#f59e0b', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
            · why HTTP alone isn't enough
          </span>
        </motion.h2>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6, fontFamily: 'monospace' }}>
          press <span style={kbd}>play</span> · 20 seconds of playback = 4 minutes of real time
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', background: '#f8fafc',
        border: '1px solid #e2e8f0', borderRadius: 10,
      }}>
        <button
          onClick={play}
          disabled={playing}
          style={{
            padding: '9px 18px',
            background: playing ? '#e2e8f0' : '#f59e0b',
            color: playing ? '#94a3b8' : '#ffffff',
            border: 'none', borderRadius: 8,
            fontFamily: 'monospace', fontSize: 13, fontWeight: 800,
            cursor: playing ? 'not-allowed' : 'pointer',
          }}
        >
          ▶ play
        </button>
        <button
          onClick={reset}
          style={{
            padding: '9px 14px',
            background: '#ffffff', color: '#475569',
            border: '1px solid #e2e8f0', borderRadius: 8,
            fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ↺ reset
        </button>
        <div style={{ flex: 1 }} />
        <div style={{
          fontSize: 13, fontFamily: 'monospace', color: '#0f172a',
        }}>
          t = <strong style={{ color: '#f59e0b' }}>{fmtClock(tSim)}</strong> / 04:00
        </div>
      </div>

      {/* Timelines */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column', gap: 18,
        padding: 20, paddingTop: 24,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
      }}>
        <Lane
          title="WITHOUT postgres-lro"
          subtitle={headline.withoutClaim}
          subtitleColor={phase === 'after-timeout' || phase === 'done' ? '#dc2626' : '#475569'}
          tSim={tSim}
          renderBar={() => (
            <>
              {SEGMENTS.filter(s => s.lane === 'without').map((s, i) => (
                <BarSegmentView key={i} seg={s} tSim={tSim} />
              ))}
              {/* Gateway timeout marker */}
              <Marker
                xPct={(GATEWAY_TIMEOUT_S / SIMULATED_TOTAL_S) * 100}
                color="#ef4444"
                label="gateway 504"
                visible={tSim >= GATEWAY_TIMEOUT_S * 0.95}
              />
            </>
          )}
        />

        <Lane
          title="WITH postgres-lro"
          subtitle={headline.withClaim}
          subtitleColor={phase === 'done' ? '#16a34a' : '#475569'}
          tSim={tSim}
          renderBar={() => (
            <>
              {SEGMENTS.filter(s => s.lane === 'with').map((s, i) => (
                <BarSegmentView key={i} seg={s} tSim={tSim} />
              ))}
              {POLL_TICKS.map(t => (
                <PollTick key={t} tSec={t} visible={tSim >= t} />
              ))}
              {/* Completion marker */}
              <Marker
                xPct={100}
                color="#22c55e"
                label="result"
                visible={tSim >= SIMULATED_TOTAL_S - 0.5}
              />
            </>
          )}
        />

        {/* Axis labels */}
        <div style={{
          position: 'relative', height: 16, marginTop: -6,
          fontFamily: 'monospace', fontSize: 11, color: '#94a3b8',
        }}>
          {[0, 60, 120, 180, 240].map(s => (
            <div key={s} style={{
              position: 'absolute',
              left: `${(s / SIMULATED_TOTAL_S) * 100}%`,
              transform: 'translateX(-50%)',
            }}>
              {fmtClock(s)}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom takeaway — appears only when playback is done */}
      <AnimatePresence>
        {phase === 'done' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '12px 18px',
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: 10,
              fontSize: 14, color: '#78350f', fontWeight: 600,
              display: 'flex', gap: 10, alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 18 }}>🧰</span>
            postgres-lro fixes the picture by separating <strong>three short calls</strong>
            (submit · poll · cancel) from <strong>one long task</strong>. The connection lifetime no
            longer caps the work duration.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────

const kbd: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px', margin: '0 2px',
  fontSize: 11, fontFamily: 'monospace',
  background: '#ffffff', border: '1px solid #e2e8f0',
  borderRadius: 4, color: '#475569',
};

interface LaneProps {
  title: string;
  subtitle: string;
  subtitleColor: string;
  tSim: number;
  renderBar: () => React.ReactNode;
}

const Lane: React.FC<LaneProps> = ({ title, subtitle, renderBar, subtitleColor }) => (
  <div>
    <div style={{
      display: 'flex', alignItems: 'baseline',
      gap: 14, marginBottom: 8,
    }}>
      <div style={{
        fontFamily: 'monospace', fontSize: 13, fontWeight: 800,
        color: '#0f172a', letterSpacing: '0.04em',
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 13, color: subtitleColor, fontWeight: 600, fontStyle: 'italic',
      }}>
        {subtitle}
      </div>
    </div>
    <div style={{
      position: 'relative',
      height: TIMELINE_HEIGHT,
      background: '#f8fafc',
      borderRadius: 8,
      border: '1px solid #e2e8f0',
      overflow: 'visible',
    }}>
      {renderBar()}
    </div>
  </div>
);

const BarSegmentView: React.FC<{ seg: BarSegment; tSim: number }> = ({ seg, tSim }) => {
  const visibleEnd = Math.min(tSim, seg.endS);
  if (visibleEnd <= seg.startS) return null;
  const leftPct = (seg.startS / SIMULATED_TOTAL_S) * 100;
  const widthPct = ((visibleEnd - seg.startS) / SIMULATED_TOTAL_S) * 100;
  const top =
    seg.kind === 'connection' ? 6 :
    seg.kind === 'background' ? 38 :
    seg.kind === 'work'       ? 22 :
                                22;
  const height =
    seg.kind === 'connection' ? 14 :
    seg.kind === 'background' ? 14 :
    seg.kind === 'work'       ? 14 :
                                14;
  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        top, height,
        background: seg.color,
        borderRadius: 4,
        opacity: seg.kind === 'background' ? 0.55 : 1,
        backgroundImage:
          seg.kind === 'background'
            ? 'repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,0.18) 4px 7px)'
            : undefined,
      }}
      title={seg.label}
    />
  );
};

const PollTick: React.FC<{ tSec: number; visible: boolean }> = ({ tSec, visible }) => {
  if (!visible) return null;
  return (
    <motion.div
      initial={{ scaleY: 0, opacity: 0 }}
      animate={{ scaleY: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'absolute',
        left: `${(tSec / SIMULATED_TOTAL_S) * 100}%`,
        top: 2, bottom: 2,
        width: 2,
        background: '#22c55e',
        transformOrigin: 'top',
      }}
      title={`poll at ${fmtClock(tSec)}`}
    />
  );
};

const Marker: React.FC<{ xPct: number; color: string; label: string; visible: boolean }> = ({ xPct, color, label, visible }) => {
  if (!visible) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        position: 'absolute',
        left: `${xPct}%`,
        top: -22,
        transform: 'translateX(-50%)',
        fontFamily: 'monospace', fontSize: 11, fontWeight: 800,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      ▼ {label}
    </motion.div>
  );
};

function fmtClock(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
