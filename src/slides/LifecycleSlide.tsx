import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';
import { StatusBadge } from '../components/StatusBadge';

// ─── Types ───────────────────────────────────────────────────────────

type Phase = 'idle' | 'enqueued' | 'claiming' | 'running' | 'heartbeat1' | 'heartbeat2' | 'releasing' | 'done';

interface ActiveRow {
  id: string;
  status: string;
  claimed_by: string;
  claimed_until: string;
  claimed_count: number;
  progress: number;
}

interface InactiveRow {
  id: string;
  status: string;
  claimed_by: string;
  output_data: string;
  finished_at: string;
}

const stepInfo: Record<Phase, { num: number; title: string; desc: string; status: string }> = {
  idle:       { num: 0, title: 'Ready', desc: 'Click "Submit Request" to start the LRO lifecycle', status: '' },
  enqueued:   { num: 1, title: 'Client calls Compute()', desc: 'Request validated, work item inserted into workitems_active with status "queued"', status: 'queued' },
  claiming:   { num: 2, title: 'Worker calls ClaimWorkItem()', desc: 'Using FOR UPDATE SKIP LOCKED, a worker atomically claims the oldest queued item', status: 'queued' },
  running:    { num: 2, title: 'Worker claims the item', desc: 'Status changes to "running", claimed_by is set, claimed_until is set to NOW() + 300s', status: 'running' },
  heartbeat1: { num: 3, title: 'Worker processes + heartbeat', desc: 'Worker is computing. RefreshClaim() extends claimed_until (heartbeat #1)', status: 'running' },
  heartbeat2: { num: 3, title: 'Still processing + heartbeat', desc: 'Another RefreshClaim() extends the claim window again (heartbeat #2)', status: 'running' },
  releasing:  { num: 4, title: 'Worker calls ReleaseOnSuccess()', desc: 'Task complete! Work item moves from workitems_active → workitems_inactive', status: 'running' },
  done:       { num: 4, title: 'Operation complete', desc: 'Result stored in output_data. Client can call GetOperation() to retrieve it.', status: 'done' },
};

const allSteps = [
  { num: 1, label: 'Enqueue' },
  { num: 2, label: 'Claim' },
  { num: 3, label: 'Process' },
  { num: 4, label: 'Release' },
];

export const LifecycleSlide: React.FC<SlideProps> = ({ isActive }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [activeRow, setActiveRow] = useState<ActiveRow | null>(null);
  const [inactiveRow, setInactiveRow] = useState<InactiveRow | null>(null);
  const [progress, setProgress] = useState(0);
  const phaseRef = useRef(phase);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  phaseRef.current = phase;

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const runLifecycle = useCallback(() => {
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'done') return;

    setInactiveRow(null);
    setProgress(0);

    // Step 1: Enqueue
    setPhase('enqueued');
    setActiveRow({
      id: 'a1b2c3d4',
      status: 'queued',
      claimed_by: '—',
      claimed_until: '—',
      claimed_count: 0,
      progress: 0,
    });

    // Step 2: Claiming
    timerRef.current = setTimeout(() => {
      setPhase('claiming');

      timerRef.current = setTimeout(() => {
        setPhase('running');
        setActiveRow(prev => prev ? {
          ...prev,
          status: 'running',
          claimed_by: 'worker-pod-7x9k',
          claimed_until: '10:35:00',
          claimed_count: 1,
        } : null);

        // Step 3: Processing with heartbeats
        let prog = 0;
        const progressInterval = setInterval(() => {
          prog += 1;
          setProgress(Math.min(prog, 100));

          if (prog >= 40 && phaseRef.current === 'running') {
            setPhase('heartbeat1');
            setActiveRow(prev => prev ? { ...prev, claimed_until: '10:37:30' } : null);
          }
          if (prog >= 75 && phaseRef.current === 'heartbeat1') {
            setPhase('heartbeat2');
            setActiveRow(prev => prev ? { ...prev, claimed_until: '10:40:00' } : null);
          }

          if (prog >= 100) {
            clearInterval(progressInterval);
            // Step 4: Release
            setPhase('releasing');
            timerRef.current = setTimeout(() => {
              setPhase('done');
              setActiveRow(null);
              setInactiveRow({
                id: 'a1b2c3d4',
                status: 'done',
                claimed_by: 'worker-pod-7x9k',
                output_data: '<Result>',
                finished_at: '10:32:18',
              });
            }, 2500);
          }
        }, 200);
      }, 2000);
    }, 3000);
  }, [clearTimers]);

  // Reset on deactivate
  useEffect(() => {
    if (!isActive) {
      clearTimers();
      setPhase('idle');
      setActiveRow(null);
      setInactiveRow(null);
      setProgress(0);
    }
  }, [isActive, clearTimers]);

  if (!isActive) return null;

  const info = stepInfo[phase];
  const currentStepNum = info.num;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '30px 50px',
      gap: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <motion.h2
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ fontSize: 30, fontWeight: 700, color: '#e2e8f0', margin: 0 }}
        >
          The LRO Lifecycle
        </motion.h2>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={runLifecycle}
          disabled={phase !== 'idle' && phase !== 'done'}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            border: '2px solid #22c55e',
            background: phase !== 'idle' && phase !== 'done' ? '#334155' : '#22c55e20',
            color: phase !== 'idle' && phase !== 'done' ? '#64748b' : '#22c55e',
            cursor: phase !== 'idle' && phase !== 'done' ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'monospace',
          }}
        >
          {phase === 'idle' ? '▶ Submit Request' : phase === 'done' ? '▶ Run Again' : '● Running...'}
        </motion.button>
      </div>

      {/* Step indicators */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {allSteps.map((step, i) => (
          <React.Fragment key={step.num}>
            <div style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: step.num === currentStepNum
                ? '2px solid #3b82f6'
                : step.num < currentStepNum
                ? '1px solid #22c55e40'
                : '1px solid #334155',
              background: step.num === currentStepNum
                ? '#3b82f620'
                : step.num < currentStepNum
                ? '#22c55e10'
                : '#1e293b',
              color: step.num === currentStepNum
                ? '#93c5fd'
                : step.num < currentStepNum
                ? '#22c55e'
                : '#64748b',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'monospace',
              transition: 'all 0.3s',
            }}>
              {step.num < currentStepNum ? '✓ ' : ''}{step.label}
            </div>
            {i < allSteps.length - 1 && (
              <div style={{
                width: 30,
                height: 2,
                background: step.num < currentStepNum ? '#22c55e' : '#334155',
                transition: 'background 0.3s',
              }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Current step info */}
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'center',
            padding: '14px 20px',
            background: '#1e293b',
            borderRadius: 12,
            border: '1px solid #334155',
          }}
        >
          {info.status && <StatusBadge status={info.status} size="lg" pulse={info.status === 'running'} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#e2e8f0' }}>{info.title}</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4, lineHeight: 1.5 }}>{info.desc}</div>
          </div>

          {/* Processing progress */}
          {(phase === 'running' || phase === 'heartbeat1' || phase === 'heartbeat2') && (
            <div style={{ width: 120, textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace' }}>
                {progress}%
              </div>
              <div style={{
                width: '100%',
                height: 6,
                background: '#334155',
                borderRadius: 3,
                overflow: 'hidden',
                marginTop: 4,
              }}>
                <motion.div
                  animate={{ width: `${progress}%` }}
                  style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Database tables */}
      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
        {/* Active table */}
        <div style={{
          flex: 1,
          background: '#1e293b',
          borderRadius: 10,
          border: '1px solid #334155',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '8px 14px',
            background: '#0f172a',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
            <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>
              workitems_active
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#475569', marginLeft: 'auto' }}>
              {activeRow ? '1 row' : '0 rows'}
            </span>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
              <thead>
                <tr>
                  {['id', 'status', 'claimed_by', 'claimed_until', 'count'].map(col => (
                    <th key={col} style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      color: '#475569',
                      fontWeight: 500,
                      borderBottom: '1px solid #334155',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {activeRow && (
                    <motion.tr
                      key="active-row"
                      initial={{ opacity: 0, backgroundColor: 'rgba(59, 130, 246, 0.3)' }}
                      animate={{ opacity: 1, backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                      exit={{ opacity: 0, x: 40, transition: { duration: 0.5 } }}
                    >
                      <td style={{ padding: '8px 12px', color: '#cbd5e1' }}>{activeRow.id}...</td>
                      <td style={{ padding: '8px 12px' }}>
                        <motion.span
                          key={activeRow.status}
                          initial={{ scale: 1.3 }}
                          animate={{ scale: 1 }}
                          style={{
                            color: activeRow.status === 'queued' ? '#fbbf24' :
                                   activeRow.status === 'running' ? '#3b82f6' : '#94a3b8',
                            fontWeight: 700,
                          }}
                        >
                          {activeRow.status}
                        </motion.span>
                      </td>
                      <td style={{ padding: '8px 12px', color: activeRow.claimed_by !== '—' ? '#93c5fd' : '#475569' }}>
                        {activeRow.claimed_by}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <motion.span
                          key={activeRow.claimed_until}
                          initial={{ color: '#fbbf24' }}
                          animate={{ color: activeRow.claimed_until !== '—' ? '#8b5cf6' : '#475569' }}
                          transition={{ duration: 1 }}
                        >
                          {activeRow.claimed_until}
                        </motion.span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{activeRow.claimed_count}</td>
                    </motion.tr>
                  )}
                </AnimatePresence>
                {!activeRow && (
                  <tr>
                    <td colSpan={5} style={{
                      padding: '24px 12px',
                      textAlign: 'center',
                      color: phase === 'done' ? '#22c55e50' : '#334155',
                      fontStyle: 'italic',
                      fontSize: 12,
                    }}>
                      {phase === 'done' ? 'Item moved to inactive table ↓' : 'No active items'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Arrow between tables */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}>
          <AnimatePresence>
            {phase === 'releasing' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
              >
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  style={{ fontSize: 24, color: '#22c55e' }}
                >
                  ↓
                </motion.div>
                <span style={{ fontSize: 10, color: '#22c55e', fontFamily: 'monospace', fontWeight: 600 }}>
                  MOVE
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Inactive table */}
        <div style={{
          flex: 1,
          background: '#1e293b',
          borderRadius: 10,
          border: '1px solid #334155',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '8px 14px',
            background: '#0f172a',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>
              workitems_inactive
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#475569', marginLeft: 'auto' }}>
              {inactiveRow ? '1 row' : '0 rows'}
            </span>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
              <thead>
                <tr>
                  {['id', 'status', 'claimed_by', 'output_data', 'finished_at'].map(col => (
                    <th key={col} style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      color: '#475569',
                      fontWeight: 500,
                      borderBottom: '1px solid #334155',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {inactiveRow && (
                    <motion.tr
                      key="inactive-row"
                      initial={{ opacity: 0, backgroundColor: 'rgba(34, 197, 94, 0.3)' }}
                      animate={{ opacity: 1, backgroundColor: 'rgba(34, 197, 94, 0.05)' }}
                    >
                      <td style={{ padding: '8px 12px', color: '#cbd5e1' }}>{inactiveRow.id}...</td>
                      <td style={{ padding: '8px 12px', color: '#22c55e', fontWeight: 700 }}>{inactiveRow.status}</td>
                      <td style={{ padding: '8px 12px', color: '#93c5fd' }}>{inactiveRow.claimed_by}</td>
                      <td style={{ padding: '8px 12px', color: '#86efac' }}>{inactiveRow.output_data}</td>
                      <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{inactiveRow.finished_at}</td>
                    </motion.tr>
                  )}
                </AnimatePresence>
                {!inactiveRow && (
                  <tr>
                    <td colSpan={5} style={{
                      padding: '24px 12px',
                      textAlign: 'center',
                      color: '#334155',
                      fontStyle: 'italic',
                      fontSize: 12,
                    }}>
                      Completed items will appear here
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Heartbeat indicator */}
      <AnimatePresence>
        {(phase === 'heartbeat1' || phase === 'heartbeat2') && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              padding: '10px 20px',
              background: '#8b5cf615',
              border: '1px solid #8b5cf630',
              borderRadius: 10,
              textAlign: 'center',
              fontSize: 13,
              color: '#c4b5fd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <motion.span
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
            >
              💓
            </motion.span>
            RefreshClaim() — claimed_until extended to {phase === 'heartbeat1' ? '10:37:30' : '10:40:00'}
            <span style={{ color: '#64748b', fontSize: 11 }}>
              (heartbeat #{phase === 'heartbeat1' ? '1' : '2'})
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Done message */}
      <AnimatePresence>
        {phase === 'done' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: '10px 20px',
              background: '#22c55e15',
              border: '1px solid #22c55e30',
              borderRadius: 10,
              textAlign: 'center',
              fontSize: 13,
              color: '#86efac',
            }}
          >
            ✅ Complete! Item moved from active → inactive. Client can now call GetOperation() to retrieve the result.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
