import React from 'react';
import { motion } from 'framer-motion';

/**
 * A tiny "you are here" thumbnail of the architecture diagram, embedded
 * on each detail slide. The boxes named in `highlight` render in their
 * full color; the rest fade to grey, so the audience sees which part of
 * the system the current slide is zooming into.
 *
 * Clicking the inset navigates back to the Architecture slide (if a
 * `goToSlide` callback was provided via SlideProps).
 *
 * If `pulse` is true, the highlighted boxes pulse continuously — useful
 * for the slide-enter "zoom in" cue.
 */

export type MiniBox = 'client' | 'handler' | 'service' | 'repository' | 'postgres' | 'worker';

interface MiniBoxDef {
  id: MiniBox;
  label: string;
  x: number; y: number; w: number; h: number;
  color: string;
  icon: string;
}

// Compressed layout — same topology as the full Architecture, scaled to a 320×140 viewBox
const BOXES: MiniBoxDef[] = [
  { id: 'client',     label: 'Client',     x: 8,   y: 56, w: 50, h: 28, color: '#22c55e', icon: '📱' },
  { id: 'handler',    label: 'Handler',    x: 90,  y: 8,  w: 60, h: 26, color: '#3b82f6', icon: '🔌' },
  { id: 'service',    label: 'Service',    x: 90,  y: 56, w: 60, h: 26, color: '#8b5cf6', icon: '⚙️' },
  { id: 'repository', label: 'Repository', x: 90,  y: 104,w: 60, h: 26, color: '#f97316', icon: '📦' },
  { id: 'postgres',   label: 'Postgres',   x: 178, y: 80, w: 64, h: 34, color: '#06b6d4', icon: '🐘' },
  { id: 'worker',     label: 'Worker',     x: 260, y: 50, w: 52, h: 28, color: '#f43f5e', icon: '🔧' },
];

interface Arrow { x1: number; y1: number; x2: number; y2: number; color: string; }

const ARROWS: Arrow[] = [
  { x1: 58,  y1: 64, x2: 90,  y2: 22, color: '#22c55e' },  // client → handler
  { x1: 120, y1: 34, x2: 120, y2: 56, color: '#3b82f6' },  // handler → service
  { x1: 120, y1: 82, x2: 120, y2: 104, color: '#8b5cf6' }, // service → repo
  { x1: 150, y1: 117, x2: 178, y2: 102, color: '#f97316' }, // repo → postgres
  { x1: 260, y1: 60, x2: 220, y2: 86, color: '#f43f5e' },  // worker → postgres (claim)
  { x1: 260, y1: 78, x2: 220, y2: 104, color: '#22c55e' }, // worker → postgres (release)
];

interface Props {
  /** ids of boxes that are the focus of this slide; everything else greys out */
  highlight: MiniBox[];
  /** continuously pulse the highlighted boxes — for the slide-enter cue */
  pulse?: boolean;
  /** when provided, the inset is clickable and navigates back to Architecture */
  onClick?: () => void;
  /** caption shown to the right of the inset */
  caption?: string;
  /** subtle subtext shown under the caption */
  subcaption?: string;
}

export const ArchitectureMini: React.FC<Props> = ({ highlight, pulse, onClick, caption, subcaption }) => {
  const highlightSet = new Set(highlight);
  const isOn = (id: MiniBox) => highlightSet.has(id);
  const interactive = !!onClick;

  return (
    <div
      role={interactive ? 'button' : undefined}
      onClick={onClick}
      title={interactive ? 'Click to go back to the Architecture overview' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 10px 6px 6px',
        background: '#ffffffe0',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        cursor: interactive ? 'pointer' : 'default',
        userSelect: 'none',
        backdropFilter: 'blur(4px)',
      }}
    >
      <svg width="160" height="70" viewBox="0 0 320 140" style={{ flexShrink: 0 }}>
        {/* Arrows */}
        {ARROWS.map((a, i) => {
          // An arrow is "on" if both endpoint boxes are highlighted (lit only when their two boxes are the focus)
          const fromBox = BOXES.find(b => Math.abs((b.x + b.w / 2) - a.x1) < 30 && Math.abs((b.y + b.h / 2) - a.y1) < 30);
          const toBox   = BOXES.find(b => Math.abs((b.x + b.w / 2) - a.x2) < 30 && Math.abs((b.y + b.h / 2) - a.y2) < 30);
          const on = fromBox && toBox && isOn(fromBox.id) && isOn(toBox.id);
          return (
            <line
              key={i}
              x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
              stroke={on ? a.color : '#cbd5e180'}
              strokeWidth={on ? 1.6 : 0.8}
              strokeDasharray={on ? '0' : '3 2'}
            />
          );
        })}
        {/* Boxes */}
        {BOXES.map(b => {
          const on = isOn(b.id);
          const fill = on ? `${b.color}30` : '#f8fafc80';
          const stroke = on ? b.color : '#475569';
          return (
            <g key={b.id}>
              {on && pulse && (
                <motion.rect
                  x={b.x - 2} y={b.y - 2} width={b.w + 4} height={b.h + 4}
                  rx="6" ry="6" fill="none" stroke={b.color}
                  animate={{ opacity: [0.3, 0.9, 0.3], strokeWidth: [1, 2.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1.4 }}
                />
              )}
              <rect
                x={b.x} y={b.y} width={b.w} height={b.h} rx="5" ry="5"
                fill={fill} stroke={stroke}
                strokeWidth={on ? 1.5 : 0.8}
                opacity={on ? 1 : 0.55}
              />
              <text
                x={b.x + b.w / 2} y={b.y + b.h / 2 + 3}
                textAnchor="middle"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="700"
                fill={on ? b.color : '#475569'}
                opacity={on ? 1 : 0.7}
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      {(caption || subcaption || interactive) && (
        <div style={{ minWidth: 0 }}>
          {caption && (
            <div style={{
              fontSize: 11,
              color: '#334155',
              fontFamily: 'monospace',
              fontWeight: 700,
            }}>
              {caption}
            </div>
          )}
          {subcaption && (
            <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>
              {subcaption}
            </div>
          )}
          {interactive && (
            <div style={{
              fontSize: 9,
              color: '#475569',
              marginTop: 3,
              fontFamily: 'monospace',
            }}>
              ↩ click to go back
            </div>
          )}
        </div>
      )}
    </div>
  );
};
