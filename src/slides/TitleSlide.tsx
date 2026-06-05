import React from 'react';
import { motion } from 'framer-motion';
import { SlideProps } from '../types';

export const TitleSlide: React.FC<SlideProps> = ({ isActive }) => {
  if (!isActive) return null;

  const tags = ['durable', 'distributed', 'fault-tolerant', 'observable'];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 28,
      padding: '40px 32px',
      position: 'relative',
    }}>
      {/* Logo mark — postgres elephant + work queue tiles */}
      <motion.div
        initial={{ scale: 0, rotate: -8 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 16 }}
        style={{
          width: 132,
          height: 132,
          borderRadius: 28,
          background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 20px 60px rgba(59, 130, 246, 0.25), 0 0 0 1px rgba(255,255,255,0.6) inset',
        }}
      >
        <svg width="78" height="78" viewBox="0 0 64 64" fill="none">
          {/* table outline */}
          <rect x="6" y="14" width="52" height="38" rx="5" stroke="white" strokeWidth="2.5" />
          <line x1="6"  y1="26" x2="58" y2="26" stroke="white" strokeWidth="2" />
          {/* traffic lights = statuses */}
          <circle cx="14" cy="20" r="2.4" fill="#fbbf24" />
          <circle cx="22" cy="20" r="2.4" fill="#22c55e" />
          <circle cx="30" cy="20" r="2.4" fill="#f43f5e" />
          {/* claim rows */}
          <rect x="11" y="31" width="18" height="3" rx="1.5" fill="white" fillOpacity="0.85" />
          <rect x="11" y="38" width="14" height="3" rx="1.5" fill="white" fillOpacity="0.55" />
          <rect x="11" y="45" width="22" height="3" rx="1.5" fill="white" fillOpacity="0.45" />
          {/* status pills */}
          <rect x="36" y="31" width="16" height="3" rx="1.5" fill="#fde047" />
          <rect x="36" y="38" width="12" height="3" rx="1.5" fill="#86efac" />
          <rect x="36" y="45" width="18" height="3" rx="1.5" fill="#fda4af" />
        </svg>
      </motion.div>

      {/* Wordmark */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        style={{
          fontSize: 72,
          fontWeight: 800,
          fontFamily: 'monospace',
          color: '#0f172a',
          margin: 0,
          letterSpacing: '-0.02em',
          textAlign: 'center',
          lineHeight: 1,
        }}
      >
        postgres<span style={{ color: '#3b82f6' }}>-</span>lro
      </motion.h1>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.5 }}
        style={{
          fontSize: 16,
          color: '#475569',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
        }}
      >
        package · unpacked
      </motion.div>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        style={{
          fontSize: 22,
          color: '#334155',
          textAlign: 'center',
          maxWidth: 760,
          lineHeight: 1.5,
          margin: 0,
          fontWeight: 400,
        }}
      >
        A durable, distributed work queue for
        {' '}<span style={{ color: '#3b82f6', fontWeight: 700 }}>Long-Running Operations</span>
        {' '}— built on a single PostgreSQL database.
      </motion.p>

      {/* Tag pills */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85, duration: 0.4 }}
        style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}
      >
        {tags.map((tag, i) => (
          <motion.span
            key={tag}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.95 + i * 0.08 }}
            style={{
              padding: '7px 16px',
              borderRadius: 999,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#334155',
              fontSize: 13,
              fontFamily: 'monospace',
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            {tag}
          </motion.span>
        ))}
      </motion.div>

      {/* Footer hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        style={{
          position: 'absolute',
          bottom: 36,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 12,
          color: '#94a3b8',
          fontFamily: 'monospace',
        }}
      >
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 22, height: 22, padding: '0 6px', borderRadius: 4,
          border: '1px solid #e2e8f0', background: '#ffffff', color: '#475569',
        }}>→</span>
        press arrow keys to navigate
      </motion.div>
    </div>
  );
};
