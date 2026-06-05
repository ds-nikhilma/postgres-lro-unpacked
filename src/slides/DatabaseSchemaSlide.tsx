import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';
import { ArchitectureMini } from '../components/ArchitectureMini';

// ─── Schema data ─────────────────────────────────────────────────────

type ColRole = 'identity' | 'status' | 'claim' | 'data' | 'lifecycle';

interface Column {
  name: string;
  type: string;
  /** Plain-English purpose — shown by default */
  description: string;
  /** Which conceptual group this column belongs to */
  role: ColRole;
  highlight?: boolean;
}

const ROLE_META: Record<ColRole, { label: string; color: string }> = {
  identity:  { label: 'identity',  color: '#475569' },
  status:    { label: 'status',    color: '#fbbf24' },
  claim:     { label: 'claim',     color: '#f43f5e' },
  data:      { label: 'data',      color: '#8b5cf6' },
  lifecycle: { label: 'lifecycle', color: '#06b6d4' },
};

const ROLE_ORDER: ColRole[] = ['identity', 'status', 'claim', 'data', 'lifecycle'];

const activeColumns: Column[] = [
  { name: 'id',              type: 'uuid PK',          role: 'identity', highlight: true,
    description: 'Unique identifier — the "name" the client polls with' },
  { name: 'cache_key',       type: 'text',             role: 'identity',
    description: 'Optional dedup key — same key returns the same job' },
  { name: 'status',          type: 'workitem_status',  role: 'status',   highlight: true,
    description: 'queued · running · done · failed · canceled' },
  { name: 'claimed_by',      type: 'text',             role: 'claim',    highlight: true,
    description: 'Which worker currently holds the claim' },
  { name: 'claimed_at',      type: 'timestamp',        role: 'claim',
    description: 'When the current worker picked it up' },
  { name: 'claimed_count',   type: 'integer',          role: 'claim',    highlight: true,
    description: 'How many workers have grabbed it (for retry limiting)' },
  { name: 'claimed_until',   type: 'timestamp',        role: 'claim',    highlight: true,
    description: 'When the claim expires — extended by each heartbeat' },
  { name: 'compute_request', type: 'bytea',            role: 'data',
    description: 'The serialized request payload (your input)' },
  { name: 'metadata_jsonb',  type: 'jsonb',            role: 'data',
    description: 'Tracer context, account id, request metadata' },
  { name: 'version',         type: 'text',             role: 'data',
    description: 'Worker version that should handle this job' },
  { name: 'created_at',      type: 'timestamp',        role: 'lifecycle',
    description: 'When the job was first enqueued' },
  { name: 'expires_at',      type: 'timestamp',        role: 'lifecycle',
    description: 'Hard deadline — give up after this point' },
];

const inactiveColumns: Column[] = [
  { name: 'id',              type: 'uuid PK',          role: 'identity', highlight: true,
    description: 'Same id as in the active table (same job)' },
  { name: 'cache_key',       type: 'text',             role: 'identity',
    description: 'Dedup key — kept for repeat lookups' },
  { name: 'status',          type: 'workitem_status',  role: 'status',   highlight: true,
    description: 'done · failed · canceled · expired · deleted' },
  { name: 'output_data',     type: 'bytea',            role: 'data',     highlight: true,
    description: 'The result payload — or the error, if it failed' },
  { name: 'compute_request', type: 'bytea',            role: 'data',
    description: 'Original request, kept for audit/retry' },
  { name: 'metadata_jsonb',  type: 'jsonb',            role: 'data',
    description: 'Tracer context, account id, request metadata' },
  { name: 'version',         type: 'text',             role: 'data',
    description: 'Worker version that handled this job' },
  { name: 'created_at',      type: 'timestamp',        role: 'lifecycle',
    description: 'When the job was first enqueued' },
  { name: 'finished_at',     type: 'timestamp',        role: 'lifecycle', highlight: true,
    description: 'When the job finished (done, failed, canceled)' },
  { name: 'deleted_at',      type: 'timestamp',        role: 'lifecycle',
    description: 'Soft-delete timestamp (for cleanup)' },
];

// ─── Sample data at each lifecycle stage ─────────────────────────────

interface SampleRow {
  [key: string]: string;
}

const lifecycleStages: { label: string; color: string; icon: string; activeRow: SampleRow | null; inactiveRow: SampleRow | null; highlight: string[]; narration: string }[] = [
  {
    label: 'Queued', color: '#fbbf24', icon: '📥',
    narration: 'Job was just inserted. No worker has touched it yet.',
    activeRow: {
      id: 'a1b2c3d4…', status: 'queued', created_at: '10:30:01',
      compute_request: '<bytes>', metadata_jsonb: '{"trace":…}',
      claimed_at: 'NULL', claimed_count: '0', claimed_until: 'NULL',
      claimed_by: 'NULL', expires_at: '2024-04-16', cache_key: 'hash-x7f',
      version: '1.2.0',
    },
    inactiveRow: null,
    highlight: ['status', 'claimed_by', 'claimed_count'],
  },
  {
    label: 'Running', color: '#3b82f6', icon: '🔒',
    narration: 'A worker just claimed it. claimed_by, claimed_at, and claimed_until are set.',
    activeRow: {
      id: 'a1b2c3d4…', status: 'running', created_at: '10:30:01',
      compute_request: '<bytes>', metadata_jsonb: '{"trace":…}',
      claimed_at: '10:30:05', claimed_count: '1', claimed_until: '10:35:05',
      claimed_by: 'worker-pod-7x9k', expires_at: '2024-04-16', cache_key: 'hash-x7f',
      version: '1.2.0',
    },
    inactiveRow: null,
    highlight: ['status', 'claimed_at', 'claimed_until', 'claimed_by', 'claimed_count'],
  },
  {
    label: 'Heartbeat', color: '#8b5cf6', icon: '💓',
    narration: 'Worker sent a heartbeat. Only claimed_until moves forward — everything else is unchanged.',
    activeRow: {
      id: 'a1b2c3d4…', status: 'running', created_at: '10:30:01',
      compute_request: '<bytes>', metadata_jsonb: '{"trace":…}',
      claimed_at: '10:30:05', claimed_count: '1', claimed_until: '10:37:35',
      claimed_by: 'worker-pod-7x9k', expires_at: '2024-04-16', cache_key: 'hash-x7f',
      version: '1.2.0',
    },
    inactiveRow: null,
    highlight: ['claimed_until'],
  },
  {
    label: 'Done', color: '#22c55e', icon: '✅',
    narration: 'Worker finished successfully. The row moved from active to inactive — output_data holds the result.',
    activeRow: null,
    inactiveRow: {
      id: 'a1b2c3d4…', status: 'done', created_at: '10:30:01',
      compute_request: '<bytes>', metadata_jsonb: '{"trace":…}',
      output_data: '<Result>', finished_at: '10:32:18',
      deleted_at: 'NULL', cache_key: 'hash-x7f', version: '1.2.0',
    },
    highlight: ['status', 'output_data', 'finished_at'],
  },
  {
    label: 'Failed', color: '#ef4444', icon: '❌',
    narration: 'Worker reported an error. output_data holds the serialized error status.',
    activeRow: null,
    inactiveRow: {
      id: 'a1b2c3d4…', status: 'failed', created_at: '10:30:01',
      compute_request: '<bytes>', metadata_jsonb: '{"trace":…}',
      output_data: '<ErrorStatus>', finished_at: '10:31:45',
      deleted_at: 'NULL', cache_key: 'hash-x7f', version: '1.2.0',
    },
    highlight: ['status', 'output_data'],
  },
];

// ─── Component ───────────────────────────────────────────────────────

export const DatabaseSchemaSlide: React.FC<SlideProps> = ({ isActive, goToSlide }) => {
  const [selectedStage, setSelectedStage] = useState(0);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);
  const [showTypes, setShowTypes] = useState(false);
  const [showAux, setShowAux] = useState(false);
  const [zoomPulse, setZoomPulse] = useState(true);

  useEffect(() => {
    if (!isActive) {
      setSelectedStage(0);
      setShowTypes(false);
      setShowAux(false);
    }
  }, [isActive]);

  // Zoom cue: pulse the mini-architecture briefly when the slide opens
  useEffect(() => {
    if (!isActive) return;
    setZoomPulse(true);
    const t = setTimeout(() => setZoomPulse(false), 1600);
    return () => clearTimeout(t);
  }, [isActive]);

  if (!isActive) return null;

  const stage = lifecycleStages[selectedStage];

  // Group columns by role, preserving in-role declaration order
  const groupColumns = (cols: Column[]) => {
    const map = new Map<ColRole, Column[]>();
    ROLE_ORDER.forEach(r => map.set(r, []));
    cols.forEach(c => map.get(c.role)!.push(c));
    return ROLE_ORDER
      .map(r => ({ role: r, columns: map.get(r) || [] }))
      .filter(g => g.columns.length > 0);
  };

  const renderTable = (
    title: string,
    subtitle: string,
    columns: Column[],
    row: SampleRow | null,
    titleColor: string,
    highlightFields: string[],
  ) => {
    const grouped = groupColumns(columns);
    return (
      <div style={{
        flex: 1,
        background: '#f8fafc',
        borderRadius: 10,
        border: `1px solid ${titleColor}30`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}>
        <div style={{
          padding: '14px 18px',
          background: `${titleColor}08`,
          borderBottom: `1px solid ${titleColor}20`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 20 }}>🐘</span>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 17, fontWeight: 800, color: titleColor }}>
              {title}
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{subtitle}</div>
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: 14, color: '#475569', marginLeft: 'auto', fontWeight: 600 }}>
            {row ? '1 row' : '0 rows'}
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
          {grouped.map(g => {
            const meta = ROLE_META[g.role];
            return (
              <div key={g.role}>
                {/* Role section header */}
                <div style={{
                  padding: '6px 18px 4px',
                  fontSize: 12,
                  color: meta.color,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  borderTop: `1px solid ${meta.color}15`,
                  background: `${meta.color}05`,
                }}>
                  {meta.label}
                </div>
                {g.columns.map(col => {
                  const isHighlighted = highlightFields.includes(col.name);
                  const value = row ? row[col.name] : null;
                  const changed = isHighlighted && row;
                  return (
                    <motion.div
                      key={col.name}
                      onMouseEnter={() => setHoveredCol(col.name)}
                      onMouseLeave={() => setHoveredCol(null)}
                      animate={{
                        backgroundColor: changed ? `${stage.color}10` : hoveredCol === col.name ? '#ffffff06' : 'transparent',
                      }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: showTypes ? '200px 140px 1fr' : '230px 1fr',
                        gap: 10,
                        padding: '9px 18px',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        borderLeft: changed ? `4px solid ${stage.color}` : '4px solid transparent',
                        alignItems: 'baseline',
                      }}
                    >
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: changed ? 19 : 16,
                        color: changed ? stage.color : col.highlight ? titleColor : '#0f172a',
                        fontWeight: changed ? 800 : col.highlight ? 800 : 600,
                        transition: 'font-size 0.25s',
                      }}>
                        {col.name}
                      </span>
                      {showTypes && (
                        <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#475569' }}>
                          {col.type}
                        </span>
                      )}
                      {row ? (
                        <motion.span
                          key={`${col.name}-${value}`}
                          initial={changed ? { color: stage.color } : {}}
                          animate={{ color: changed ? stage.color : '#334155' }}
                          transition={{ duration: 0.8 }}
                          style={{
                            fontFamily: 'monospace',
                            fontSize: changed ? 17 : 14,
                            fontWeight: changed ? 800 : 600,
                          }}
                        >
                          {value}
                        </motion.span>
                      ) : (
                        <span style={{ fontSize: 14, color: '#475569', fontStyle: 'italic' }}>
                          {col.description}
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '24px 32px',
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
              database schema
              <span style={{ fontSize: 15, color: '#06b6d4', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
                · reference · inside the tables
              </span>
            </motion.h2>
            <div style={{ fontSize: 13, color: '#d97706', fontFamily: 'monospace', marginTop: 6, fontWeight: 600 }}>
              📎 reference appendix — take a picture, no need to memorize
            </div>
          </div>
          <ArchitectureMini
            highlight={['postgres']}
            pulse={zoomPulse}
            onClick={goToSlide ? () => goToSlide('Architecture') : undefined}
            caption="all the way in"
            subcaption="columns of the tables"
          />
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
            color: '#334155', cursor: 'pointer', fontFamily: 'monospace',
            padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
            fontWeight: 600,
          }}>
            <input
              type="checkbox"
              checked={showTypes}
              onChange={e => setShowTypes(e.target.checked)}
              style={{ accentColor: '#d97706', width: 16, height: 16 }}
            />
            show Postgres types
          </label>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
            color: '#334155', cursor: 'pointer', fontFamily: 'monospace',
            padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
            fontWeight: 600,
          }}>
            <input
              type="checkbox"
              checked={showAux}
              onChange={e => setShowAux(e.target.checked)}
              style={{ accentColor: '#f97316', width: 16, height: 16 }}
            />
            show auxiliary tables
          </label>
        </div>
      </div>

      {/* Lifecycle stage selector */}
      <div style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: '12px 18px',
        background: '#f8fafc',
        borderRadius: 10,
        border: '1px solid #e2e8f0',
      }}>
        <span style={{ fontSize: 13, color: '#334155', fontWeight: 800, textTransform: 'uppercase', marginRight: 10 }}>
          view row at stage:
        </span>
        {lifecycleStages.map((s, i) => (
          <React.Fragment key={s.label}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={{ scale: i === selectedStage ? 1.08 : 1 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedStage(i)}
              style={{
                padding: '9px 18px',
                borderRadius: 8,
                border: i === selectedStage ? `2px solid ${s.color}` : '1px solid #e2e8f0',
                background: i === selectedStage ? `${s.color}20` : 'transparent',
                color: i === selectedStage ? s.color : '#475569',
                cursor: 'pointer',
                fontSize: i === selectedStage ? 17 : 15,
                fontWeight: i === selectedStage ? 800 : 700,
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                boxShadow: i === selectedStage ? `0 4px 14px ${s.color}30` : 'none',
              }}
            >
              <span style={{ fontSize: i === selectedStage ? 20 : 17 }}>{s.icon}</span>
              {s.label}
            </motion.button>
            {i < lifecycleStages.length - 1 && (
              <div style={{
                width: 22,
                height: 2,
                background: i < selectedStage ? s.color : '#e2e8f0',
                transition: 'background 0.3s',
              }} />
            )}
          </React.Fragment>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 17, color: stage.color, fontFamily: 'monospace', fontStyle: 'italic', fontWeight: 700 }}>
          {stage.narration}
        </span>
      </div>

      {/* Tables */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedStage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          style={{ flex: 1, display: 'flex', gap: 14, minHeight: 0 }}
        >
          {renderTable(
            'workitems_active',
            'jobs not yet complete',
            activeColumns,
            stage.activeRow,
            '#3b82f6',
            stage.highlight,
          )}
          {renderTable(
            'workitems_inactive',
            'finished jobs (success or failure)',
            inactiveColumns,
            stage.inactiveRow,
            '#22c55e',
            stage.highlight,
          )}
        </motion.div>
      </AnimatePresence>

      {/* Color legend for column roles */}
      <div style={{
        display: 'flex',
        gap: 16,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '10px 16px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, color: '#475569', fontFamily: 'monospace', marginRight: 6, fontWeight: 700 }}>
          column groups:
        </span>
        {ROLE_ORDER.map(r => (
          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              width: 13, height: 13, borderRadius: 3,
              background: `${ROLE_META[r].color}30`,
              border: `1.5px solid ${ROLE_META[r].color}`,
            }} />
            <span style={{ fontSize: 13, color: '#0f172a', fontFamily: 'monospace', fontWeight: 700 }}>{ROLE_META[r].label}</span>
          </div>
        ))}
      </div>

      {/* Auxiliary tables (only when toggled on) */}
      {showAux && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
          }}
        >
          {[
            { label: 'worker_versions', desc: 'Tracks which worker versions are running — for safe rolling deploys', icon: '🏷️' },
            { label: 'workitem_inputresources', desc: 'Links jobs to uploaded blob storage so cleanup can delete them when done', icon: '☁️' },
          ].map(t => (
            <div key={t.label} style={{
              padding: '8px 14px',
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <div>
                <code style={{ fontSize: 14, color: '#f97316', fontWeight: 700 }}>{t.label}</code>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
};
