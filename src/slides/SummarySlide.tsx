import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';

/**
 * "If you remember one thing."
 *
 * The audience just sat through 13 slides. We don't reward them with
 * another 6-card grid. We give them one sentence, written one phrase
 * at a time, and then four anchors they can take a picture of.
 *
 * The sentence is the thesis. The anchors are the receipts.
 */

const SENTENCE: { phrase: string; color: string }[] = [
  { phrase: 'one Postgres database',          color: '#06b6d4' },
  { phrase: 'one Go library',                 color: '#3b82f6' },
  { phrase: 'three files per service',        color: '#8b5cf6' },
  { phrase: 'no new infrastructure',          color: '#22c55e' },
  { phrase: 'durable, versioned, observable.',color: '#0f172a' },
];

interface Anchor {
  label: string;
  bigValue: string;
  detail: string;
  color: string;
}

const ANCHORS: Anchor[] = [
  {
    label: 'where state lives',
    bigValue: 'workitems_active / _inactive',
    detail: 'Two Postgres tables. That is the whole runtime. No Redis, no Kafka, no Temporal cluster.',
    color: '#06b6d4',
  },
  {
    label: 'why it survives crashes',
    bigValue: 'FOR UPDATE SKIP LOCKED',
    detail: 'Postgres hands each job to exactly one worker. Heartbeats keep the claim alive; if a worker dies, the claim lapses and another worker picks it up.',
    color: '#f43f5e',
  },
  {
    label: 'why rolling deploys are safe',
    bigValue: 'version pinned at enqueue',
    detail: 'The semver the work was submitted under is stored on the row. In-flight jobs never silently jump to a newer model.',
    color: '#0ea5e9',
  },
  {
    label: 'how fast you ship a new service',
    bigValue: 'one yaml → dsflow generate',
    detail: 'Three files of business logic. The rest — claim loop, heartbeat, GC, metrics — is generated and lives in the framework.',
    color: '#a21caf',
  },
];

export const SummarySlide: React.FC<SlideProps> = ({ isActive }) => {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!isActive) { setRevealed(0); return; }
    let i = 0;
    const t = setInterval(() => {
      i++;
      setRevealed(i);
      if (i >= SENTENCE.length) clearInterval(t);
    }, 650);
    return () => clearInterval(t);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', padding: '32px 32px', gap: 22,
    }}>
      <div>
        <motion.h2
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0 }}
        >
          if you remember one thing
          <span style={{ fontSize: 14, color: '#475569', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
            · the whole deck in one sentence
          </span>
        </motion.h2>
      </div>

      {/* The thesis sentence — revealed phrase by phrase */}
      <div style={{
        padding: '36px 32px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        textAlign: 'center',
        minHeight: 130,
      }}>
        <div style={{
          fontSize: 32,
          fontWeight: 700,
          color: '#0f172a',
          lineHeight: 1.5,
          fontFamily: 'monospace',
        }}>
          {SENTENCE.map((p, i) => (
            <React.Fragment key={i}>
              <AnimatePresence>
                {i < revealed && (
                  <motion.span
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{ color: p.color }}
                  >
                    {p.phrase}
                  </motion.span>
                )}
              </AnimatePresence>
              {i < SENTENCE.length - 1 && i < revealed && (
                <span style={{ color: '#94a3b8', margin: '0 12px' }}>·</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Four anchors — receipts for the thesis */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        gap: 14,
      }}>
        {ANCHORS.map((a, i) => (
          <motion.div
            key={a.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: SENTENCE.length * 0.65 + i * 0.1 }}
            style={{
              padding: '18px 22px',
              background: '#ffffff',
              border: `1px solid ${a.color}30`,
              borderLeft: `4px solid ${a.color}`,
              borderRadius: 10,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}
          >
            <div style={{
              fontSize: 11, color: '#475569',
              fontFamily: 'monospace', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {a.label}
            </div>
            <div style={{
              fontSize: 20,
              fontFamily: 'monospace',
              color: a.color,
              fontWeight: 800,
            }}>
              {a.bigValue}
            </div>
            <div style={{
              fontSize: 13, color: '#334155', lineHeight: 1.55,
            }}>
              {a.detail}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: SENTENCE.length * 0.65 + ANCHORS.length * 0.1 + 0.4 }}
        style={{
          display: 'flex', gap: 10, alignItems: 'center',
          padding: '12px 18px',
          background: '#0f172a',
          color: '#e2e8f0',
          borderRadius: 10,
          fontFamily: 'monospace', fontSize: 13,
        }}
      >
        <span style={{ color: '#86efac' }}>$</span>
        <span style={{ color: '#fde68a' }}>go get</span>
        <span>github.com/.../postgres-lro</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
          questions? grab me after.
        </span>
      </motion.div>
    </div>
  );
};
