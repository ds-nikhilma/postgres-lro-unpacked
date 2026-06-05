import React from 'react';
import { motion } from 'framer-motion';

interface FlowArrowProps {
  label?: string;
  direction?: 'right' | 'down' | 'left';
  delay?: number;
  color?: string;
  animated?: boolean;
}

export const FlowArrow: React.FC<FlowArrowProps> = ({
  label,
  direction = 'right',
  delay = 0,
  color = '#3b82f6',
  animated = true,
}) => {
  const isHorizontal = direction === 'right' || direction === 'left';
  const rotation = direction === 'down' ? 90 : direction === 'left' ? 180 : 0;

  return (
    <motion.div
      initial={animated ? { opacity: 0, scale: 0.8 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: isHorizontal ? '0 4px' : '4px 0',
        flexShrink: 0,
      }}
    >
      <svg
        width={isHorizontal ? 60 : 24}
        height={isHorizontal ? 24 : 60}
        viewBox={isHorizontal ? '0 0 60 24' : '0 0 24 60'}
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {isHorizontal ? (
          <>
            <motion.line
              x1="0" y1="12" x2="48" y2="12"
              stroke={color}
              strokeWidth="2"
              strokeDasharray="6 3"
              initial={animated ? { pathLength: 0 } : {}}
              animate={{ pathLength: 1 }}
              transition={{ delay: delay + 0.2, duration: 0.4 }}
            />
            <motion.polygon
              points="48,6 60,12 48,18"
              fill={color}
              initial={animated ? { opacity: 0 } : {}}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + 0.5, duration: 0.2 }}
            />
          </>
        ) : (
          <>
            <motion.line
              x1="12" y1="0" x2="12" y2="48"
              stroke={color}
              strokeWidth="2"
              strokeDasharray="6 3"
              initial={animated ? { pathLength: 0 } : {}}
              animate={{ pathLength: 1 }}
              transition={{ delay: delay + 0.2, duration: 0.4 }}
            />
            <motion.polygon
              points="6,48 12,60 18,48"
              fill={color}
              initial={animated ? { opacity: 0 } : {}}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + 0.5, duration: 0.2 }}
            />
          </>
        )}
      </svg>
      {label && (
        <span style={{
          fontSize: 11,
          color: '#94a3b8',
          whiteSpace: 'nowrap',
          fontWeight: 500,
        }}>
          {label}
        </span>
      )}
    </motion.div>
  );
};
