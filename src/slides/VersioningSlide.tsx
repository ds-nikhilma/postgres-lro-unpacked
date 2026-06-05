import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';

/**
 * Versioning slide: shows how a client constraint filters the
 * currently-active worker versions and the maximum match is picked.
 *
 * Click a match mode to see the visual play out.
 */

interface Mode {
  id: string;
  label: string;
  constraint: string;
  matching: string[];
  result: string;
  explain: string;
}

const REQUEST = '1.2.3';
const ALL: string[] = ['0.9.0', '1.0.0', '1.2.3', '1.3.0', '2.0.0'];

const MODES: Mode[] = [
  {
    id: 'AT_LEAST',
    label: 'AT_LEAST',
    constraint: '>= 1.2.3',
    matching: ['1.2.3', '1.3.0', '2.0.0'],
    result: '2.0.0',
    explain: 'Accept anything from 1.2.3 forward — including new major versions.',
  },
  {
    id: 'AT_LEAST_EXACT_MAJOR',
    label: 'AT_LEAST_EXACT_MAJOR',
    constraint: '>= 1.2.3, < 2.0.0',
    matching: ['1.2.3', '1.3.0'],
    result: '1.3.0',
    explain: 'Stay within the same major (no breaking changes), but newer minors/patches welcome.',
  },
  {
    id: 'AT_LEAST_EXACT_MINOR',
    label: 'AT_LEAST_EXACT_MINOR',
    constraint: '>= 1.2.3, < 1.3.0',
    matching: ['1.2.3'],
    result: '1.2.3',
    explain: 'Only newer patches inside the same minor version.',
  },
  {
    id: 'EXACT',
    label: 'EXACT',
    constraint: '= 1.2.3',
    matching: ['1.2.3'],
    result: '1.2.3',
    explain: 'Pin to the exact version — every other build is rejected.',
  },
];

export const VersioningSlide: React.FC<SlideProps> = ({ isActive }) => {
  const [modeId, setModeId] = useState(MODES[0].id);
  if (!isActive) return null;

  const mode = MODES.find(m => m.id === modeId) ?? MODES[0];
  const matched = new Set(mode.matching);
  const selected = mode.result;

  const versionState = (v: string): 'selected' | 'matched' | 'rejected' =>
    v === selected ? 'selected' : matched.has(v) ? 'matched' : 'rejected';

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
          versioning
          <span style={{ fontSize: 15, color: '#0ea5e9', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
            · how a constraint picks one worker version
          </span>
        </motion.h2>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6, fontFamily: 'monospace' }}>
          click a match mode to see how the constraint filters · always picks the <strong>maximum match</strong>
        </div>
      </div>

      {/* Match-mode tabs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
      }}>
        {MODES.map(m => {
          const on = m.id === modeId;
          return (
            <motion.button
              key={m.id}
              onClick={() => setModeId(m.id)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: '10px 14px',
                background: on ? '#0ea5e912' : '#f8fafc',
                border: on ? '2px solid #0ea5e9' : '1px solid #e2e8f0',
                borderRadius: 10,
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: 13,
                fontWeight: 800,
                color: on ? '#0c4a6e' : '#334155',
                textAlign: 'left',
              }}
            >
              {m.label}
            </motion.button>
          );
        })}
      </div>

      {/* Body: request → versions → result */}
      <div style={{
        flex: 1,
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 20,
        display: 'grid',
        gridTemplateColumns: '220px 1fr 220px',
        gap: 18,
        minHeight: 0,
        alignItems: 'stretch',
      }}>
        {/* Left: client request */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            fontSize: 11, color: '#475569', fontFamily: 'monospace',
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800,
          }}>
            client request
          </div>
          <div style={{
            padding: '14px 16px',
            background: '#ffffff',
            border: '2px solid #0ea5e9',
            borderRadius: 10,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', marginBottom: 6 }}>
              base version
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'monospace', color: '#0c4a6e' }}>
              {REQUEST}
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              style={{
                padding: '10px 14px',
                background: '#0f172a',
                color: '#86efac',
                borderRadius: 8,
                fontFamily: 'monospace',
                fontSize: 13,
              }}
            >
              <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>constraint</div>
              {mode.constraint}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Middle: active worker versions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            fontSize: 11, color: '#475569', fontFamily: 'monospace',
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800,
          }}>
            active worker versions
          </div>
          <div style={{
            flex: 1,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            justifyContent: 'center',
            minHeight: 0,
          }}>
            {ALL.map(v => {
              const state = versionState(v);
              const stateColor =
                state === 'selected' ? '#22c55e' :
                state === 'matched'  ? '#0ea5e9' :
                                       '#ef4444';
              return (
                <motion.div
                  key={v}
                  animate={{
                    scale: state === 'selected' ? 1.04 : 1,
                    opacity: state === 'rejected' ? 0.5 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 1fr 120px',
                    gap: 10,
                    padding: '10px 14px',
                    border: `2px solid ${stateColor}${state === 'selected' ? '' : '40'}`,
                    background: state === 'selected' ? `${stateColor}15` : '#ffffff',
                    borderRadius: 8,
                    alignItems: 'center',
                  }}
                >
                  <span style={{
                    fontFamily: 'monospace', fontSize: 17, fontWeight: 800,
                    color: state === 'rejected' ? '#94a3b8' : '#0f172a',
                  }}>
                    {v}
                  </span>
                  <div style={{
                    height: 4, borderRadius: 2,
                    background: state === 'rejected' ? '#e2e8f0' : `${stateColor}30`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {state !== 'rejected' && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 0.6 }}
                        style={{
                          position: 'absolute', inset: 0,
                          background: stateColor,
                        }}
                      />
                    )}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 800, fontFamily: 'monospace',
                    color: stateColor,
                    textTransform: 'uppercase',
                    textAlign: 'right',
                  }}>
                    {state === 'selected' ? '★ selected' :
                     state === 'matched'  ? '✓ matched' :
                                            '✗ rejected'}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right: selected version */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            fontSize: 11, color: '#475569', fontFamily: 'monospace',
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800,
          }}>
            pinned to the work item
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
              style={{
                padding: '18px 16px',
                background: '#dcfce7',
                border: '2px solid #22c55e',
                borderRadius: 10,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 12, color: '#166534', fontFamily: 'monospace', marginBottom: 6 }}>
                resolved version
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, fontFamily: 'monospace', color: '#166534' }}>
                {mode.result}
              </div>
              <div style={{ fontSize: 12, color: '#166534', marginTop: 6, fontStyle: 'italic' }}>
                only matching workers can claim
              </div>
            </motion.div>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.div
              key={mode.id + '-explain'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              style={{
                fontSize: 13, color: '#334155',
                background: '#ffffff', borderRadius: 8,
                border: '1px solid #e2e8f0', padding: '10px 12px',
                lineHeight: 1.5,
              }}
            >
              {mode.explain}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div style={{
        padding: '12px 18px',
        background: '#eff6ff',
        border: '1px solid #93c5fd',
        borderRadius: 10,
        fontSize: 14,
        color: '#1e3a8a',
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <span style={{ fontSize: 18 }}>📌</span>
        <span>
          Version is <strong>resolved at enqueue</strong> and stored on the work item.
          During rolling deploys, in-flight jobs keep their original version — no result-correctness drift.
        </span>
      </div>
    </div>
  );
};
