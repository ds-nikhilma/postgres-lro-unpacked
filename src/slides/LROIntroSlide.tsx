import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';

/**
 * A two-pane slide: the formal LRO definition on the left, and a guided
 * restaurant analogy on the right. The analogy auto-advances through
 * 5 steps when the user clicks "play"; otherwise the presenter steps
 * through it manually.
 */

interface Step {
  caption: string;
  pos: 'order' | 'wait-pager' | 'pager-buzz' | 'pickup';
  pagerLit: boolean;
  noisy: boolean;
}

const STEPS: Step[] = [
  {
    caption: 'You order a coffee at the counter. The barista hands you a buzzer with a number on it.',
    pos: 'order',
    pagerLit: false,
    noisy: false,
  },
  {
    caption: 'You go sit down. The counter is free to take the next order. The kitchen starts your drink in the background.',
    pos: 'wait-pager',
    pagerLit: false,
    noisy: false,
  },
  {
    caption: 'Every so often, you glance at the buzzer to see if it has lit up. (That is your polling loop.)',
    pos: 'wait-pager',
    pagerLit: false,
    noisy: false,
  },
  {
    caption: 'The buzzer lights up and vibrates. Your order is ready.',
    pos: 'pager-buzz',
    pagerLit: true,
    noisy: true,
  },
  {
    caption: 'You walk back, show the buzzer number, and pick up your coffee.',
    pos: 'pickup',
    pagerLit: true,
    noisy: false,
  },
];

export const LROIntroSlide: React.FC<SlideProps> = ({ isActive }) => {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!isActive || !playing) return;
    if (step >= STEPS.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep(s => s + 1), 2600);
    return () => clearTimeout(t);
  }, [isActive, playing, step]);

  useEffect(() => {
    if (!isActive) { setStep(0); setPlaying(false); }
  }, [isActive]);

  if (!isActive) return null;

  const s = STEPS[step];

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
          what is a Long-Running Operation?
          <span style={{ fontSize: 15, color: '#06b6d4', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
            · the API pattern, and the analogy
          </span>
        </motion.h2>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6, fontFamily: 'monospace' }}>
          formal definition on the left · the same idea in plain English on the right
        </div>
      </div>

      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 14,
        minHeight: 0,
      }}>
        {/* Left: definition */}
        <div style={{
          background: '#f8fafc', borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: '20px 24px',
          display: 'flex', flexDirection: 'column', gap: 18,
          overflow: 'auto',
        }}>
          <div>
            <div style={{
              fontSize: 12, color: '#06b6d4', fontWeight: 800,
              fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: 6,
            }}>
              definition
            </div>
            <div style={{ fontSize: 17, color: '#0f172a', lineHeight: 1.55 }}>
              An <strong>LRO</strong> is an API pattern for operations that take longer than a single
              HTTP round-trip can hold open — typically anything <strong>&gt; 10 s</strong>.
              The server returns immediately with an
              {' '}<span style={{
                fontFamily: 'monospace', background: '#06b6d420', color: '#0e7490',
                padding: '1px 6px', borderRadius: 4,
              }}>operation id</span> instead of a result. The client polls that id until the operation
              reaches a terminal state.
            </div>
          </div>

          <div>
            <div style={{
              fontSize: 12, color: '#475569', fontWeight: 800,
              fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: 8,
            }}>
              shape of the API
            </div>
            <div style={{
              background: '#0f172a', color: '#e2e8f0', borderRadius: 10,
              padding: '14px 16px', fontFamily: 'monospace', fontSize: 13.5,
              lineHeight: 1.7,
            }}>
              <div><span style={{ color: '#67e8f9' }}>POST</span> /jobs           <span style={{ color: '#6b7280' }}>{'// returns operation_id'}</span></div>
              <div><span style={{ color: '#67e8f9' }}>GET</span>  /jobs/&lt;id&gt;     <span style={{ color: '#6b7280' }}>{'// returns status + maybe result'}</span></div>
              <div><span style={{ color: '#67e8f9' }}>POST</span> /jobs/&lt;id&gt;:cancel</div>
            </div>
          </div>

          <div>
            <div style={{
              fontSize: 12, color: '#475569', fontWeight: 800,
              fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: 8,
            }}>
              when you need it
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 15, color: '#334155', lineHeight: 1.75 }}>
              <li>AI / ML inference — 30 s to 5 min per request</li>
              <li>Video & image processing pipelines</li>
              <li>Batch jobs, exports, and report generation</li>
              <li>Any task whose duration is bigger than a load-balancer timeout</li>
            </ul>
          </div>
        </div>

        {/* Right: restaurant analogy */}
        <div style={{
          background: '#fff', borderRadius: 12,
          border: '1px solid #06b6d440',
          padding: '20px 24px',
          display: 'flex', flexDirection: 'column', gap: 14,
          minHeight: 0,
        }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          }}>
            <div style={{
              fontSize: 12, color: '#06b6d4', fontWeight: 800,
              fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              analogy · café with a buzzer
            </div>
            <div style={{
              fontSize: 12, color: '#475569', fontFamily: 'monospace',
            }}>
              step {step + 1} / {STEPS.length}
            </div>
          </div>

          {/* Scene */}
          <div style={{
            flex: 1,
            position: 'relative',
            background: 'linear-gradient(180deg, #fef3c7 0%, #fffbeb 60%, #ffffff 100%)',
            borderRadius: 10,
            border: '1px solid #fde68a',
            overflow: 'hidden',
            minHeight: 260,
          }}>
            {/* Counter */}
            <div style={{
              position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
              width: '70%', height: 28, background: '#92400e', borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff7ed', fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
            }}>
              ☕ counter / kitchen
            </div>
            {/* Table */}
            <div style={{
              position: 'absolute', bottom: 30, right: 30,
              width: 70, height: 50, background: '#fef3c7',
              border: '2px solid #d97706', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              🪑
            </div>

            {/* Customer (animated position) */}
            <motion.div
              animate={{
                left:
                  s.pos === 'order'        ? '20%' :
                  s.pos === 'wait-pager'   ? '70%' :
                  s.pos === 'pager-buzz'   ? '70%' :
                                             '30%',
                top:
                  s.pos === 'order'        ? 70 :
                  s.pos === 'wait-pager'   ? 150 :
                  s.pos === 'pager-buzz'   ? 150 :
                                             100,
              }}
              transition={{ type: 'spring', stiffness: 80, damping: 18 }}
              style={{
                position: 'absolute',
                width: 56, height: 56,
                background: '#ffffff',
                border: '2px solid #0f172a',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28,
                boxShadow: '0 4px 14px rgba(15,23,42,0.18)',
              }}
            >
              🧑
            </motion.div>

            {/* Pager (follows customer when sitting/pickup, glows when buzzing) */}
            <motion.div
              animate={{
                left:
                  s.pos === 'order'        ? '32%' :
                  s.pos === 'wait-pager'   ? '76%' :
                  s.pos === 'pager-buzz'   ? '76%' :
                                             '36%',
                top:
                  s.pos === 'order'        ? 130 :
                  s.pos === 'wait-pager'   ? 215 :
                  s.pos === 'pager-buzz'   ? 215 :
                                             150,
                scale: s.noisy ? [1, 1.18, 1] : 1,
              }}
              transition={
                s.noisy
                  ? { scale: { duration: 0.6, repeat: Infinity }, default: { type: 'spring', stiffness: 80, damping: 18 } }
                  : { type: 'spring', stiffness: 80, damping: 18 }
              }
              style={{
                position: 'absolute',
                width: 44, height: 44, borderRadius: 8,
                background: s.pagerLit ? '#fef08a' : '#e2e8f0',
                border: `2px solid ${s.pagerLit ? '#facc15' : '#94a3b8'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
                boxShadow: s.pagerLit ? '0 0 24px #fde047' : 'none',
              }}
            >
              {s.pagerLit ? '🔔' : '📳'}
            </motion.div>

            {/* Caption */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                style={{
                  position: 'absolute',
                  left: 12, right: 12, top: 6,
                  background: 'rgba(15,23,42,0.85)',
                  color: '#f1f5f9',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 13.5,
                  lineHeight: 1.4,
                  fontWeight: 500,
                  backdropFilter: 'blur(6px)',
                }}
              >
                {s.caption}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Mapping legend */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            fontSize: 12,
            fontFamily: 'monospace',
          }}>
            <div style={{ padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, color: '#334155' }}>
              <strong>buzzer number</strong> = operation id
            </div>
            <div style={{ padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, color: '#334155' }}>
              <strong>glancing at it</strong> = polling
            </div>
            <div style={{ padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, color: '#334155' }}>
              <strong>kitchen</strong> = worker pool
            </div>
            <div style={{ padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, color: '#334155' }}>
              <strong>buzz</strong> = status flips to <em>done</em>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => { setStep(0); setPlaying(true); }}
              style={{
                padding: '8px 16px',
                background: '#06b6d4', color: '#fff',
                border: 'none', borderRadius: 8,
                cursor: 'pointer', fontFamily: 'monospace',
                fontSize: 13, fontWeight: 700,
              }}
            >
              ▶ play
            </button>
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              style={{
                padding: '8px 12px',
                background: '#ffffff', color: '#334155',
                border: '1px solid #e2e8f0', borderRadius: 8,
                cursor: step === 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
                opacity: step === 0 ? 0.4 : 1,
              }}
            >
              ◀ prev
            </button>
            <button
              onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              disabled={step === STEPS.length - 1}
              style={{
                padding: '8px 12px',
                background: '#ffffff', color: '#334155',
                border: '1px solid #e2e8f0', borderRadius: 8,
                cursor: step === STEPS.length - 1 ? 'not-allowed' : 'pointer',
                fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
                opacity: step === STEPS.length - 1 ? 0.4 : 1,
              }}
            >
              next ▶
            </button>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => { setStep(0); setPlaying(false); }}
              style={{
                padding: '8px 12px',
                background: 'transparent', color: '#475569',
                border: '1px solid #e2e8f0', borderRadius: 8,
                cursor: 'pointer', fontFamily: 'monospace',
                fontSize: 12, fontWeight: 700,
              }}
            >
              ↺ reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
