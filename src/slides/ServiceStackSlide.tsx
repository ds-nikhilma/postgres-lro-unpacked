import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';
import { ArchitectureMini, MiniBox } from '../components/ArchitectureMini';
import { CodeBlock } from '../components/CodeBlock';

/**
 * Slide 2 — "the service stack"
 *
 * Code-as-the-star: a single ~30-line Go integration shown as the visual hero.
 * Step through Repository → Service → Handler → Register, with line highlights
 * on the code, a colored mini-architecture inset that lights up the relevant
 * box, and a plain-English explainer card that updates per step.
 */

// ─── The integration code (the whole slide's hero) ──────────────────

const INTEGRATION_CODE = `package main

import (
    "context"

    "bitbucket.dentsplysirona.com/libgo/postgres-lro/lro"
    longrunningpb "cloud.google.com/go/longrunning/autogen/longrunningpb"
)

func main() {
    ctx := context.Background()

    // 1. Repository — owns the SQL + workitems tables
    repo := &lro.Repository{}
    if err := repo.NewRepository(ctx, cfg); err != nil {
        log.Fatal(err)
    }

    // 2. Service — your business logic plugs in here
    service := lro.NewService(&lro.ServiceConfig{
        Repository:      repo,
        ValidateRequest: myValidator,    // your code
        UnmarshalResult: myUnmarshaller, // your code
    })

    // 3. Handler — the gRPC entry point
    handler := lro.NewHandler(service, nil)

    // 4. Register on your gRPC server — done
    longrunningpb.RegisterOperationsServer(srv, handler)
}`;

// ─── Phases ─────────────────────────────────────────────────────────

type Phase = 'repository' | 'service' | 'handler' | 'register';

interface PhaseStep {
  phase: Phase;
  /** Line numbers (1-based, matching the integration code above) to highlight */
  highlightLines: number[];
  /** Architecture-mini boxes to light up for this step */
  miniHighlight: MiniBox[];
  /** Color for chips + mini-arch (matches the Architecture slide palette) */
  color: string;
  icon: string;
  chipLabel: string;
  /** Plain-English explainer card */
  headline: string;
  detail: string;
}

const STEPS: PhaseStep[] = [
  {
    phase: 'repository',
    highlightLines: [13, 14, 15, 16, 17],
    miniHighlight: ['postgres', 'repository'],
    color: '#f97316',
    icon: '📦',
    chipLabel: '1. Repository',
    headline: 'Repository: owns the SQL and the tables.',
    detail:
      "Pass it your Postgres connection. The package creates and migrates the workitems_active / workitems_inactive tables, and gives you a typed Go API (EnqueueWorkItem, ClaimWorkItem, RefreshClaim, ReleaseWorkItem, …). You never write SQL yourself.",
  },
  {
    phase: 'service',
    highlightLines: [19, 20, 21, 22, 23, 24],
    miniHighlight: ['service', 'repository'],
    color: '#8b5cf6',
    icon: '⚙️',
    chipLabel: '2. Service',
    headline: 'Service: where your business logic plugs in.',
    detail:
      "The Service orchestrates the LRO lifecycle. You provide two callbacks — your domain-specific request validator and result unmarshaller — and the package handles enqueue, cache deduplication, and result delivery. This is the only place you write code specific to your operation.",
  },
  {
    phase: 'handler',
    highlightLines: [26, 27],
    miniHighlight: ['handler', 'service'],
    color: '#3b82f6',
    icon: '🔌',
    chipLabel: '3. Handler',
    headline: 'Handler: the gRPC entry point.',
    detail:
      "The Handler implements the standard google.longrunning.Operations gRPC interface. Your clients call Compute(), GetOperation(), CancelOperation() — all of it is routed through here. Optional hooks (e.g. OnAfterReleaseOnSuccess) let you inject custom behavior at key lifecycle points.",
  },
  {
    phase: 'register',
    highlightLines: [29, 30],
    miniHighlight: ['client', 'handler', 'service', 'repository', 'postgres'],
    color: '#22c55e',
    icon: '✅',
    chipLabel: '4. Register & run',
    headline: 'Register it on your gRPC server — done.',
    detail:
      "One line wires the LRO handler into your existing gRPC server. From this point on, clients can submit long-running operations and poll for results. ~20 lines of integration, total.",
  },
];

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 5px',
  margin: '0 2px',
  fontSize: 10,
  fontFamily: 'monospace',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 3,
  color: '#334155',
};

// ─── Main slide ─────────────────────────────────────────────────────

export const ServiceStackSlide: React.FC<SlideProps> = ({ isActive, goToSlide }) => {
  // -1 = idle (intro state), otherwise index of last fired step
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [zoomPulse, setZoomPulse] = useState(true);
  const currentStepIdxRef = useRef(-1);
  currentStepIdxRef.current = currentStepIdx;

  const fireStep = useCallback((i: number) => {
    if (i < 0 || i >= STEPS.length) return;
    setCurrentStepIdx(i);
    currentStepIdxRef.current = i;
  }, []);

  const runAll = useCallback(() => fireStep(0), [fireStep]);

  const stepForward = useCallback(() => {
    const next = currentStepIdxRef.current + 1;
    if (next < STEPS.length) fireStep(next);
  }, [fireStep]);

  const reset = useCallback(() => {
    setCurrentStepIdx(-1);
    currentStepIdxRef.current = -1;
  }, []);

  const jumpToPhase = useCallback((p: Phase) => {
    const idx = STEPS.findIndex(s => s.phase === p);
    if (idx >= 0) fireStep(idx);
  }, [fireStep]);

  // Keyboard shortcuts (capture-phase so we win over App's slide-nav)
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const key = e.key;
      const idx = currentStepIdxRef.current;
      const atEnd = idx >= STEPS.length - 1;
      const atStart = idx < 0;

      if (key === ' ' || key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown') {
        if (!atEnd) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (atStart) runAll();
          else stepForward();
        }
        return;
      }
      if (key === 'r' || key === 'R') {
        e.preventDefault();
        e.stopImmediatePropagation();
        runAll();
        return;
      }
      if (key === 'Escape' || key === '0') {
        e.preventDefault();
        e.stopImmediatePropagation();
        reset();
        return;
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true } as any);
  }, [isActive, runAll, stepForward, reset]);

  // Reset on slide deactivate
  useEffect(() => {
    if (!isActive) reset();
  }, [isActive, reset]);

  // Zoom-in cue on slide enter
  useEffect(() => {
    if (!isActive) return;
    setZoomPulse(true);
    const t = setTimeout(() => setZoomPulse(false), 1600);
    return () => clearTimeout(t);
  }, [isActive]);

  if (!isActive) return null;

  const isAtEnd = currentStepIdx >= STEPS.length - 1;
  const isAtStart = currentStepIdx < 0;
  const currentStep = currentStepIdx >= 0 ? STEPS[currentStepIdx] : null;
  const highlightLines = currentStep ? currentStep.highlightLines : [];
  // For the mini-architecture: while stepping, show only the current step's
  // boxes; while idle, show all three boilerplate layers as the slide's focus.
  const miniHighlight: MiniBox[] = currentStep
    ? currentStep.miniHighlight
    : ['handler', 'service', 'repository'];

  const phaseState = (p: Phase): 'pending' | 'active' | 'done' => {
    if (isAtStart) return 'pending';
    const idx = STEPS.findIndex(s => s.phase === p);
    if (currentStepIdx < idx) return 'pending';
    if (currentStepIdx === idx) return 'active';
    return 'done';
  };

  const ctrlBtn = (label: string, onClick: () => void, opts: { color?: string; disabled?: boolean; primary?: boolean } = {}) => (
    <motion.button
      whileHover={opts.disabled ? undefined : { scale: 1.05 }}
      whileTap={opts.disabled ? undefined : { scale: 0.95 }}
      onClick={onClick}
      disabled={opts.disabled}
      style={{
        padding: '7px 14px',
        borderRadius: 8,
        border: `2px solid ${opts.disabled ? '#e2e8f0' : (opts.color || '#475569')}`,
        background: opts.disabled ? '#f8fafc' : opts.primary ? `${opts.color || '#22c55e'}20` : 'transparent',
        color: opts.disabled ? '#94a3b8' : (opts.color || '#334155'),
        cursor: opts.disabled ? 'not-allowed' : 'pointer',
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'monospace',
      }}
    >{label}</motion.button>
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '24px 36px',
      gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div>
            <motion.h2
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0 }}
            >
              the service stack
              <span style={{ fontSize: 15, color: '#8b5cf6', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
                · zoom in · your complete integration in ~20 lines
              </span>
            </motion.h2>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
              this is everything you write to use postgres-lro. step through to see what each block sets up.
            </div>
          </div>
          <ArchitectureMini
            highlight={miniHighlight}
            pulse={zoomPulse}
            onClick={goToSlide ? () => goToSlide('Architecture') : undefined}
            caption="you are here"
            subcaption="the gRPC stack"
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', marginRight: 4 }}>
            step {Math.max(currentStepIdx + 1, 0)} / {STEPS.length}
          </span>
          {isAtStart
            ? ctrlBtn('▶ run flow', runAll, { color: '#8b5cf6', primary: true })
            : isAtEnd
              ? ctrlBtn('↻ restart', runAll, { color: '#8b5cf6', primary: true })
              : ctrlBtn('step →', stepForward, { color: '#22c55e', primary: true })}
          {ctrlBtn('reset', reset, { color: '#475569', disabled: isAtStart })}
        </div>
      </div>

      {/* Phase chips */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {STEPS.map((s, i) => {
          const state = phaseState(s.phase);
          const isActive = state === 'active';
          const isDone = state === 'done';
          const bg = isActive ? `${s.color}25` : isDone ? `${s.color}10` : '#f8fafc';
          const border = isActive ? s.color : isDone ? `${s.color}60` : '#e2e8f0';
          const textColor = isActive ? s.color : isDone ? `${s.color}aa` : '#475569';
          return (
            <React.Fragment key={s.phase}>
              <motion.button
                onClick={() => jumpToPhase(s.phase)}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                animate={isActive ? { scale: [1, 1.03, 1] } : { scale: 1 }}
                transition={isActive ? { repeat: Infinity, duration: 1.5 } : { duration: 0.2 }}
                title={`Jump to ${s.chipLabel}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 16px',
                  borderRadius: 999,
                  background: bg,
                  border: `2px solid ${border}`,
                  fontSize: 14,
                  fontWeight: 700,
                  color: textColor,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 16 }}>{isDone ? '✓' : s.icon}</span>
                <span>{s.chipLabel}</span>
              </motion.button>
              {i < STEPS.length - 1 && (
                <span style={{ color: '#cbd5e1', fontSize: 16 }}>→</span>
              )}
            </React.Fragment>
          );
        })}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#475569', fontFamily: 'monospace' }} title="Keyboard shortcuts">
          <kbd style={kbdStyle}>Space</kbd> next ·{' '}
          <kbd style={kbdStyle}>R</kbd> restart ·{' '}
          <kbd style={kbdStyle}>Esc</kbd> reset
        </span>
      </div>

      {/* Code (the visual hero) — fills available height */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <CodeBlock
          code={INTEGRATION_CODE}
          language="go"
          title="main.go — your complete integration"
          highlightLines={highlightLines}
          fontSize={15}
        />
      </div>

      {/* Plain-English explainer for the current step */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep?.phase ?? 'idle'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          style={{
            padding: '14px 20px',
            background: currentStep ? `${currentStep.color}10` : '#fbbf2410',
            border: `1.5px solid ${currentStep ? `${currentStep.color}60` : '#fbbf2440'}`,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span style={{ fontSize: 30, flexShrink: 0 }}>
            {currentStep ? currentStep.icon : '💡'}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            {currentStep ? (
              <>
                <div style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: currentStep.color,
                  fontFamily: 'monospace',
                  marginBottom: 4,
                }}>
                  {currentStep.chipLabel.replace(/^\d+\.\s*/, '').toLowerCase()}
                </div>
                <div style={{ fontSize: 16, color: '#0f172a', lineHeight: 1.45, fontWeight: 600 }}>
                  {currentStep.headline}
                </div>
                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55, marginTop: 4 }}>
                  {currentStep.detail}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#d97706', fontFamily: 'monospace', marginBottom: 4 }}>
                  the takeaway
                </div>
                <div style={{ fontSize: 15, color: '#0f172a', lineHeight: 1.5, fontWeight: 500 }}>
                  This is the whole integration. ~20 lines of Go wires up the entire long-running-operations machinery — claim, heartbeat, release, retries, durable storage, deduplication. You write the two callbacks (validator + unmarshaller). The package does the rest.
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 5 }}>
                  press <kbd style={kbdStyle}>Space</kbd> or click <strong>▶ run flow</strong> to walk through it block by block — or jump straight to a phase above.
                </div>
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
