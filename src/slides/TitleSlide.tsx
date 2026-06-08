import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SlideProps } from '../types';

/**
 * Cover slide. Two things only:
 *   1. The wordmark — postgres-lro · unpacked
 *   2. A live "pulse" panel that previews the rhythm of the deck —
 *      a stream of status pills (queued → running → done) ticking past,
 *      so the moment the audience walks in they already see *what kind
 *      of thing* this is: a queue of jobs flowing through statuses.
 *
 * Deliberately quiet. No tagline jargon, no nav hint banner. Just a
 * cover that sets the mood.
 */

type Status = 'queued' | 'running' | 'done' | 'failed';

const STATUS_META: Record<Status, { color: string; label: string }> = {
  queued:  { color: '#fbbf24', label: 'queued'  },
  running: { color: '#3b82f6', label: 'running' },
  done:    { color: '#22c55e', label: 'done'    },
  failed:  { color: '#ef4444', label: 'failed'  },
};

// What a healthy fleet looks like at any moment — most jobs are done,
// some are running, a few are queued, the occasional failure.
const STATUS_WEIGHTS: Array<{ s: Status; w: number }> = [
  { s: 'done',    w: 80 },
  { s: 'running', w: 12 },
  { s: 'queued',  w:  5 },
  { s: 'failed',  w:  3 },
];

function pickStatus(seed: number): Status {
  const total = STATUS_WEIGHTS.reduce((a, b) => a + b.w, 0);
  let r = seed % total;
  for (const e of STATUS_WEIGHTS) {
    if (r < e.w) return e.s;
    r -= e.w;
  }
  return 'done';
}

interface Pill {
  id: number;
  status: Status;
  jobId: string;
}

let pillId = 0;

function randomJobId(seed: number): string {
  return `op-${((seed * 31 + 0xabcd) & 0xffff).toString(16).padStart(4, '0')}`;
}

export const TitleSlide: React.FC<SlideProps> = ({ isActive }) => {
  const [pills, setPills] = useState<Pill[]>([]);

  useEffect(() => {
    if (!isActive) { setPills([]); return; }
    let tick = 0;
    setPills(Array.from({ length: 8 }, (_, i) => ({
      id: ++pillId, status: pickStatus(pillId * 7), jobId: randomJobId(pillId),
    })));
    const t = setInterval(() => {
      tick++;
      setPills(prev => {
        const next = [...prev, {
          id: ++pillId,
          status: pickStatus(pillId * 7 + tick * 13),
          jobId: randomJobId(pillId + tick),
        }];
        return next.slice(-10);
      });
    }, 950);
    return () => clearInterval(t);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 36,
      padding: '40px 32px',
      position: 'relative',
    }}>
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          fontSize: 88,
          fontWeight: 800,
          fontFamily: 'monospace',
          color: '#0f172a',
          margin: 0,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          textAlign: 'center',
        }}
      >
        postgres<span style={{ color: '#3b82f6' }}>-</span>lro
      </motion.h1>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        style={{
          fontSize: 17,
          color: '#475569',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.32em',
        }}
      >
        package · unpacked
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.5 }}
        style={{
          width: 'min(880px, 92%)',
          padding: '16px 20px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
          fontSize: 11,
          color: '#475569',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 700,
        }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
          live · workitems_active sample
          <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>tick → 950 ms</span>
        </div>
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          minHeight: 38,
          alignItems: 'center',
        }}>
          {pills.map((p, idx) => {
            const meta = STATUS_META[p.status];
            const fading = idx < 2;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, scale: 0.6, y: -6 }}
                animate={{ opacity: fading ? 0.35 : 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 250, damping: 22 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: `${meta.color}18`,
                  border: `1px solid ${meta.color}45`,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: '#0f172a',
                  fontWeight: 600,
                }}
              >
                <span style={{ color: '#475569' }}>{p.jobId}</span>
                <span style={{ color: meta.color, fontWeight: 800 }}>·</span>
                <span style={{ color: meta.color, fontWeight: 800 }}>{meta.label}</span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        style={{
          position: 'absolute',
          bottom: 30,
          fontSize: 12,
          color: '#94a3b8',
          fontFamily: 'monospace',
        }}
      >
        a tour of the framework that turns Postgres into a durable work queue
      </motion.div>
    </div>
  );
};
