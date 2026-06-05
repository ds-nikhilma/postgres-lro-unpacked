import React from 'react';
import { motion } from 'framer-motion';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  highlightLines?: number[];
  fontSize?: number;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'go',
  title,
  highlightLines = [],
  fontSize = 13,
}) => {
  const lines = code.split('\n');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background: '#0f172a',
        borderRadius: 12,
        border: '1px solid #334155',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {title && (
        <div style={{
          padding: '8px 16px',
          background: '#1e293b',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{
            color: '#94a3b8',
            fontSize: 12,
            fontFamily: 'monospace',
          }}>
            {title}
          </span>
          <span style={{
            color: '#475569',
            fontSize: 11,
            marginLeft: 'auto',
          }}>
            {language}
          </span>
        </div>
      )}
      <pre style={{
        padding: '16px',
        margin: 0,
        overflowX: 'auto',
        fontSize,
        lineHeight: 1.6,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      }}>
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              background: highlightLines.includes(i + 1)
                ? 'rgba(59, 130, 246, 0.15)'
                : 'transparent',
              padding: '0 4px',
              borderLeft: highlightLines.includes(i + 1)
                ? '3px solid #3b82f6'
                : '3px solid transparent',
              marginLeft: -4,
            }}
          >
            <span style={{ color: '#475569', marginRight: 16, userSelect: 'none' }}>
              {String(i + 1).padStart(2, ' ')}
            </span>
            <span style={{ color: getLineColor(line) }}>
              {line}
            </span>
          </div>
        ))}
      </pre>
    </motion.div>
  );
};

function getLineColor(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('#')) return '#6b7280';
  if (trimmed.startsWith('func ') || trimmed.startsWith('type ')) return '#c084fc';
  if (trimmed.startsWith('return ')) return '#f472b6';
  if (trimmed.includes('":') || trimmed.includes('= ')) return '#93c5fd';
  if (trimmed.startsWith('import') || trimmed.startsWith('package')) return '#67e8f9';
  if (/^".*"/.test(trimmed) || /^'.*'/.test(trimmed)) return '#86efac';
  return '#e2e8f0';
}
