import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';

/**
 * "What is an LRO?" — shown as a *contract*, not an analogy.
 *
 * Left:  the three API calls (Submit, Poll, Cancel) drawn as actual
 *        request/response pairs with a tiny sketch of payload shape.
 * Right: a live message log between Client and Server, advancing in
 *        time. Each entry is the literal call + reply. Watch the
 *        client poll and the server flip from running to done.
 *
 * The audience sees the *protocol*, not a metaphor. No restaurant,
 * no café, no buzzer.
 */

interface LogEntry {
  t: string;
  from: 'client' | 'server';
  body: string;
  flavor: 'submit' | 'poll-running' | 'poll-done' | 'cancel' | 'note';
}

const FLAVOR_COLOR: Record<LogEntry['flavor'], string> = {
  submit:        '#22c55e',
  'poll-running':'#fbbf24',
  'poll-done':   '#22c55e',
  cancel:        '#ef4444',
  note:          '#94a3b8',
};

// Scripted message log — replayed step-by-step. Times are simulated
// seconds since submit (00:00).
const SCRIPT: LogEntry[] = [
  { t: '00:00.000', from: 'client', body: 'POST /jobs { input: "cbct-1234" }',
    flavor: 'submit' },
  { t: '00:00.080', from: 'server', body: '202 Accepted → { op_id: "op-a1b2", done: false }',
    flavor: 'submit' },
  { t: '00:30.000', from: 'client', body: 'GET /jobs/op-a1b2',
    flavor: 'poll-running' },
  { t: '00:30.010', from: 'server', body: '200 OK → { op_id: "op-a1b2", done: false }',
    flavor: 'poll-running' },
  { t: '01:00.000', from: 'client', body: 'GET /jobs/op-a1b2',
    flavor: 'poll-running' },
  { t: '01:00.012', from: 'server', body: '200 OK → { op_id: "op-a1b2", done: false }',
    flavor: 'poll-running' },
  { t: '01:30.000', from: 'client', body: 'GET /jobs/op-a1b2',
    flavor: 'poll-running' },
  { t: '01:30.011', from: 'server', body: '200 OK → { op_id: "op-a1b2", done: false }',
    flavor: 'poll-running' },
  { t: '02:00.000', from: 'client', body: 'GET /jobs/op-a1b2',
    flavor: 'poll-done' },
  { t: '02:00.014', from: 'server', body: '200 OK → { op_id: "op-a1b2", done: true, result: {…} }',
    flavor: 'poll-done' },
  { t: '02:00.014', from: 'server', body: '↑ same shape, just one field flipped',
    flavor: 'note' },
];

type Verb = 'submit' | 'poll' | 'cancel';

const VERB_META: Record<Verb, { method: string; path: string; color: string; intent: string }> = {
  submit: { method: 'POST',   path: '/jobs',                color: '#22c55e',
    intent: 'kicks off work · returns an op_id immediately' },
  poll:   { method: 'GET',    path: '/jobs/{op_id}',        color: '#fbbf24',
    intent: 'asks "is it done yet?" · cheap, idempotent' },
  cancel: { method: 'DELETE', path: '/jobs/{op_id}',        color: '#ef4444',
    intent: 'gives up · server marks it canceled' },
};

export const LROIntroSlide: React.FC<SlideProps> = ({ isActive }) => {
  const [hoveredVerb, setHoveredVerb] = useState<Verb>('submit');
  const [step, setStep] = useState(0);          // how many script lines played
  const [playing, setPlaying] = useState(false);
  const stepRef = useRef(0);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    if (!isActive) { setStep(0); setPlaying(false); }
  }, [isActive]);

  useEffect(() => {
    if (!playing) return;
    if (stepRef.current >= SCRIPT.length) { setPlaying(false); return; }
    const t = setTimeout(() => {
      setStep(s => s + 1);
    }, 700);
    return () => clearTimeout(t);
  }, [playing, step]);

  const play = () => {
    setStep(0);
    // Defer to next tick so step=0 is applied first.
    requestAnimationFrame(() => setPlaying(true));
  };

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
          what an LRO actually is
          <span style={{ fontSize: 15, color: '#06b6d4', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
            · three calls, not one
          </span>
        </motion.h2>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6, fontFamily: 'monospace' }}>
          a contract, not a metaphor · hover a verb to see what it does · press play to watch a real exchange
        </div>
      </div>

      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '1fr 1.15fr',
        gap: 14,
      }}>
        {/* Left: the three verbs */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 12,
          padding: 18,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          minHeight: 0,
        }}>
          <div style={{
            fontSize: 11, color: '#475569', fontFamily: 'monospace',
            textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800,
          }}>
            the three verbs
          </div>
          {(Object.keys(VERB_META) as Verb[]).map(v => {
            const meta = VERB_META[v];
            const on = v === hoveredVerb;
            return (
              <motion.div
                key={v}
                onMouseEnter={() => setHoveredVerb(v)}
                onClick={() => setHoveredVerb(v)}
                whileHover={{ y: -1 }}
                animate={{
                  borderColor: on ? meta.color : '#e2e8f0',
                  boxShadow: on ? `0 6px 18px ${meta.color}22` : 'none',
                }}
                style={{
                  padding: '14px 16px',
                  background: '#ffffff',
                  borderRadius: 10,
                  border: '2px solid',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{
                    padding: '2px 8px',
                    background: meta.color,
                    color: '#ffffff',
                    borderRadius: 4,
                    fontFamily: 'monospace', fontSize: 12, fontWeight: 800,
                  }}>
                    {meta.method}
                  </span>
                  <span style={{
                    fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#0f172a',
                  }}>
                    {meta.path}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  {meta.intent}
                </div>
              </motion.div>
            );
          })}

          {/* Quick contract callout */}
          <div style={{
            marginTop: 'auto',
            padding: '12px 14px',
            background: '#ecfeff',
            border: '1px solid #67e8f9',
            borderRadius: 8,
            fontSize: 13, color: '#155e75', lineHeight: 1.5,
          }}>
            <strong>The contract:</strong> the server can take as long as it wants. The client
            decides how often to come back. The only shared state is the <code>op_id</code>.
          </div>
        </div>

        {/* Right: live exchange log */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          minHeight: 0,
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid #1e293b',
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: 'monospace', fontSize: 12, color: '#94a3b8',
          }}>
            <span style={{ color: '#22c55e' }}>●</span>
            client ↔ server · live exchange
            <span style={{ marginLeft: 'auto' }}>{step}/{SCRIPT.length} lines</span>
          </div>
          <div style={{
            flex: 1, overflow: 'auto', padding: '14px 16px',
            fontFamily: 'monospace', fontSize: 13.5, lineHeight: 1.7,
          }}>
            {SCRIPT.slice(0, step).map((e, i) => {
              const color = FLAVOR_COLOR[e.flavor];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '70px 70px 1fr',
                    gap: 10,
                    paddingBottom: 4,
                  }}
                >
                  <span style={{ color: '#64748b' }}>{e.t}</span>
                  <span style={{
                    color: e.from === 'client' ? '#a7f3d0' : '#bae6fd',
                    textTransform: 'uppercase', fontWeight: 700,
                  }}>
                    {e.from === 'client' ? 'client →' : '← server'}
                  </span>
                  <span style={{ color: e.flavor === 'note' ? '#94a3b8' : color, fontStyle: e.flavor === 'note' ? 'italic' : 'normal' }}>
                    {e.body}
                  </span>
                </motion.div>
              );
            })}
            {step === 0 && (
              <div style={{ color: '#475569', fontStyle: 'italic' }}>
                {'// press play to watch a real exchange'}
              </div>
            )}
          </div>
          <div style={{
            padding: 10, borderTop: '1px solid #1e293b',
            display: 'flex', gap: 8,
          }}>
            <button
              onClick={play}
              disabled={playing}
              style={{
                padding: '7px 14px',
                background: playing ? '#1e293b' : '#06b6d4',
                color: playing ? '#475569' : '#ffffff',
                border: 'none', borderRadius: 6,
                fontFamily: 'monospace', fontSize: 12, fontWeight: 800,
                cursor: playing ? 'not-allowed' : 'pointer',
              }}
            >
              ▶ play
            </button>
            <button
              onClick={() => { setStep(0); setPlaying(false); }}
              style={{
                padding: '7px 12px',
                background: 'transparent', color: '#94a3b8',
                border: '1px solid #334155', borderRadius: 6,
                fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ↺ reset
            </button>
            <div style={{ flex: 1 }} />
            <AnimatePresence>
              {step >= SCRIPT.length && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    fontSize: 12, fontFamily: 'monospace',
                    color: '#86efac', fontWeight: 700,
                  }}
                >
                  ✓ same response shape on every poll · just a flag and a body
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
