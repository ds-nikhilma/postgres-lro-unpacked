import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { SlideProps } from '../types';

/**
 * DSFlow: a CLI that scaffolds a complete postgres-lro service from a
 * single YAML config. The slide visualizes the input config on one side,
 * and the file tree it generates on the other — with a stepper that
 * "produces" the files in order.
 */

interface GenStep {
  label: string;
  files: string[];   // paths added at this step
}

const STEPS: GenStep[] = [
  { label: 'parse config',         files: [] },
  { label: 'generate protos',      files: ['api/v1/service.proto', 'api/v1/internal.proto'] },
  { label: 'scaffold service',     files: ['cmd/service/main.go', 'internal/handler.go', 'internal/validator.go'] },
  { label: 'scaffold worker',      files: ['cmd/worker/main.go', 'internal/runner.go'] },
  { label: 'add infra',            files: ['infra/cloudbuild.yaml', 'infra/skaffold.yaml', 'infra/db/schema.sql'] },
  { label: 'add tests + CI',       files: ['internal/handler_test.go', '.github/workflows/ci.yml'] },
];

const ALL_FILES = STEPS.flatMap(s => s.files);

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

export const DSFlowSlide: React.FC<SlideProps> = ({ isActive }) => {
  const [step, setStep] = useState(0);
  if (!isActive) return null;

  const producedSoFar = new Set<string>();
  for (let i = 0; i <= step; i++) {
    STEPS[i].files.forEach(f => producedSoFar.add(f));
  }

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
          dsflow
          <span style={{ fontSize: 15, color: '#a21caf', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
            · zero → dev prototype in minutes
          </span>
        </motion.h2>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6, fontFamily: 'monospace' }}>
          one YAML config · click <strong>generate ▶</strong> to scaffold a complete service
        </div>
      </div>

      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 14,
        minHeight: 0,
      }}>
        {/* YAML config */}
        <div style={{
          background: '#0f172a',
          borderRadius: 12,
          border: '1px solid #334155',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '10px 16px',
            background: '#1e293b',
            color: '#94a3b8',
            fontSize: 12, fontFamily: 'monospace',
            borderBottom: '1px solid #334155',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: '#a21caf', fontWeight: 800 }}>●</span>
            tooth-recognition.dsflow.yaml
            <span style={{ marginLeft: 'auto', color: '#475569' }}>input</span>
          </div>
          <pre style={{
            flex: 1,
            margin: 0,
            padding: 18,
            color: '#e2e8f0',
            fontSize: 14,
            lineHeight: 1.7,
            fontFamily: 'monospace',
            overflow: 'auto',
          }}>
{YAML.split('\n').map((line, i) => {
  const colored =
    line.match(/^[a-z_]+:/) ? <><span style={{ color: '#67e8f9' }}>{line.match(/^[a-z_]+/)?.[0]}</span>{line.slice(line.indexOf(':'))}</>
    : line.match(/^\s+[a-z_]+:/) ? <><span style={{ color: '#93c5fd' }}>{line.match(/^\s+([a-z_]+)/)?.[1] ? line.slice(0, line.indexOf(':')) : line}</span>{line.slice(line.indexOf(':'))}</>
    : line;
  return <div key={i}>{colored}</div>;
})}
          </pre>
        </div>

        {/* Output file tree */}
        <div style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '10px 16px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12, fontFamily: 'monospace', color: '#475569',
          }}>
            <span style={{ color: '#22c55e', fontWeight: 800 }}>▸</span>
            tooth-recognition/
            <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>
              generated · {producedSoFar.size} / {ALL_FILES.length} files
            </span>
          </div>
          <div style={{
            flex: 1, overflow: 'auto', padding: 14,
            fontFamily: 'monospace', fontSize: 13, lineHeight: 1.85,
          }}>
            {ALL_FILES.map(f => {
              const there = producedSoFar.has(f);
              return (
                <motion.div
                  key={f}
                  animate={{
                    opacity: there ? 1 : 0.25,
                    color: there ? '#0f172a' : '#94a3b8',
                  }}
                  transition={{ duration: 0.3 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <span style={{ color: there ? '#22c55e' : '#cbd5e1', fontWeight: 800 }}>
                    {there ? '✓' : '·'}
                  </span>
                  <span>{f}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div style={{
        padding: '14px 18px',
        background: '#fdf4ff',
        border: '1px solid #f5d0fe',
        borderRadius: 12,
        display: 'flex', alignItems: 'center', gap: 12,
        flexWrap: 'wrap',
      }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s.label}>
            <motion.div
              animate={{
                background: i <= step ? '#a21caf' : '#ffffff',
                color: i <= step ? '#ffffff' : '#475569',
                borderColor: i <= step ? '#a21caf' : '#e9d5ff',
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: '1px solid',
                fontSize: 12,
                fontFamily: 'monospace',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {i + 1}. {s.label}
            </motion.div>
            {i < STEPS.length - 1 && (
              <div style={{ width: 12, height: 2, background: i < step ? '#a21caf' : '#e9d5ff' }} />
            )}
          </React.Fragment>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
          disabled={step === STEPS.length - 1}
          style={{
            padding: '8px 16px',
            background: step === STEPS.length - 1 ? '#e9d5ff' : '#a21caf',
            color: step === STEPS.length - 1 ? '#86198f' : '#ffffff',
            border: 'none', borderRadius: 8,
            cursor: step === STEPS.length - 1 ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
          }}
        >
          generate ▶
        </button>
        <button
          onClick={() => setStep(0)}
          style={{
            padding: '8px 12px',
            background: 'transparent',
            color: '#86198f',
            border: '1px solid #f5d0fe', borderRadius: 8,
            fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ↺ reset
        </button>
      </div>

      <div style={{
        padding: '10px 14px',
        background: '#fdf4ff',
        border: '1px solid #f5d0fe',
        borderRadius: 8,
        fontSize: 13,
        color: '#86198f',
      }}>
        💡 Status: alpha, under active development. Will ship as a DSCore CLI plugin. Generated code is yours — edit freely.
      </div>
    </div>
  );
};
