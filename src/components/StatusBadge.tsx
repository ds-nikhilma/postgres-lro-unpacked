import React from 'react';
import { motion } from 'framer-motion';

const statusConfig: Record<string, { bg: string; text: string; glow?: string }> = {
  queued: { bg: '#fbbf2420', text: '#fbbf24', glow: '#fbbf2440' },
  running: { bg: '#3b82f620', text: '#3b82f6', glow: '#3b82f640' },
  done: { bg: '#22c55e20', text: '#22c55e', glow: '#22c55e40' },
  failed: { bg: '#ef444420', text: '#ef4444', glow: '#ef444440' },
  canceled: { bg: '#a855f720', text: '#a855f7' },
  expired: { bg: '#f9731620', text: '#f97316' },
  deleted: { bg: '#6b728020', text: '#6b7280' },
};

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', pulse = false }) => {
  const config = statusConfig[status] || statusConfig.deleted;
  const fontSize = size === 'sm' ? 11 : size === 'lg' ? 16 : 13;
  const padding = size === 'sm' ? '2px 8px' : size === 'lg' ? '6px 16px' : '4px 12px';

  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
        boxShadow: pulse && config.glow
          ? [`0 0 0 0 ${config.glow}`, `0 0 0 8px transparent`]
          : undefined,
      }}
      transition={{
        duration: 0.3,
        boxShadow: pulse ? { repeat: Infinity, duration: 1.5 } : undefined,
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: config.bg,
        color: config.text,
        border: `1px solid ${config.text}40`,
        borderRadius: 20,
        padding,
        fontSize,
        fontWeight: 600,
        fontFamily: 'monospace',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: config.text,
      }} />
      {status}
    </motion.span>
  );
};
