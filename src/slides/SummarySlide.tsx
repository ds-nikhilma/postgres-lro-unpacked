import React from 'react';
import { motion } from 'framer-motion';
import { SlideProps } from '../types';

interface Pillar {
  icon: string;
  title: string;
  bullets: string[];
  color: string;
}

const PILLARS: Pillar[] = [
  {
    icon: '🛡️',
    title: 'fault tolerant',
    color: '#ef4444',
    bullets: [
      'expiring claims survive crashed workers',
      'automatic reclaim on heartbeat lapse',
      'bounded retries — no infinite loops',
    ],
  },
  {
    icon: '⚡',
    title: 'fast at scale',
    color: '#f59e0b',
    bullets: [
      'two-table split keeps claim queries hot',
      'FOR UPDATE SKIP LOCKED gives lock-free contention',
      'request caching deduplicates expensive work',
    ],
  },
  {
    icon: '🔄',
    title: 'safe evolution',
    color: '#0ea5e9',
    bullets: [
      'version pinned at enqueue, not at claim',
      'in-flight jobs immune to rolling deploys',
      'semver constraints decide what claims what',
    ],
  },
  {
    icon: '📊',
    title: 'fully observable',
    color: '#8b5cf6',
    bullets: [
      'Datadog APM + distributed tracing built-in',
      'per-status, per-version metrics',
      'event log surfaces every state change',
    ],
  },
  {
    icon: '🧹',
    title: 'self-maintaining',
    color: '#22c55e',
    bullets: [
      'GC sweeps move terminal rows aside',
      'configurable retention per service',
      'no external cron, no extra infrastructure',
    ],
  },
  {
    icon: '🧑‍💻',
    title: 'developer friendly',
    color: '#06b6d4',
    bullets: [
      'three files = one production service',
      'no new infra — just your existing Postgres',
      'dsflow scaffolds the boilerplate for you',
    ],
  },
];

export const SummarySlide: React.FC<SlideProps> = ({ isActive }) => {
  if (!isActive) return null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', padding: '24px 32px', gap: 18,
    }}>
      <div>
        <motion.h2
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0 }}
        >
          summary
          <span style={{ fontSize: 15, color: '#64748b', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
            · the whole thing on one screen
          </span>
        </motion.h2>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6, fontFamily: 'monospace' }}>
          a PostgreSQL-backed Go library for managing asynchronous operations at scale
        </div>
      </div>

      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        gap: 14,
        minHeight: 0,
      }}>
        {PILLARS.map((p, i) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.06 }}
            whileHover={{ y: -3 }}
            style={{
              padding: '18px 20px',
              background: '#ffffff',
              border: `1px solid ${p.color}30`,
              borderTop: `4px solid ${p.color}`,
              borderRadius: 12,
              display: 'flex', flexDirection: 'column', gap: 10,
              boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: `${p.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>
                {p.icon}
              </div>
              <div style={{
                fontSize: 16, fontFamily: 'monospace',
                fontWeight: 800, color: p.color,
              }}>
                {p.title}
              </div>
            </div>
            <ul style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 13.5,
              color: '#334155',
              lineHeight: 1.6,
            }}>
              {p.bullets.map(b => <li key={b}>{b}</li>)}
            </ul>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        style={{
          display: 'flex',
          gap: 14,
          padding: '16px 22px',
          background: 'linear-gradient(135deg, #06b6d410 0%, #8b5cf610 100%)',
          border: '1px solid #c7d2fe',
          borderRadius: 12,
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: 32 }}>🐘</div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 15, fontFamily: 'monospace', fontWeight: 800,
            color: '#0f172a', marginBottom: 2,
          }}>
            one Postgres database, one Go library — all of the above.
          </div>
          <div style={{ fontSize: 13, color: '#475569' }}>
            ship a new LRO service in an afternoon, not a sprint.
          </div>
        </div>
        <div style={{
          padding: '8px 16px', borderRadius: 999,
          background: '#0f172a', color: '#86efac',
          fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
        }}>
          go get postgres-lro
        </div>
      </motion.div>
    </div>
  );
};
