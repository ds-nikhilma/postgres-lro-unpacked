import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { SlideProps } from '../types';

/**
 * "What changes when you wire postgres-lro into a service?"
 *
 * Two columns:
 *   - LEFT  · without — a hand-rolled synchronous gRPC method that
 *     blocks until the model finishes (and gets killed by the gateway).
 *   - RIGHT · with    — the same method, rewritten to enqueue an LRO
 *     in 4 lines. The diff is what the audience studies.
 *
 * Toggle the "explain" pill to surface inline annotations on each line
 * that's different. Toggle "highlight diff" to dim everything that
 * didn't change.
 */

type Side = 'without' | 'with';

interface Line {
  text: string;
  changed?: boolean;
  note?: string;
}

// Both blocks have the same skeleton so the diff is visually obvious.
const WITHOUT: Line[] = [
  { text: 'func (s *Server) RecognizeTeeth(' },
  { text: '    ctx context.Context,' },
  { text: '    req *toothrecognition.RecognizeTeethRequest,' },
  { text: ') (*toothrecognition.Response, error) {', changed: true,
    note: 'returns the *response itself* — keeps the gRPC call open while the model runs' },
  { text: '' },
  { text: '    // Run the model synchronously. Blocks for ~4 minutes.', changed: true },
  { text: '    result, err := runModel(ctx, req.ScanId)', changed: true,
    note: 'the gateway will time out the client connection at 60s · this method keeps running but no one is listening' },
  { text: '    if err != nil {' },
  { text: '        return nil, status.Errorf(codes.Internal, "model: %v", err)' },
  { text: '    }' },
  { text: '' },
  { text: '    return &toothrecognition.Response{', changed: true },
  { text: '        Teeth:    result.Teeth,', changed: true },
  { text: '        ResultID: result.ResultID,', changed: true },
  { text: '    }, nil', changed: true },
  { text: '}' },
];

const WITH: Line[] = [
  { text: 'func (h *customHandler) RecognizeTeeth(' },
  { text: '    ctx context.Context,' },
  { text: '    req *toothrecognition.RecognizeTeethRequest,' },
  { text: ') (*longrunningpb.Operation, error) {', changed: true,
    note: 'returns an Operation handle · client gets an op_id immediately, polls later' },
  { text: '' },
  { text: '    anyReq, err := anypb.New(req)', changed: true,
    note: 'wrap the request so the framework can store it in workitems_active' },
  { text: '    if err != nil {' },
  { text: '        return nil, status.Errorf(codes.InvalidArgument, "marshal: %v", err)' },
  { text: '    }' },
  { text: '' },
  { text: '    return h.handler.Compute(ctx, anyReq, lro.ComputeOptions{', changed: true,
    note: 'one call enqueues the work, dedups via cache_key, and returns the op handle' },
  { text: '        Metadata: req.GetComputeMetadata(),', changed: true },
  { text: '        CacheKey: computeCacheKey(req.GetCbctId()),', changed: true,
    note: 'same cache_key + non-failed op → same op_id returned · saves a GPU run' },
  { text: '    })' },
  { text: '}' },
];

export const UsagePatternsSlide: React.FC<SlideProps> = ({ isActive }) => {
  const [dim, setDim] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [hoveredSide, setHoveredSide] = useState<Side | null>(null);

  if (!isActive) return null;

  const withoutLoc = WITHOUT.filter(l => l.text.trim() !== '').length;
  const withLoc    = WITH.filter(l => l.text.trim() !== '').length;
  const changedCount = WITHOUT.filter(l => l.changed).length + WITH.filter(l => l.changed).length;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', padding: '24px 32px', gap: 14,
    }}>
      <div>
        <motion.h2
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0 }}
        >
          before & after
          <span style={{ fontSize: 15, color: '#0f766e', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
            · the same gRPC method, wired to postgres-lro
          </span>
        </motion.h2>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6, fontFamily: 'monospace' }}>
          one method · same skeleton · {changedCount} lines change · {withoutLoc} → {withLoc} LOC
        </div>
      </div>

      {/* Toggles */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center',
        padding: '10px 16px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
      }}>
        <Toggle on={dim} onChange={setDim} label="dim unchanged" />
        <Toggle on={showNotes} onChange={setShowNotes} label="show inline notes" />
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>
          hover a side for a quick verdict
        </div>
      </div>

      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 14,
      }}>
        <Pane
          side="without"
          title="without postgres-lro"
          subtitle="synchronous gRPC method · ~30 s before the gateway kills it"
          color="#ef4444"
          lines={WITHOUT}
          dim={dim}
          showNotes={showNotes}
          onHover={() => setHoveredSide('without')}
          onLeave={() => setHoveredSide(null)}
          verdict={hoveredSide === 'without' ? '👎 will time out · no retry · result orphaned' : null}
        />
        <Pane
          side="with"
          title="with postgres-lro"
          subtitle="returns Operation handle · the work runs durably in the background"
          color="#0f766e"
          lines={WITH}
          dim={dim}
          showNotes={showNotes}
          onHover={() => setHoveredSide('with')}
          onLeave={() => setHoveredSide(null)}
          verdict={hoveredSide === 'with' ? '👍 client polls · framework owns retries, dedup, versioning' : null}
        />
      </div>
    </div>
  );
};

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string }> = ({ on, onChange, label }) => (
  <button
    onClick={() => onChange(!on)}
    style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 12px',
      background: on ? '#0f766e' : '#ffffff',
      color: on ? '#ffffff' : '#475569',
      border: on ? '1px solid #0f766e' : '1px solid #e2e8f0',
      borderRadius: 8,
      fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
      cursor: 'pointer',
    }}
  >
    <span style={{
      display: 'inline-block', width: 10, height: 10,
      borderRadius: '50%',
      background: on ? '#ffffff' : '#e2e8f0',
    }} />
    {label}
  </button>
);

interface PaneProps {
  side: Side;
  title: string;
  subtitle: string;
  color: string;
  lines: Line[];
  dim: boolean;
  showNotes: boolean;
  onHover: () => void;
  onLeave: () => void;
  verdict: string | null;
}

const Pane: React.FC<PaneProps> = ({ title, subtitle, color, lines, dim, showNotes, onHover, onLeave, verdict }) => (
  <div
    onMouseEnter={onHover}
    onMouseLeave={onLeave}
    style={{
      display: 'flex', flexDirection: 'column',
      background: '#0f172a',
      border: `1px solid ${color}55`,
      borderRadius: 12,
      overflow: 'hidden',
    }}
  >
    <div style={{
      padding: '10px 16px',
      background: '#1e293b',
      borderBottom: '1px solid #334155',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{
        padding: '3px 8px',
        background: color,
        color: '#ffffff',
        borderRadius: 4,
        fontFamily: 'monospace', fontSize: 11, fontWeight: 800,
      }}>
        {title}
      </span>
      <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>
        {subtitle}
      </span>
    </div>
    <div style={{
      flex: 1, minHeight: 0, overflow: 'auto',
      padding: '12px 0',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 14, lineHeight: 1.65,
    }}>
      {lines.map((l, i) => {
        const isComment = l.text.trim().startsWith('//');
        const baseColor =
          isComment   ? '#6b7280' :
          l.changed   ? '#e2e8f0' :
                        '#cbd5e1';
        const dimmed = dim && !l.changed;
        return (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr',
            paddingRight: 12,
            background: l.changed ? `${color}14` : 'transparent',
            borderLeft: l.changed ? `3px solid ${color}` : '3px solid transparent',
            opacity: dimmed ? 0.35 : 1,
            transition: 'opacity 0.2s',
          }}>
            <span style={{ color: '#475569', textAlign: 'right', paddingRight: 8 }}>
              {String(i + 1).padStart(2, ' ')}
            </span>
            <div>
              <span style={{ color: baseColor, whiteSpace: 'pre' }}>{l.text || ' '}</span>
              {showNotes && l.note && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    marginTop: 1, marginBottom: 4,
                    fontSize: 11, color: '#fde68a',
                    fontStyle: 'italic',
                    paddingLeft: 6,
                  }}
                >
                  ↳ {l.note}
                </motion.div>
              )}
            </div>
          </div>
        );
      })}
    </div>
    {verdict && (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '10px 16px',
          background: '#1e293b',
          borderTop: '1px solid #334155',
          color: '#e2e8f0',
          fontSize: 13, fontFamily: 'monospace', fontWeight: 700,
        }}
      >
        {verdict}
      </motion.div>
    )}
  </div>
);
