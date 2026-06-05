import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';

interface Pain {
  id: string;
  icon: string;
  title: string;
  oneLiner: string;
  symptom: string;
  rootCause: string;
  color: string;
}

const PAINS: Pain[] = [
  {
    id: 'timeout',
    icon: '⏱️',
    title: 'requests time out',
    oneLiner: 'AI inference, video transcode, batch jobs — 30 s to 5 min each.',
    symptom: 'Browser shows a spinner for 90 s, then a 504 from the gateway. The work might still finish in the background, but nobody can read the result.',
    rootCause: 'HTTP request/response is fundamentally short-lived. Anything > 10 s needs an out-of-band channel for the client to come back and pick up the result.',
    color: '#f59e0b',
  },
  {
    id: 'crash',
    icon: '💥',
    title: 'workers crash mid-job',
    oneLiner: 'Pod restart, OOM, deploy — the in-flight job vanishes.',
    symptom: 'A pod is killed during a deploy. The job it was processing is silently lost. The client polls forever.',
    rootCause: 'Without a durable claim with an expiry, no other worker knows that job was abandoned. There is no record of who was working on what.',
    color: '#ef4444',
  },
  {
    id: 'duplicate',
    icon: '🔁',
    title: 'duplicate work explodes cost',
    oneLiner: 'Same input, same expensive GPU job, run twice.',
    symptom: 'Two clients submit the same request 200 ms apart. The system happily kicks off two identical 4-minute GPU jobs and bills you for both.',
    rootCause: 'Without dedup keys checked at enqueue time, every call is a fresh job. With GPU minutes costing real money, this scales badly.',
    color: '#8b5cf6',
  },
  {
    id: 'rollout',
    icon: '🚦',
    title: 'rolling out a new model is scary',
    oneLiner: 'v2 worker mixes results with v1 in flight.',
    symptom: 'Half your fleet is the new model, half is the old one. Two clients with the same input get different answers depending on which worker claimed.',
    rootCause: 'No version pinning on work items, no contract between client and worker about which version they expected.',
    color: '#0ea5e9',
  },
];

export const ProblemSlide: React.FC<SlideProps> = ({ isActive }) => {
  const [selected, setSelected] = useState<string>(PAINS[0].id);
  if (!isActive) return null;

  const pain = PAINS.find(p => p.id === selected) ?? PAINS[0];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '24px 32px',
      gap: 16,
    }}>
      <div>
        <motion.h2
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0 }}
        >
          the problem
          <span style={{ fontSize: 15, color: '#f59e0b', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
            · why a framework, and not just a goroutine
          </span>
        </motion.h2>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6, fontFamily: 'monospace' }}>
          click a card to see the symptom and the root cause
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
      }}>
        {PAINS.map((p, i) => {
          const active = p.id === selected;
          return (
            <motion.button
              key={p.id}
              onClick={() => setSelected(p.id)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              style={{
                textAlign: 'left',
                padding: '16px 18px',
                background: active ? `${p.color}10` : '#f8fafc',
                border: active ? `2px solid ${p.color}` : '1px solid #e2e8f0',
                borderRadius: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                boxShadow: active ? `0 8px 28px ${p.color}22` : 'none',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `${p.color}18`, color: p.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>
                {p.icon}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                {p.title}
              </div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.45 }}>
                {p.oneLiner}
              </div>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={pain.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
            minHeight: 0,
          }}
        >
          <div style={{
            background: '#fff', borderRadius: 12,
            border: `1px solid ${pain.color}30`,
            padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{
              fontSize: 12, color: pain.color, fontWeight: 800,
              fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              what you see
            </div>
            <div style={{ fontSize: 18, color: '#0f172a', lineHeight: 1.55, fontWeight: 500 }}>
              {pain.symptom}
            </div>
          </div>
          <div style={{
            background: '#fff', borderRadius: 12,
            border: '1px solid #e2e8f0',
            padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{
              fontSize: 12, color: '#475569', fontWeight: 800,
              fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              why, without a framework
            </div>
            <div style={{ fontSize: 18, color: '#334155', lineHeight: 1.55 }}>
              {pain.rootCause}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div style={{
        padding: '12px 18px',
        background: '#fef3c7',
        border: '1px solid #fcd34d',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 14,
        color: '#78350f',
        fontWeight: 600,
      }}>
        <span style={{ fontSize: 18 }}>🧰</span>
        postgres-lro solves <strong>all four</strong> with one durable claim queue, dedup at enqueue, expiring claims, and version pinning.
      </div>
    </div>
  );
};
