import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkItem } from '../types';

interface DatabaseTableProps {
  title: string;
  items: WorkItem[];
  highlightId?: string;
  columns?: (keyof WorkItem)[];
  compact?: boolean;
}

const statusColors: Record<string, string> = {
  queued: '#fbbf24',
  running: '#3b82f6',
  done: '#22c55e',
  failed: '#ef4444',
  canceled: '#a855f7',
  expired: '#f97316',
  deleted: '#6b7280',
};

const defaultColumns: (keyof WorkItem)[] = ['id', 'status', 'claimed_by', 'claimed_count', 'version'];

export const DatabaseTable: React.FC<DatabaseTableProps> = ({
  title,
  items,
  highlightId,
  columns = defaultColumns,
  compact = false,
}) => {
  return (
    <div style={{
      background: '#1e293b',
      borderRadius: 12,
      border: '1px solid #334155',
      overflow: 'hidden',
      width: '100%',
    }}>
      <div style={{
        padding: compact ? '8px 16px' : '12px 20px',
        background: '#0f172a',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#3b82f6',
        }} />
        <span style={{
          fontFamily: 'monospace',
          fontSize: compact ? 13 : 14,
          color: '#94a3b8',
          fontWeight: 600,
        }}>
          {title}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: compact ? 12 : 13,
          fontFamily: 'monospace',
        }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col} style={{
                  padding: compact ? '6px 12px' : '10px 16px',
                  textAlign: 'left',
                  color: '#64748b',
                  fontWeight: 500,
                  borderBottom: '1px solid #334155',
                  textTransform: 'uppercase',
                  fontSize: compact ? 10 : 11,
                  letterSpacing: '0.05em',
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {items.map((item) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0, backgroundColor: 'rgba(59, 130, 246, 0.3)' }}
                  animate={{
                    opacity: 1,
                    backgroundColor: item.id === highlightId
                      ? 'rgba(59, 130, 246, 0.15)'
                      : 'transparent',
                  }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.5 }}
                >
                  {columns.map((col) => (
                    <td key={col} style={{
                      padding: compact ? '6px 12px' : '10px 16px',
                      borderBottom: '1px solid #1e293b',
                      color: col === 'status'
                        ? statusColors[item[col] as string] || '#e2e8f0'
                        : '#cbd5e1',
                      fontWeight: col === 'status' ? 600 : 400,
                    }}>
                      {col === 'id' ? (item[col] as string).substring(0, 8) + '...' : (item[col] ?? '—')}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </AnimatePresence>
            {items.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{
                  padding: '20px 16px',
                  textAlign: 'center',
                  color: '#475569',
                  fontStyle: 'italic',
                }}>
                  No items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
