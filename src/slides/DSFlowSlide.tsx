import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { SlideProps } from '../types';

/**
 * DSFlow: "12 lines in, ~1,500 lines out."
 *
 * A terminal-ish view. On the left, the YAML config (small, hand-written).
 * On the right, a live tally of generated lines per category, ticking up
 * one by one as the audience presses "generate". The bottom bar lands on
 * the final ratio.
 *
 * No "feature card grid". The whole point is the lopsided ratio: a tiny
 * amount of declarative config buys a large pile of boilerplate.
 */

interface Bucket {
  label: string;
  fullPath: string;
  loc: number;
  color: string;
}

// Ordered roughly as DSFlow would emit them.
const BUCKETS: Bucket[] = [
  { label: 'proto · api/v1',          fullPath: 'api/v1/service.proto, internal.proto',                 loc:  180, color: '#06b6d4' },
  { label: 'service skeleton',        fullPath: 'cmd/service/main.go, internal/handler.go, validator.go', loc: 320, color: '#3b82f6' },
  { label: 'worker skeleton',         fullPath: 'cmd/worker/main.go, internal/runner.go',               loc:  240, color: '#8b5cf6' },
  { label: 'sql migrations',          fullPath: 'infra/db/0001_init.sql, 0002_indexes.sql',             loc:   90, color: '#22c55e' },
  { label: 'cloud build + skaffold',  fullPath: 'infra/cloudbuild.yaml, skaffold.yaml',                 loc:  140, color: '#f59e0b' },
  { label: 'kubernetes manifests',    fullPath: 'k8s/deployment.yaml, service.yaml, hpa.yaml',          loc:  210, color: '#ec4899' },
  { label: 'tests',                   fullPath: 'internal/handler_test.go, runner_test.go',             loc:  180, color: '#0ea5e9' },
  { label: 'ci pipelines',            fullPath: '.github/workflows/ci.yml, lint.yml',                   loc:  120, color: '#a21caf' },
];

const TOTAL_OUT = BUCKETS.reduce((a, b) => a + b.loc, 0);

const YAML = `name: tooth-recognition
language: go
postgres_lro: ">= 2.40.0"

handler:
  proto: api/v1/service.proto
  rpc:   RecognizeTeeth
  cache_key:
    fields: [cbct_id]

worker:
  image: gcr.io/ds/tooth-recognition:%v
  gpu:   true
  product_version_source: compute_client`;

const YAML_LOC = YAML.split('\n').filter(l => l.trim() !== '').length;

export const DSFlowSlide: React.FC<SlideProps> = ({ isActive }) => {
  const [generated, setGenerated] = useState<number[]>(BUCKETS.map(() => 0));
  const [running, setRunning] = useState(false);
  const [bucketCursor, setBucketCursor] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      setGenerated(BUCKETS.map(() => 0));
      setBucketCursor(0);
      setRunning(false);
    }
  }, [isActive]);

  useEffect(() => {
    if (!running) return;
    if (bucketCursor >= BUCKETS.length) { setRunning(false); return; }
    let cancelled = false;
    const target = BUCKETS[bucketCursor].loc;
    const startedAt = performance.now();
    const dur = 700; // ms to fill this bucket

    const step = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - startedAt) / dur);
      const value = Math.floor(target * easeOutCubic(t));
      setGenerated(prev => {
        const next = [...prev];
        next[bucketCursor] = value;
        return next;
      });
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else {
        setGenerated(prev => {
          const next = [...prev];
          next[bucketCursor] = target;
          return next;
        });
        setBucketCursor(b => b + 1);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { cancelled = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running, bucketCursor]);

  const generatedTotal = generated.reduce((a, b) => a + b, 0);
  const filesGenerated = generated.filter(g => g > 0).length;
  const ratio = generatedTotal > 0 ? Math.round(generatedTotal / YAML_LOC) : 0;

  const start = () => {
    setGenerated(BUCKETS.map(() => 0));
    setBucketCursor(0);
    setRunning(true);
  };
  const reset = () => {
    setRunning(false);
    setGenerated(BUCKETS.map(() => 0));
    setBucketCursor(0);
  };

  if (!isActive) return null;

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
          dsflow
          <span style={{ fontSize: 15, color: '#a21caf', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
            · a small config buys a large pile of boilerplate
          </span>
        </motion.h2>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6, fontFamily: 'monospace' }}>
          press <span style={kbd}>dsflow generate</span> · watch the LOC counter
        </div>
      </div>

      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr',
        gap: 14,
      }}>
        {/* Left: input config */}
        <div style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: 12,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px',
            borderBottom: '1px solid #1e293b',
            fontFamily: 'monospace', fontSize: 12, color: '#94a3b8',
          }}>
            <span style={{ color: '#a21caf', fontWeight: 800 }}>●</span>
            tooth-recognition.dsflow.yaml
            <span style={{ marginLeft: 'auto', color: '#fde68a', fontWeight: 700 }}>
              {YAML_LOC} non-empty lines
            </span>
          </div>
          <pre style={{
            flex: 1,
            margin: 0,
            padding: 18,
            color: '#e2e8f0',
            fontFamily: 'monospace',
            fontSize: 14,
            lineHeight: 1.7,
            overflow: 'auto',
          }}>
{YAML.split('\n').map((line, i) => {
  const key = line.match(/^(\s*)([a-z_]+)(:.*)?$/);
  if (key) {
    return (
      <div key={i}>
        <span>{key[1]}</span>
        <span style={{ color: '#67e8f9' }}>{key[2]}</span>
        <span>{key[3] ?? ''}</span>
      </div>
    );
  }
  return <div key={i}>{line}</div>;
})}
          </pre>
        </div>

        {/* Right: live LOC counter */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 16px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: 'monospace', fontSize: 12, color: '#475569',
          }}>
            <span style={{ color: '#22c55e', fontWeight: 800 }}>▸</span>
            generated · tooth-recognition/
            <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>
              {filesGenerated}/{BUCKETS.length} buckets
            </span>
          </div>
          <div style={{
            flex: 1, minHeight: 0, overflow: 'auto', padding: 14,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {BUCKETS.map((b, i) => {
              const v = generated[i];
              const pct = (v / b.loc) * 100;
              const inFlight = i === bucketCursor && running;
              return (
                <div key={b.label}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr auto',
                    fontFamily: 'monospace', fontSize: 12,
                    color: '#0f172a', marginBottom: 4,
                  }}>
                    <span style={{ fontWeight: 700 }}>{b.label}</span>
                    <span style={{ color: b.color, fontWeight: 800 }}>
                      {v} / {b.loc} LOC
                    </span>
                  </div>
                  <div style={{
                    fontSize: 10, color: '#94a3b8', fontFamily: 'monospace',
                    marginBottom: 4,
                  }}>
                    {b.fullPath}
                  </div>
                  <div style={{
                    height: 8, borderRadius: 4,
                    background: '#f1f5f9', overflow: 'hidden',
                    position: 'relative',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: b.color,
                      transition: 'width 0.05s linear',
                      boxShadow: inFlight ? `0 0 8px ${b.color}` : 'none',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{
            padding: '12px 18px',
            background: '#0f172a',
            color: '#e2e8f0',
            display: 'grid',
            gridTemplateColumns: 'auto auto 1fr auto',
            gap: 14, alignItems: 'center',
            fontFamily: 'monospace', fontSize: 13,
          }}>
            <span style={{ color: '#94a3b8' }}>YAML in</span>
            <span style={{ color: '#fde68a', fontWeight: 800 }}>{YAML_LOC}</span>
            <span style={{ textAlign: 'right', color: '#94a3b8' }}>generated</span>
            <span style={{ color: '#86efac', fontWeight: 800, fontSize: 22 }}>
              {generatedTotal.toLocaleString()} LOC
            </span>
            <span style={{ color: '#94a3b8' }}>ratio</span>
            <span style={{ color: '#fda4af', fontWeight: 800 }}>{ratio === 0 ? '—' : `1 : ${ratio}`}</span>
            <span style={{ textAlign: 'right', color: '#94a3b8' }}>of total</span>
            <span style={{ color: '#86efac', fontWeight: 800 }}>
              {Math.round((generatedTotal / TOTAL_OUT) * 100)}%
            </span>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <button
          onClick={start}
          disabled={running}
          style={{
            padding: '10px 18px',
            background: running ? '#e2e8f0' : '#a21caf',
            color: running ? '#94a3b8' : '#ffffff',
            border: 'none', borderRadius: 8,
            fontFamily: 'monospace', fontSize: 13, fontWeight: 800,
            cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          ▶ dsflow generate
        </button>
        <button
          onClick={reset}
          style={{
            padding: '10px 14px',
            background: '#ffffff', color: '#475569',
            border: '1px solid #e2e8f0', borderRadius: 8,
            fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ↺ reset
        </button>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: 12, color: '#86198f', fontFamily: 'monospace', fontStyle: 'italic',
        }}>
          status · alpha · ships as a DSCore plugin · generated code is yours to edit
        </span>
      </div>
    </div>
  );
};

const kbd: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px', margin: '0 2px',
  fontSize: 11, fontFamily: 'monospace',
  background: '#ffffff', border: '1px solid #e2e8f0',
  borderRadius: 4, color: '#475569',
};

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
