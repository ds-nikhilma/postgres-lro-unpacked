import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';

/**
 * Foundation slide: shows the MLE services timeline (2022 → 2026) to
 * motivate why postgres-lro had to exist. Click a year to expand its
 * service launches.
 */

interface Service {
  date: string;
  name: string;
  icon?: string;
  note?: string;
}

interface Year {
  year: number;
  services: Service[];
  accent: string;
}

const YEARS: Year[] = [
  {
    year: 2022,
    accent: '#94a3b8',
    services: [
      { date: '2022-07-21', name: 'tooth-modeling-lro' },
      { date: '2022-09-28', name: 'cbctai-panoramic-curve-proposal-lro' },
    ],
  },
  {
    year: 2023,
    accent: '#a78bfa',
    services: [
      { date: '2023-04-19', name: 'di-orientation', icon: '⚠️',
        note: 'Removed Dec 2025 → replaced by ai-scan-orientation-lro' },
      { date: '2023-06-27', name: 'margin-line-detection-lro' },
    ],
  },
  {
    year: 2024,
    accent: '#06b6d4',
    services: [
      { date: '2024-11-12', name: 'ai-scan-orientation-lro', icon: '🔄',
        note: 'Replaced di-orientation' },
      { date: '2024-12-02', name: 'cbct-segmentation-lro', icon: '↗️',
        note: 'Evolved to cbct-anatomy-segmentation (Feb 2026)' },
    ],
  },
  {
    year: 2025,
    accent: '#f59e0b',
    services: [
      { date: '2025-09-03', name: 'di-comparison' },
      { date: '2025-09-11', name: 'di-segmentation-lro' },
      { date: '2025-09-30', name: 'parl-detection' },
      { date: '2025-10-09', name: 'parl' },
      { date: '2025-10-22', name: 'tooth-recognition' },
      { date: '2025-12-03', name: 'di-di-matching' },
    ],
  },
  {
    year: 2026,
    accent: '#22c55e',
    services: [
      { date: '2026-02-02', name: 'cbct-anatomy-segmentation', icon: '🔄',
        note: 'Evolved from cbct-segmentation-lro' },
      { date: '2026-03-20', name: 'di-dx-matching-computation' },
      { date: '2026-04-10', name: 'cbct-panoramic-curve-proposal', icon: '🔄',
        note: 'Evolved from cbctai-panoramic-curve-proposal-lro' },
      { date: '2026-04-30', name: 'csg-lro' },
      { date: '2026-05-20', name: 'di-dx-matching' },
      { date: '2026-05-26', name: 'cbct-anatomy-segmentation-computation' },
    ],
  },
];

const MAX_COUNT = Math.max(...YEARS.map(y => y.services.length));
const TOTAL = YEARS.reduce((acc, y) => acc + y.services.length, 0);

export const TimelineSlide: React.FC<SlideProps> = ({ isActive }) => {
  const [expanded, setExpanded] = useState<number | null>(2025);
  if (!isActive) return null;

  const expandedYear = YEARS.find(y => y.year === expanded);

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
          the foundation
          <span style={{ fontSize: 15, color: '#22c55e', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
            · why we needed a framework, not a one-off
          </span>
        </motion.h2>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6, fontFamily: 'monospace' }}>
          {TOTAL}+ LRO services launched across 5 years · click a year to see what landed
        </div>
      </div>

      {/* Bar chart */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${YEARS.length}, 1fr)`,
        gap: 16,
        padding: '20px 24px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
      }}>
        {YEARS.map((y, i) => {
          const active = y.year === expanded;
          const height = 36 + (y.services.length / MAX_COUNT) * 110;
          return (
            <motion.button
              key={y.year}
              onClick={() => setExpanded(active ? null : y.year)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.07 }}
              whileHover={{ y: -2 }}
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 8,
                background: 'transparent', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <motion.div
                animate={{ height, opacity: active ? 1 : 0.7 }}
                transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                style={{
                  width: '100%',
                  background: `linear-gradient(180deg, ${y.accent} 0%, ${y.accent}aa 100%)`,
                  borderRadius: 8,
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                  paddingTop: 8,
                  color: '#fff', fontWeight: 800, fontSize: 18,
                  fontFamily: 'monospace',
                  boxShadow: active ? `0 6px 20px ${y.accent}55` : 'none',
                  border: active ? '2px solid #0f172a' : '2px solid transparent',
                }}
              >
                {y.services.length}
              </motion.div>
              <div style={{
                fontSize: 14, fontFamily: 'monospace',
                color: active ? '#0f172a' : '#475569',
                fontWeight: active ? 800 : 600,
              }}>
                {y.year}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Expanded year detail */}
      <AnimatePresence mode="wait">
        {expandedYear && (
          <motion.div
            key={expandedYear.year}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            style={{
              flex: 1,
              background: '#ffffff',
              border: `1px solid ${expandedYear.accent}40`,
              borderRadius: 12,
              padding: '18px 22px',
              display: 'flex', flexDirection: 'column', gap: 12,
              minHeight: 0,
              overflow: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{
                fontSize: 24, fontWeight: 800, color: expandedYear.accent,
                fontFamily: 'monospace',
              }}>
                {expandedYear.year}
              </span>
              <span style={{ fontSize: 13, color: '#475569', fontFamily: 'monospace' }}>
                {expandedYear.services.length} service{expandedYear.services.length === 1 ? '' : 's'} launched
              </span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 10,
            }}>
              {expandedYear.services.map((s, i) => (
                <motion.div
                  key={s.name}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{
                    padding: '10px 14px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    borderLeft: `4px solid ${expandedYear.accent}`,
                  }}
                >
                  <div style={{
                    fontSize: 14, fontFamily: 'monospace', color: '#0f172a',
                    fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {s.icon && <span>{s.icon}</span>}
                    {s.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', marginTop: 2 }}>
                    {s.date}
                  </div>
                  {s.note && (
                    <div style={{ fontSize: 12, color: '#92400e', marginTop: 6, fontStyle: 'italic' }}>
                      {s.note}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{
        padding: '12px 18px',
        background: '#ecfdf5',
        border: '1px solid #6ee7b7',
        borderRadius: 10,
        fontSize: 14,
        color: '#065f46',
        fontWeight: 600,
      }}>
        🚀 By late 2025 the rate of new LRO services made copy-pasting boilerplate untenable.
        That pressure is what gave birth to <strong>postgres-lro</strong>.
      </div>
    </div>
  );
};
