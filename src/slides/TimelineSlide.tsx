import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';

/**
 * "Why we built a framework, not a library."
 *
 * Eight LRO services were already in production, each one had
 * copy-pasted ~200 lines of claim / heartbeat / cache / GC plumbing.
 * The plumbing was diverging — three different cache-key formats, two
 * different heartbeat intervals, four different retry policies.
 *
 * This slide shows that pressure as a single visual: a "concerns
 * checklist" with two columns — "you" (the service author) and
 * "postgres-lro" (the framework). The audience clicks each row to see
 * who owned it before postgres-lro existed.
 *
 * No bar chart of years. No services-shipped count. Just the shift in
 * ownership.
 */

interface Concern {
  id: string;
  label: string;
  detail: string;       // what this concern actually requires
  beforeLOC: number;    // rough lines of code per service before
}

const CONCERNS: Concern[] = [
  { id: 'enqueue',     label: 'enqueue + dedup',          beforeLOC: 35,
    detail: 'Insert work row · hash the input · check for a duplicate that is still alive · return existing op or new op.' },
  { id: 'claim',       label: 'claim a work item',        beforeLOC: 28,
    detail: 'SELECT ... FOR UPDATE SKIP LOCKED · update claimed_by, claimed_at, claimed_until · handle the empty result.' },
  { id: 'heartbeat',   label: 'heartbeat / refresh',      beforeLOC: 22,
    detail: 'Periodic UPDATE of claimed_until · stop on context cancel · safe shutdown · prove the worker is still alive.' },
  { id: 'release-ok',  label: 'release on success',       beforeLOC: 18,
    detail: 'Write result blob · transition to done · move row from active to inactive table.' },
  { id: 'release-err', label: 'release on error',         beforeLOC: 24,
    detail: 'Decide retry vs give-up · write error details · respect max-retry · roll back the claim cleanly.' },
  { id: 'expiry',      label: 'claim expiry sweep',       beforeLOC: 26,
    detail: 'Find rows where claimed_until < now() · reset them to queued · count crash retries · expire at the limit.' },
  { id: 'cache',       label: 'request cache',            beforeLOC: 16,
    detail: 'Hash input · find matching non-failed op · short-circuit Compute().' },
  { id: 'gc',          label: 'GC / retention',           beforeLOC: 14,
    detail: 'Background sweep over workitems_inactive · soft-delete past retention · throttle so it does not hammer prod.' },
  { id: 'version',     label: 'version pinning',          beforeLOC: 28,
    detail: 'Workers report their semver on every claim · constraint stored on the work item · only matching workers can claim.' },
  { id: 'metrics',     label: 'metrics + tracing',        beforeLOC: 22,
    detail: 'APM spans across submit / claim / release · per-status gauges · per-version counters · log every state change.' },
];

const TOTAL_BEFORE = CONCERNS.reduce((a, c) => a + c.beforeLOC, 0);
const AFTER = 30; // lines a typical service writes today

export const TimelineSlide: React.FC<SlideProps> = ({ isActive }) => {
  const [open, setOpen] = useState<string | null>('heartbeat');
  if (!isActive) return null;

  const detail = CONCERNS.find(c => c.id === open);

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
          why a framework, not a library
          <span style={{ fontSize: 15, color: '#22c55e', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
            · the same plumbing, copy-pasted eight times
          </span>
        </motion.h2>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6, fontFamily: 'monospace' }}>
          tap a row to see what it actually requires · then look at who owns it today
        </div>
      </div>

      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '1.1fr 1fr',
        gap: 14,
      }}>
        {/* Left: ownership checklist */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          minHeight: 0,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 100px 100px',
            padding: '10px 18px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            fontSize: 11, color: '#475569',
            fontFamily: 'monospace', fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            <div>concern</div>
            <div style={{ textAlign: 'right' }}>before · loc</div>
            <div style={{ textAlign: 'right' }}>now · owned by</div>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {CONCERNS.map(c => {
              const on = c.id === open;
              return (
                <button
                  key={c.id}
                  onClick={() => setOpen(on ? null : c.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 100px 100px',
                    width: '100%',
                    padding: '10px 18px',
                    background: on ? '#ecfdf5' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #f1f5f9',
                    borderLeft: on ? '4px solid #22c55e' : '4px solid transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    alignItems: 'center',
                  }}
                >
                  <span style={{
                    fontFamily: 'monospace', fontSize: 14,
                    color: '#0f172a', fontWeight: on ? 800 : 600,
                  }}>
                    {c.label}
                  </span>
                  <span style={{
                    fontFamily: 'monospace', fontSize: 13,
                    color: '#dc2626', textAlign: 'right', fontWeight: 700,
                  }}>
                    ~{c.beforeLOC}
                  </span>
                  <span style={{
                    fontFamily: 'monospace', fontSize: 12,
                    color: '#16a34a', textAlign: 'right', fontWeight: 700,
                  }}>
                    ✓ framework
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 100px 100px',
            padding: '12px 18px',
            background: '#0f172a',
            color: '#e2e8f0',
            fontSize: 13, fontFamily: 'monospace', fontWeight: 800,
          }}>
            <span>per service</span>
            <span style={{ textAlign: 'right', color: '#fca5a5' }}>~{TOTAL_BEFORE} LOC</span>
            <span style={{ textAlign: 'right', color: '#86efac' }}>~{AFTER} LOC</span>
          </div>
        </div>

        {/* Right: detail panel */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 22,
          minHeight: 0,
          overflow: 'auto',
        }}>
          <div style={{
            fontSize: 11, color: '#475569', fontFamily: 'monospace',
            textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800,
            marginBottom: 14,
          }}>
            what this row actually requires
          </div>
          <AnimatePresence mode="wait">
            {detail && (
              <motion.div
                key={detail.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <div style={{
                  fontSize: 22, fontFamily: 'monospace',
                  color: '#0f172a', fontWeight: 800, marginBottom: 12,
                }}>
                  {detail.label}
                </div>
                <div style={{ fontSize: 16, color: '#334155', lineHeight: 1.55 }}>
                  {detail.detail}
                </div>
                <div style={{
                  marginTop: 18,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                }}>
                  <Pill
                    color="#ef4444"
                    label="before"
                    value={`~${detail.beforeLOC} LOC`}
                    sub="hand-rolled · per service · drifted"
                  />
                  <Pill
                    color="#22c55e"
                    label="now"
                    value="0 LOC"
                    sub="postgres-lro owns this · one impl"
                  />
                </div>
              </motion.div>
            )}
            {!detail && (
              <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                tap a row on the left to see what it took before postgres-lro
              </div>
            )}
          </AnimatePresence>

          <div style={{ flex: 1 }} />

          <div style={{
            marginTop: 18,
            padding: '14px 16px',
            background: '#ecfdf5',
            border: '1px solid #86efac',
            borderRadius: 8,
            fontSize: 13, color: '#065f46', lineHeight: 1.55,
          }}>
            <strong>The shift:</strong> every concern on the left used to be
            re-implemented per service. Now there's one implementation, one set of
            metrics, one set of bugs to fix, and one set of features to extend.
          </div>
        </div>
      </div>
    </div>
  );
};

const Pill: React.FC<{ color: string; label: string; value: string; sub: string }> = ({ color, label, value, sub }) => (
  <div style={{
    padding: '12px 14px',
    background: '#ffffff',
    border: `2px solid ${color}`,
    borderRadius: 10,
  }}>
    <div style={{
      fontSize: 11, color, fontFamily: 'monospace',
      textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800,
    }}>
      {label}
    </div>
    <div style={{
      fontSize: 22, color: '#0f172a', fontFamily: 'monospace', fontWeight: 800, marginTop: 4,
    }}>
      {value}
    </div>
    <div style={{ fontSize: 11, color: '#475569', marginTop: 4, fontStyle: 'italic' }}>
      {sub}
    </div>
  </div>
);
