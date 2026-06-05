import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';

// ─── Waypoints for data flow paths ──────────────────────────────────

// Compute path: Client → Handler → Service → Repository → PostgreSQL
const computePath = [
  { x: 160, y: 200 },  // exit Client right
  { x: 200, y: 200 },  // step right
  { x: 200, y: 62 },   // route up to Handler row
  { x: 230, y: 62 },   // enter Handler left
  { x: 310, y: 62 },   // through Handler center
  { x: 310, y: 100 },  // exit Handler bottom
  { x: 310, y: 155 },  // enter Service top
  { x: 310, y: 192 },  // through Service center
  { x: 310, y: 230 },  // exit Service bottom
  { x: 310, y: 280 },  // enter Repository top
  { x: 310, y: 317 },  // through Repository
  { x: 392, y: 317 },  // exit Repository right
  { x: 500, y: 300 },  // enter PostgreSQL
];

// Claim path: PostgreSQL → Worker (claimed row returning to worker)
const claimPath = [
  { x: 590, y: 260 },
  { x: 680, y: 220 },
  { x: 740, y: 200 },
];

// Release path: Worker → PostgreSQL
const releasePath = [
  { x: 740, y: 220 },
  { x: 680, y: 280 },
  { x: 590, y: 310 },
];

// Per-hop segments so each step's dot travels only between its two boxes,
// parks at the destination, and waits for the presenter to advance.
// Index map of computePath:
//   0 Client right · 1 step right · 2 up · 3 Handler left · 4 Handler ctr
//   5 Handler bot · 6 Service top · 7 Service ctr · 8 Service bot
//   9 Repo top · 10 Repo ctr · 11 Repo right · 12 Postgres
const clientToHandlerPath  = computePath.slice(0, 5);   // 0..4 → ends at Handler center
const handlerToServicePath = computePath.slice(4, 8);   // 4..7 → ends at Service center
const serviceToRepoPath    = computePath.slice(7, 11);  // 7..10 → ends at Repository center
const repoToPostgresPath   = computePath.slice(10);     // 10..12 → ends inside Postgres

// Same hops in reverse for the response leg of the poll.
const postgresToRepoPath    = [...repoToPostgresPath].slice().reverse();
const repoToServicePath     = [...serviceToRepoPath].slice().reverse();
const serviceToHandlerPath  = [...handlerToServicePath].slice().reverse();
const handlerToClientPath   = [...clientToHandlerPath].slice().reverse();

interface Particle {
  id: number;
  path: { x: number; y: number }[];
  color: string;
  label: string;
  startTime: number;
  duration: number;
}

interface FlowEvent {
  id: number;
  step: number;
  time: string;
  label: string;
  color: string;
  icon: string;
}

let particleId = 0;
let eventId = 0;

// Global pace multiplier — bump this to slow the whole animation down,
// drop it to speed up. Applied to every inter-step delay and every
// particle duration so the relative rhythm stays the same.
const PACE = 2.4;

// ─── Flow phases and steps ──────────────────────────────────────────

type StepPhase = 'submit' | 'claim' | 'release' | 'poll';

interface FlowStep {
  phase: StepPhase;
  delayBefore: number;
  glow: string[];
  // IDs of static arrows to pulse-highlight while this step is current
  activeArrows?: string[];
  event: { label: string; color: string; icon: string };
  particle?: { path: { x: number; y: number }[]; color: string; label: string; duration: number };
  // When true, render a centered "time passes" overlay on the diagram while this step is current.
  timeGap?: boolean;
}

const PHASE_ORDER: StepPhase[] = ['submit', 'claim', 'release', 'poll'];

const PHASE_META: Record<StepPhase, { label: string; color: string; icon: string }> = {
  submit:  { label: 'submit',          color: '#22c55e', icon: '📥' },
  claim:   { label: 'claim & process', color: '#f43f5e', icon: '🔒' },
  release: { label: 'release',         color: '#22c55e', icon: '✅' },
  poll:    { label: 'poll & respond',  color: '#fbbf24', icon: '🔁' },
};

// Plain-English explanations shown to the audience as each phase becomes active.
// Speak in user terms — no SQL, no Go API names, no jargon.
const PHASE_EXPLAINER: Record<StepPhase, { headline: string; detail: string }> = {
  submit: {
    headline: 'The request is saved to a database table — the client gets a receipt and moves on.',
    detail:  'No waiting. Even if the job will take 30 minutes, the client call returns in milliseconds with a handle to look up later.',
  },
  claim: {
    headline: 'Background workers race to grab the next job. Postgres makes sure only one wins.',
    detail:  'Workers continuously ask the database "is there work for me?". The database hands out each job to exactly one worker — no duplicates, no missed work.',
  },
  release: {
    headline: 'The worker finishes, writes the result back, and marks the job done.',
    detail:  'The completed result lives in the database, waiting to be collected. The worker is now free to grab the next job.',
  },
  poll: {
    headline: 'The client comes back later and asks "is my job done yet?" — gets the result.',
    detail:  'The client could come back in 1 second or 1 hour. The result is durable in Postgres until somebody picks it up.',
  },
};

const flowSteps: FlowStep[] = [
  // ── Submit ────────────────────────────────────────────────────────
  { phase: 'submit', delayBefore: 0, glow: ['client', 'handler'], activeArrows: ['compute'],
    event: { label: 'Client calls Compute(request) — call enters the gRPC handler', color: '#22c55e', icon: '📥' },
    particle: { path: clientToHandlerPath, color: '#22c55e', label: 'Compute()', duration: 1200 } },
  { phase: 'submit', delayBefore: 800, glow: ['handler', 'service'], activeArrows: ['handler-service'],
    event: { label: 'Handler validates and hands the request to the Service', color: '#3b82f6', icon: '🔌' },
    particle: { path: handlerToServicePath, color: '#3b82f6', label: 'validated', duration: 900 } },
  { phase: 'submit', delayBefore: 900, glow: ['service', 'repository'], activeArrows: ['service-repo'],
    event: { label: 'Service applies business logic and builds the work item', color: '#8b5cf6', icon: '⚙️' },
    particle: { path: serviceToRepoPath, color: '#8b5cf6', label: 'work item', duration: 900 } },
  { phase: 'submit', delayBefore: 800, glow: ['repository', 'postgres'], activeArrows: ['repo-postgres'],
    event: { label: 'Repository INSERTs into workitems_active', color: '#f97316', icon: '📦' },
    particle: { path: repoToPostgresPath, color: '#f97316', label: 'INSERT', duration: 800 } },
  { phase: 'submit', delayBefore: 1000, glow: ['postgres'],
    event: { label: 'Stored in workitems_active (status: queued); Compute() returns Operation handle', color: '#06b6d4', icon: '🐘' } },

  // ── Claim & Process ───────────────────────────────────────────────
  { phase: 'claim', delayBefore: 2000, glow: ['worker', 'postgres'], activeArrows: ['claim'],
    event: { label: 'Worker → Postgres: ClaimWorkItem (SELECT … FOR UPDATE SKIP LOCKED)', color: '#f43f5e', icon: '🔒' } },
  { phase: 'claim', delayBefore: 1200, glow: ['worker', 'postgres'], activeArrows: ['claim'],
    event: { label: 'Postgres returns claimed row → Worker', color: '#f43f5e', icon: '📨' },
    particle: { path: claimPath, color: '#f43f5e', label: 'claimed row', duration: 2200 } },
  { phase: 'claim', delayBefore: 2500, glow: ['worker'],
    event: { label: 'Worker processing… RefreshClaim() heartbeat', color: '#f43f5e', icon: '💓' } },

  // ── Release ───────────────────────────────────────────────────────
  { phase: 'release', delayBefore: 3800, glow: ['worker', 'postgres'], activeArrows: ['release'],
    event: { label: 'Worker → Postgres: ReleaseOnSuccess() writes result', color: '#22c55e', icon: '✅' },
    particle: { path: releasePath, color: '#22c55e', label: 'release', duration: 2500 } },
  { phase: 'release', delayBefore: 2800, glow: ['postgres'],
    event: { label: 'Item moved: workitems_active → workitems_inactive', color: '#06b6d4', icon: '📦' } },

  // ── Time passes (the whole point of LRO) ──────────────────────────
  { phase: 'poll', delayBefore: 2000, glow: [], timeGap: true,
    event: { label: '… seconds, minutes, or hours pass — the client decides when to come back …', color: '#475569', icon: '⏱' } },

  // ── Poll & Respond ────────────────────────────────────────────────
  // Outbound: client's GetOperation walks the stack to Postgres, one hop per step.
  { phase: 'poll', delayBefore: 2200, glow: ['client', 'handler'], activeArrows: ['compute'],
    event: { label: 'Client polls GetOperation(name) — separate gRPC call', color: '#fbbf24', icon: '🔁' },
    particle: { path: clientToHandlerPath, color: '#fbbf24', label: 'GetOperation()', duration: 1200 } },
  { phase: 'poll', delayBefore: 800, glow: ['handler', 'service'], activeArrows: ['handler-service'],
    event: { label: 'Handler hands the poll to the Service', color: '#3b82f6', icon: '🔌' },
    particle: { path: handlerToServicePath, color: '#fbbf24', label: 'poll', duration: 900 } },
  { phase: 'poll', delayBefore: 800, glow: ['service', 'repository'], activeArrows: ['service-repo'],
    event: { label: 'Service asks the Repository: "is the job done yet?"', color: '#8b5cf6', icon: '⚙️' },
    particle: { path: serviceToRepoPath, color: '#fbbf24', label: 'lookup', duration: 900 } },
  { phase: 'poll', delayBefore: 800, glow: ['repository', 'postgres'], activeArrows: ['repo-postgres'],
    event: { label: 'Repository SELECTs from workitems_inactive — finds the completed row', color: '#f97316', icon: '📦' },
    particle: { path: repoToPostgresPath, color: '#fbbf24', label: 'SELECT', duration: 800 } },
  // Response: completed result travels back up the stack.
  { phase: 'poll', delayBefore: 1200, glow: ['postgres', 'repository'], activeArrows: ['repo-postgres'],
    event: { label: 'Postgres returns the completed row', color: '#2563eb', icon: '📤' },
    particle: { path: postgresToRepoPath, color: '#2563eb', label: 'result row', duration: 800 } },
  { phase: 'poll', delayBefore: 800, glow: ['repository', 'service'], activeArrows: ['service-repo'],
    event: { label: 'Repository decodes the row and passes it to the Service', color: '#8b5cf6', icon: '⚙️' },
    particle: { path: repoToServicePath, color: '#2563eb', label: 'decoded', duration: 900 } },
  { phase: 'poll', delayBefore: 800, glow: ['service', 'handler'], activeArrows: ['handler-service'],
    event: { label: 'Service hands the result back to the Handler', color: '#3b82f6', icon: '🔌' },
    particle: { path: serviceToHandlerPath, color: '#2563eb', label: 'result', duration: 900 } },
  { phase: 'poll', delayBefore: 800, glow: ['handler', 'client'], activeArrows: ['compute'],
    event: { label: 'Handler streams the Operation back to the Client', color: '#22c55e', icon: '📨' },
    particle: { path: handlerToClientPath, color: '#2563eb', label: 'Operation', duration: 1200 } },
  { phase: 'poll', delayBefore: 1000, glow: ['client'],
    event: { label: 'Client receives Operation{done=true, response} 🎉', color: '#22c55e', icon: '🎉' } },
];

// ─── "What if?" scenarios ───────────────────────────────────────────
// Short, focused mini-flows that demonstrate postgres-lro's resilience.

interface Scenario {
  name: string;
  label: string;
  icon: string;
  headline: string;
  detail: string;
  steps: FlowStep[];
}

const SCENARIOS: Record<string, Scenario> = {
  'worker-crashes': {
    name: 'worker-crashes',
    label: 'what if the worker crashes?',
    icon: '🔥',
    headline: 'A crashed worker doesn\'t lose the job. Another worker picks it up.',
    detail: 'Workers must send heartbeats to keep their claim alive. If a worker dies, its claim expires and the job is back up for grabs — no manual recovery needed.',
    steps: [
      { phase: 'claim', delayBefore: 0, glow: ['worker', 'postgres'], activeArrows: ['claim'],
        event: { label: 'Worker grabs a job from Postgres', color: '#f43f5e', icon: '🔒' },
        particle: { path: claimPath, color: '#f43f5e', label: 'claimed', duration: 2000 } },
      { phase: 'claim', delayBefore: 2200, glow: ['worker'],
        event: { label: 'Worker starts processing, sends heartbeats every few seconds', color: '#f43f5e', icon: '💓' } },
      { phase: 'claim', delayBefore: 2500, glow: ['worker'],
        event: { label: '💥 Worker crashes mid-job — heartbeats stop', color: '#ef4444', icon: '💥' } },
      { phase: 'release', delayBefore: 2200, glow: ['postgres'], timeGap: true,
        event: { label: 'Postgres notices no heartbeats — the claim expires', color: '#fbbf24', icon: '⏱' } },
      { phase: 'release', delayBefore: 2200, glow: ['worker', 'postgres'], activeArrows: ['claim'],
        event: { label: 'Another worker comes along and re-claims the same job', color: '#22c55e', icon: '🔁' },
        particle: { path: claimPath, color: '#22c55e', label: 're-claimed', duration: 2000 } },
      { phase: 'release', delayBefore: 2200, glow: ['worker', 'postgres'], activeArrows: ['release'],
        event: { label: 'New worker finishes the job — no work was lost ✓', color: '#22c55e', icon: '✅' },
        particle: { path: releasePath, color: '#22c55e', label: 'done', duration: 2000 } },
    ],
  },
  'workers-race': {
    name: 'workers-race',
    label: 'what if two workers grab the same job?',
    icon: '🏁',
    headline: 'Postgres makes sure only one worker wins each job. No duplicates, ever.',
    detail: 'SELECT … FOR UPDATE SKIP LOCKED tells Postgres: "give me an unlocked row, and skip any row another worker is already looking at." Race-free, by the database.',
    steps: [
      { phase: 'claim', delayBefore: 0, glow: ['worker', 'postgres'],
        event: { label: 'Worker A and Worker B both ask Postgres for the next job — at the same instant', color: '#f43f5e', icon: '🏁' } },
      { phase: 'claim', delayBefore: 1800, glow: ['worker', 'postgres'], activeArrows: ['claim'],
        event: { label: 'Postgres locks the row for Worker A (FOR UPDATE SKIP LOCKED)', color: '#22c55e', icon: '🔒' },
        particle: { path: claimPath, color: '#22c55e', label: 'A wins', duration: 1800 } },
      { phase: 'claim', delayBefore: 2200, glow: ['worker', 'postgres'],
        event: { label: 'Worker B sees "row is locked" → skips it, looks for the next one', color: '#475569', icon: '⏭' } },
      { phase: 'claim', delayBefore: 2200, glow: ['worker'],
        event: { label: 'No double-processing. Ever. ✓', color: '#22c55e', icon: '✅' } },
    ],
  },
  'cache-hit': {
    name: 'cache-hit',
    label: 'what if the client submits the same request twice?',
    icon: '🪞',
    headline: 'Duplicate requests are deduplicated — the second call gets the same handle as the first.',
    detail: 'Each request has a cache key (typically a hash of its inputs). If a job for that key already exists, postgres-lro returns the existing Operation handle instead of starting a second job. Safe to retry. No double-billing, no double-work.',
    steps: [
      { phase: 'submit', delayBefore: 0, glow: ['client', 'handler'], activeArrows: ['compute'],
        event: { label: 'Client calls Compute(request) — request hashes to cache_key="abc"', color: '#22c55e', icon: '📥' },
        particle: { path: clientToHandlerPath, color: '#22c55e', label: 'Compute()', duration: 1200 } },
      { phase: 'submit', delayBefore: 0, glow: ['repository', 'postgres'], activeArrows: ['repo-postgres'],
        event: { label: 'Repository checks: any work item with cache_key="abc"? → none found, INSERTs new row', color: '#f97316', icon: '🔍' },
        particle: { path: repoToPostgresPath, color: '#f97316', label: 'INSERT', duration: 800 } },
      { phase: 'submit', delayBefore: 0, glow: ['postgres', 'client'],
        event: { label: 'Compute() returns Operation{name="op-123", done=false} — client moves on', color: '#06b6d4', icon: '🐘' } },
      { phase: 'submit', delayBefore: 0, glow: ['client', 'handler'], activeArrows: ['compute'], timeGap: true,
        event: { label: '… moments later, the same client retries the same request …', color: '#475569', icon: '⏱' } },
      { phase: 'submit', delayBefore: 0, glow: ['client', 'handler'], activeArrows: ['compute'],
        event: { label: 'Client calls Compute(request) again — same cache_key="abc"', color: '#22c55e', icon: '🔁' },
        particle: { path: clientToHandlerPath, color: '#fbbf24', label: 'Compute() #2', duration: 1200 } },
      { phase: 'submit', delayBefore: 0, glow: ['repository', 'postgres'], activeArrows: ['repo-postgres'],
        event: { label: 'Repository checks: cache_key="abc" already exists → returns the existing row, no INSERT', color: '#22c55e', icon: '✅' },
        particle: { path: repoToPostgresPath, color: '#fbbf24', label: 'SELECT', duration: 800 } },
      { phase: 'submit', delayBefore: 0, glow: ['postgres', 'client'],
        event: { label: 'Compute() returns the same Operation{name="op-123"} as before — client cannot tell the difference', color: '#22c55e', icon: '🎉' } },
    ],
  },
  'client-disconnects': {
    name: 'client-disconnects',
    label: 'what if the client disconnects?',
    icon: '💤',
    headline: 'The result is durable. It waits in Postgres until the client comes back.',
    detail: 'Once a job\'s result is written to the database, it doesn\'t care if the client is online, offline, or on vacation. Whenever they poll — minutes, hours, or days later — the result is right there.',
    steps: [
      { phase: 'submit', delayBefore: 0, glow: ['client'], activeArrows: ['compute'],
        event: { label: 'Client submits a job, then walks away', color: '#22c55e', icon: '📥' },
        particle: { path: computePath, color: '#22c55e', label: 'Compute()', duration: 2500 } },
      { phase: 'claim', delayBefore: 2700, glow: ['worker', 'postgres'], activeArrows: ['claim'],
        event: { label: 'Worker picks it up, processes it, writes the result back', color: '#f43f5e', icon: '⚙️' },
        particle: { path: claimPath, color: '#f43f5e', label: 'work', duration: 1800 } },
      { phase: 'release', delayBefore: 2000, glow: ['postgres'], activeArrows: ['release'],
        event: { label: 'Result is durable in Postgres — sitting and waiting', color: '#06b6d4', icon: '🐘' },
        particle: { path: releasePath, color: '#22c55e', label: 'result', duration: 1800 } },
      { phase: 'poll', delayBefore: 2200, glow: [], timeGap: true,
        event: { label: '… hours later, the client is back from lunch …', color: '#475569', icon: '⏱' } },
      { phase: 'poll', delayBefore: 2200, glow: ['client', 'postgres'], activeArrows: ['compute'],
        event: { label: 'Client polls GetOperation — result is right there, no waiting', color: '#22c55e', icon: '🎉' },
        particle: { path: computePath, color: '#fbbf24', label: 'poll', duration: 2500 } },
    ],
  },
};

// ─── Layer popup data (click Handler / Service / Repository boxes to open) ─

type LayerKey = 'handler' | 'service' | 'repository' | 'postgres' | 'worker';

const LAYER_INFO: Record<LayerKey, {
  icon: string;
  name: string;
  file: string;
  color: string;
  tagline: string;
  points: { headline: string; explain: string }[];
  /** Optional "Jump to detail slide" link shown in the popup footer. */
  linkTo?: { slide: string; label: string };
}> = {
  handler: {
    icon: '🔌',
    name: 'Handler',
    file: 'lro/handler.go',
    color: '#3b82f6',
    tagline: 'the gRPC entry point that receives RPC calls from your clients',
    points: [
      {
        headline: 'The gRPC entry point where your clients land',
        explain: 'Every long-running call from the outside world enters at this layer. Nothing else in your service knows the operation is long-running.',
      },
      {
        headline: 'Implements the standard google.longrunning.Operations interface',
        explain: 'Same protocol Google Cloud uses. Any compliant generated client stub works. No custom SDK, no Anthropic-specific quirks.',
      },
      {
        headline: 'Six client RPCs cover the full LRO lifecycle',
        explain: 'Compute starts a job. GetOperation, WaitOperation, and ListOperations read status. CancelOperation and DeleteOperation end one. (Workers also talk to the Handler via a separate ClaimWorkItem / RefreshClaim / ReleaseWorkItem API, which is internal and never exposed to clients.)',
      },
      {
        headline: 'Auth, validation, delegation: no business logic of its own',
        explain: 'Verifies the caller, checks the request shape, then hands off to the Service. The Handler itself never decides what the job does.',
      },
      {
        headline: 'One line of setup to register on your gRPC server',
        explain: 'Wire it like any other gRPC service. The Handler ships ready-to-use. You do not subclass it or override anything.',
      },
    ],
  },
  service: {
    icon: '⚙️',
    name: 'Service',
    file: 'lro/service.go',
    color: '#8b5cf6',
    tagline: 'orchestrates the LRO lifecycle, the seam where your business logic plugs in',
    points: [
      {
        headline: 'The only layer where you write code for YOUR operation',
        explain: 'Everything else is generic LRO plumbing. The Service is the seam between the package and your business logic.',
      },
      {
        headline: 'Turns a Compute() call into a durable work item in Postgres',
        explain: 'Builds the work-item row, attaches metadata, persists it. After this returns, the request survives even if every worker is down.',
      },
      {
        headline: 'Cache-key deduplication: same request, same Operation handle',
        explain: 'If the same request arrives twice (retry, double-click, network flake), the second caller gets back the first call’s handle. No double work.',
      },
      {
        headline: 'Routes work to compatible worker versions',
        explain: 'During rolling deploys, old workers finish in-flight jobs while new workers pick up new requests. Versions never cross.',
      },
      {
        headline: 'You provide just two callbacks: validator and result unmarshaller',
        explain: 'Validator rejects malformed requests up front. Unmarshaller knows how to decode your specific result type from bytes.',
      },
      {
        headline: 'Talks to the Repository for all persistence',
        explain: 'The Service never sees SQL. It calls Go methods. Easy to test, easy to mock, easy to reason about.',
      },
    ],
  },
  repository: {
    icon: '📦',
    name: 'Repository',
    file: 'lro/repository.go',
    color: '#f97316',
    tagline: 'owns all the SQL; you call methods, never write a query',
    points: [
      {
        headline: 'The only layer that knows SQL; everything else is SQL-free',
        explain: 'Every query in the package lives here. The Handler and Service never see a SQL string in their lives.',
      },
      {
        headline: 'Clean Go API over workitems_active and workitems_inactive',
        explain: 'You call methods like EnqueueWorkItem(); the Repository turns that into the right INSERT / UPDATE / SELECT against Postgres.',
      },
      {
        headline: 'One method per state transition in the lifecycle',
        explain: 'Enqueue, Claim, RefreshClaim, ReleaseWorkItem, Cancel. The state machine on slide 3 maps almost 1:1 to these calls.',
      },
      {
        headline: 'This is where FOR UPDATE SKIP LOCKED lives (see slide 2)',
        explain: 'The race-free claim mechanism is a single SQL clause inside ClaimWorkItem. Nothing clever in Go. All the magic is the database.',
      },
      {
        headline: 'Database migrations ship with the package',
        explain: 'You do not write schema. The lro/dbmigrations/ folder has the create-table SQL. Run it as part of your deploy and the tables exist.',
      },
      {
        headline: 'No ORM, no query builder, just raw SQL behind a clean interface',
        explain: 'What you see in the SQL panel on slide 2 is exactly what runs. Easy to audit, easy to optimize, easy to add indexes.',
      },
    ],
  },
  postgres: {
    icon: '🐘',
    name: 'PostgreSQL',
    file: 'your existing database',
    color: '#06b6d4',
    tagline: 'the single source of truth; every piece of LRO state lives here',
    linkTo: { slide: 'Database Schema', label: 'Database Schema' },
    points: [
      {
        headline: 'One database holds everything, no extra infra to run',
        explain: 'Pending jobs, in-progress claims, results, errors all live in one Postgres instance. One thing to back up, one thing to monitor.',
      },
      {
        headline: 'Two tables: workitems_active and workitems_inactive',
        explain: 'Active holds jobs in flight (queued or running). Inactive holds finished jobs (done, failed, canceled, expired). One row move per job.',
      },
      {
        headline: 'Stores the request, the result, and everything in between',
        explain: 'Original payload, claim metadata, heartbeat timestamps, final output bytes, all in the same row, all queryable with plain SQL.',
      },
      {
        headline: 'FOR UPDATE SKIP LOCKED makes parallel workers race-free',
        explain: 'Postgres hands each row to exactly one worker and skips locked rows for others. One SQL clause replaces an entire coordination system.',
      },
      {
        headline: 'Crash recovery is just a timestamp check',
        explain: 'When a worker dies, its claim expires automatically. Another worker reclaims the row on its next poll. No retry logic in your Go code.',
      },
      {
        headline: 'Your existing Postgres backups already cover LROs',
        explain: 'No new persistence layer to replicate, snapshot, or migrate. Whatever you already do for Postgres applies to long-running operations too.',
      },
    ],
  },
  worker: {
    icon: '🔧',
    name: 'Worker',
    file: 'your processing pods',
    color: '#f43f5e',
    tagline: 'separate process that polls Postgres, claims work, runs your code',
    linkTo: { slide: 'Claim Mechanism', label: 'Claim Mechanism' },
    points: [
      {
        headline: 'Runs in its own pod, separate from your gRPC service',
        explain: 'Scale workers independently of request handlers. CPU-heavy jobs do not steal capacity from latency-sensitive API calls.',
      },
      {
        headline: 'A simple loop: claim a row, process it, write the result, repeat',
        explain: 'That is the worker’s entire lifecycle. No queue subscription, no message ack, just SELECT, work, UPDATE, loop.',
      },
      {
        headline: 'Heartbeats every few seconds to keep the claim alive',
        explain: 'A plain UPDATE that bumps claimed_until forward. If heartbeats stop (crash, network partition), the claim expires automatically.',
      },
      {
        headline: 'No coordination between workers; Postgres is the only meeting point',
        explain: 'No leader election, no shared memory, no service mesh. Workers do not know about each other and do not need to.',
      },
      {
        headline: 'Safe to stop, restart, or redeploy mid-job',
        explain: 'Worst case the job is reclaimed by another worker. Rolling deploys are a non-event for in-flight LROs.',
      },
      {
        headline: 'You decide what "processing" means',
        explain: 'The worker calls your handler function with the request. Image rendering, ML inference, report generation, whatever your operation actually does.',
      },
    ],
  },
};

// ─── Keyboard hint style ────────────────────────────────────────────

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

// ─── Static Box ─────────────────────────────────────────────────────

const Box: React.FC<{
  label: string; sublabel?: string; color: string;
  x: number; y: number; w: number; h: number; delay: number;
  icon?: string; glowing?: boolean; muted?: boolean;
  /** When provided, the box is clickable — used by R4 to jump to the relevant detail slide. */
  onClick?: () => void;
  /** Tooltip shown on hover when interactive. */
  hint?: string;
}> = ({ label, sublabel, color, x, y, w, h, delay, icon, glowing, muted, onClick, hint }) => {
  // When muted (boilerplate boxes) and not glowing, render as quiet grey so
  // the visual heroes (Client / Postgres / Worker) carry the story.
  const isQuiet = muted && !glowing;
  const stroke = isQuiet ? '#475569' : color;
  const fillColor = isQuiet ? '#f8fafc80' : `${color}15`;
  const labelColor = isQuiet ? '#475569' : color;
  const subColor = isQuiet ? '#475569' : `${color}aa`;
  const interactive = !!onClick;
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: isQuiet ? 0.75 : 1, scale: 1 }}
      transition={{ delay, duration: 0.4, type: 'spring' }}
      onClick={onClick}
      whileHover={interactive ? { scale: 1.04 } : undefined}
      style={{ cursor: interactive ? 'pointer' : 'default' }}
    >
      {interactive && <title>{hint || `Jump to the ${label} detail slide`}</title>}
      {glowing && (
        <motion.rect
          x={x - 4} y={y - 4} width={w + 8} height={h + 8}
          rx="14" ry="14" fill="none" stroke={color}
          strokeWidth="3"
          animate={{ opacity: [0.35, 0.95, 0.35], strokeWidth: [2, 5, 2] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
        />
      )}
      <rect x={x} y={y} width={w} height={h} rx="12" ry="12"
        fill={fillColor} stroke={stroke} strokeWidth={glowing ? 3 : isQuiet ? 1 : 2} />
      {icon && (
        <text x={x + w / 2} y={y + 28} textAnchor="middle" fontSize="22" fill={labelColor}>{icon}</text>
      )}
      <text x={x + w / 2} y={y + (icon ? 51 : h / 2 - 4)} textAnchor="middle"
        fill={labelColor} fontSize="16" fontWeight="700" fontFamily="Inter, sans-serif">{label}</text>
      {sublabel && (
        <text x={x + w / 2} y={y + (icon ? 70 : h / 2 + 16)} textAnchor="middle"
          fill={subColor} fontSize="12" fontFamily="Inter, sans-serif">{sublabel}</text>
      )}
      {/* Tiny click affordance — "↩" glyph in the corner of interactive boxes */}
      {interactive && (
        <text x={x + w - 8} y={y + 13} textAnchor="end" fill={labelColor}
          fontSize="11" fontFamily="monospace" opacity={0.6}>
          ⤵
        </text>
      )}
    </motion.g>
  );
};

const StaticArrow: React.FC<{
  x1: number; y1: number; x2: number; y2: number;
  label?: string; delay: number; color?: string; active?: boolean;
}> = ({ x1, y1, x2, y2, label, delay, color = '#475569', active }) => {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const hl = active ? 11 : 9;
  const baseWidth = active ? 3 : 2;
  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay, duration: 0.3 }}>
      {/* glow underlay when active */}
      {active && (
        <motion.line
          x1={x1} y1={y1} x2={x2} y2={y2} stroke={color}
          strokeLinecap="round"
          animate={{ strokeWidth: [4, 8, 4], opacity: [0.25, 0.55, 0.25] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
        />
      )}
      <motion.line
        x1={x1} y1={y1} x2={x2} y2={y2} stroke={color}
        strokeWidth={baseWidth}
        strokeDasharray={active ? '0' : '5 4'}
        animate={active ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
        transition={active ? { repeat: Infinity, duration: 1.4 } : { duration: 0.2 }}
      />
      <polygon
        points={`${x2},${y2} ${x2 - hl * Math.cos(angle - 0.4)},${y2 - hl * Math.sin(angle - 0.4)} ${x2 - hl * Math.cos(angle + 0.4)},${y2 - hl * Math.sin(angle + 0.4)}`}
        fill={color} />
      {label && (
        <text x={midX} y={midY - 9} textAnchor="middle"
          fill={active ? color : '#475569'}
          fontSize="12" fontWeight={active ? 700 : 500} fontFamily="monospace">{label}</text>
      )}
    </motion.g>
  );
};

// ─── Animated particle on a path ────────────────────────────────────

const AnimatedParticle: React.FC<{ particle: Particle; now: number }> = ({ particle, now }) => {
  const path = particle.path;
  if (path.length < 2) return null;

  const elapsed = now - particle.startTime;
  const rawT = elapsed / particle.duration;
  const arrived = rawT >= 1;
  const t = Math.min(Math.max(rawT, 0), 1);

  // Find current position. When arrived, sit at the final waypoint and
  // stay there until the next step replaces this particle.
  let cx: number, cy: number, trailStart: { x: number; y: number };
  if (arrived) {
    const last = path[path.length - 1];
    const prev = path[path.length - 2];
    cx = last.x; cy = last.y;
    trailStart = prev;
  } else {
    const totalLen = path.length - 1;
    const segFloat = t * totalLen;
    const segIdx = Math.max(0, Math.min(Math.floor(segFloat), totalLen - 1));
    const segT = segFloat - segIdx;
    const p0 = path[segIdx];
    const p1 = path[segIdx + 1];
    if (!p0 || !p1) return null;
    cx = p0.x + (p1.x - p0.x) * segT;
    cy = p0.y + (p1.y - p0.y) * segT;
    trailStart = {
      x: p0.x + (p1.x - p0.x) * Math.max(segT - 0.3, 0),
      y: p0.y + (p1.y - p0.y) * Math.max(segT - 0.3, 0),
    };
  }

  return (
    <g>
      {/* When arrived, soft pulse so the audience knows it's "parked" here */}
      {arrived ? (
        <>
          <motion.circle
            cx={cx} cy={cy} r={16} fill={particle.color}
            animate={{ opacity: [0.1, 0.3, 0.1], r: [16, 22, 16] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
          />
          <circle cx={cx} cy={cy} r={9} fill={particle.color} opacity={0.5} />
          <circle cx={cx} cy={cy} r={5.5} fill={particle.color} />
        </>
      ) : (
        <>
          <circle cx={cx} cy={cy} r={14} fill={particle.color} opacity={0.15} />
          <circle cx={cx} cy={cy} r={8} fill={particle.color} opacity={0.4} />
          <circle cx={cx} cy={cy} r={5} fill={particle.color} />
          {t > 0.05 && (
            <line
              x1={trailStart.x} y1={trailStart.y}
              x2={cx} y2={cy}
              stroke={particle.color} strokeWidth="2.5" opacity={0.35}
            />
          )}
        </>
      )}
      <text x={cx} y={cy - 18} textAnchor="middle" fill={particle.color}
        fontSize="13" fontWeight="700" fontFamily="monospace">
        {particle.label}
      </text>
    </g>
  );
};

// ─── Main Slide ─────────────────────────────────────────────────────

export const ArchitectureSlide: React.FC<SlideProps> = ({ isActive, goToSlide }) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [now, setNow] = useState(Date.now());
  const [events, setEvents] = useState<FlowEvent[]>([]);
  const [glowing, setGlowing] = useState<string[]>([]);
  // -1 = nothing fired yet; otherwise index of last fired step
  // Click Handler / Service / Repository box → open a small info popup.
  // The clicked box stays glowing while its popup is open.
  const [popupLayer, setPopupLayer] = useState<LayerKey | null>(null);
  const popupLayerRef = useRef<LayerKey | null>(null);
  popupLayerRef.current = popupLayer;

  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  // Auto-play state for the "▶ play all" button: when true, fireStep
  // schedules the next step automatically via setTimeout.
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<0.5 | 1 | 2>(1);
  const isPlayingRef = useRef(false);
  const playSpeedRef = useRef<0.5 | 1 | 2>(1);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  isPlayingRef.current = isPlaying;
  playSpeedRef.current = playSpeed;

  const clearPlayTimer = useCallback(() => {
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
  }, []);
  // null = main flow active. Otherwise we're running a "what if?" scenario.
  const [scenarioName, setScenarioName] = useState<string | null>(null);

  const rafRef = useRef<number>(0);
  const currentStepIdxRef = useRef(-1);
  const logBottomRef = useRef<HTMLDivElement | null>(null);
  // The steps array currently being walked (main flow or a scenario).
  const activeStepsRef = useRef<FlowStep[]>(flowSteps);

  // Keep ref in sync so the keyboard handler reads the latest value
  currentStepIdxRef.current = currentStepIdx;

  // RAF tick for particle animation
  useEffect(() => {
    if (!isActive) return;
    const tick = () => {
      setNow(Date.now());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive]);

  // (Particles are not auto-expired; they "park" at their destination
  // and stay visible until the next step replaces them. See fireStep.)

  // Auto-scroll log to bottom when events change
  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [events.length]);

  const fireStep = useCallback((i: number) => {
    const steps = activeStepsRef.current;
    const step = steps[i];
    if (!step) return;

    // Side effects: glow, event, particle
    setGlowing(step.glow);

    eventId++;
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setEvents(prev => [...prev.slice(-12), {
      id: eventId, step: i + 1, time,
      label: step.event.label, color: step.event.color, icon: step.event.icon,
    }]);

    // Each step owns the diagram visually: clear any prior step's parked particle.
    if (step.particle) {
      particleId++;
      const p = step.particle;
      setParticles([{
        id: particleId, path: p.path, color: p.color, label: p.label,
        startTime: Date.now(), duration: p.duration * PACE,
      }]);
    } else {
      setParticles([]);
    }

    setCurrentStepIdx(i);
    currentStepIdxRef.current = i;

    // If we're in auto-play ("▶ play all") mode, schedule the next step.
    // The presenter can still pause via "❚❚ pause" or interrupt by stepping
    // manually. Delay is scaled by the user-selected speed (0.5x slower / 2x faster).
    if (isPlayingRef.current) {
      const next = i + 1;
      if (next < steps.length) {
        const ms = steps[next].delayBefore * PACE / playSpeedRef.current;
        playTimerRef.current = setTimeout(() => fireStep(next), ms);
      } else {
        // Reached end — stop auto-play.
        setIsPlaying(false);
        isPlayingRef.current = false;
      }
    }
  }, []);

  // Shared reset of all visual state. Does not fire any step.
  const clearState = useCallback(() => {
    clearPlayTimer();
    setIsPlaying(false);
    isPlayingRef.current = false;
    setEvents([]);
    setParticles([]);
    setGlowing([]);
    setCurrentStepIdx(-1);
    currentStepIdxRef.current = -1;
    eventId = 0;
    particleId = 0;
  }, [clearPlayTimer]);

  const runAll = useCallback(() => {
    clearState();
    activeStepsRef.current = flowSteps;
    setScenarioName(null);
    fireStep(0);
  }, [clearState, fireStep]);

  const runScenario = useCallback((name: string) => {
    const scenario = SCENARIOS[name];
    if (!scenario) return;
    clearState();
    activeStepsRef.current = scenario.steps;
    setScenarioName(name);
    fireStep(0);
  }, [clearState, fireStep]);

  const backToMain = useCallback(() => {
    clearState();
    activeStepsRef.current = flowSteps;
    setScenarioName(null);
  }, [clearState]);

  const stepForward = useCallback(() => {
    // Manual step → break out of auto-play if it was running
    clearPlayTimer();
    setIsPlaying(false);
    isPlayingRef.current = false;
    const steps = activeStepsRef.current;
    const next = currentStepIdxRef.current + 1;
    if (next >= steps.length) return;
    fireStep(next);
  }, [clearPlayTimer, fireStep]);

  // ▶ play all — start auto-advancing from wherever we are.
  // If at the start (or end), reset first and play from step 0.
  // If mid-flow, continue auto-advancing from the current step.
  const playAll = useCallback(() => {
    const steps = activeStepsRef.current;
    const atEnd = currentStepIdxRef.current >= steps.length - 1;
    const atStart = currentStepIdxRef.current < 0;

    clearPlayTimer();
    setIsPlaying(true);
    isPlayingRef.current = true;

    if (atStart || atEnd) {
      // Reset state and start from step 0. (Don't call runAll to avoid
      // clearState resetting isPlaying back to false.)
      activeStepsRef.current = flowSteps;
      setScenarioName(null);
      setEvents([]);
      setParticles([]);
      setGlowing([]);
      setCurrentStepIdx(-1);
      currentStepIdxRef.current = -1;
      eventId = 0;
      particleId = 0;
      fireStep(0);
    } else {
      // Continue from where we paused — schedule next step.
      const next = currentStepIdxRef.current + 1;
      const ms = steps[next].delayBefore * PACE / playSpeedRef.current;
      playTimerRef.current = setTimeout(() => fireStep(next), ms);
    }
  }, [clearPlayTimer, fireStep]);

  const pausePlay = useCallback(() => {
    clearPlayTimer();
    setIsPlaying(false);
    isPlayingRef.current = false;
  }, [clearPlayTimer]);

  const reset = useCallback(() => {
    clearState();
    activeStepsRef.current = flowSteps;
    setScenarioName(null);
  }, [clearState]);

  // Jump to first step of a phase — fires that single step, then waits.
  // Always operates on the main flow; exits scenario mode if active.
  const jumpToPhase = useCallback((p: StepPhase) => {
    const firstIdx = flowSteps.findIndex(s => s.phase === p);
    if (firstIdx < 0) return;
    clearPlayTimer();
    setIsPlaying(false);
    isPlayingRef.current = false;
    setEvents([]);
    setParticles([]);
    setGlowing([]);
    eventId = 0;
    particleId = 0;
    activeStepsRef.current = flowSteps;
    setScenarioName(null);
    // Set the prior-step index so subsequent step → continues correctly.
    currentStepIdxRef.current = firstIdx - 1;
    setCurrentStepIdx(firstIdx - 1);
    fireStep(firstIdx);
  }, [clearPlayTimer, fireStep]);

  // Keyboard shortcuts (capture phase, so we run before App's slide-nav handler).
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea (not present here but defensive)
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      const key = e.key;
      const idx = currentStepIdxRef.current;
      const atEnd = idx >= activeStepsRef.current.length - 1;
      const atStart = idx < 0;

      // Step forward via Space / → / ↓ / PageDown — only when there are steps left.
      // When at end, let the key fall through so a clicker advances to the next slide.
      if (key === ' ' || key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown') {
        if (!atEnd) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (atStart) runAll();
          else stepForward();
        }
        return;
      }
      // R restarts from the top
      if (key === 'r' || key === 'R') {
        e.preventDefault();
        e.stopImmediatePropagation();
        runAll();
        return;
      }
      // Esc / 0 — close popup if open, otherwise reset to idle
      if (key === 'Escape' || key === '0') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (popupLayerRef.current) {
          setPopupLayer(null);
        } else {
          reset();
        }
        return;
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true } as any);
  }, [isActive, runAll, stepForward, reset]);

  // Reset on deactivate
  useEffect(() => {
    if (!isActive) {
      clearPlayTimer();
      setIsPlaying(false);
      isPlayingRef.current = false;
      setParticles([]);
      setEvents([]);
      setGlowing([]);
      setCurrentStepIdx(-1);
      currentStepIdxRef.current = -1;
      activeStepsRef.current = flowSteps;
      setScenarioName(null);
      setPopupLayer(null);
      particleId = 0;
      eventId = 0;
    }
  }, [isActive, clearPlayTimer]);

  if (!isActive) return null;

  const isGlowing = (name: string) => glowing.includes(name) || popupLayer === name;
  const inScenario = scenarioName !== null;
  const activeSteps = activeStepsRef.current;
  const isAtEnd = currentStepIdx >= activeSteps.length - 1;
  const isAtStart = currentStepIdx < 0;
  // currentPhase / phaseState only meaningful for main flow; ignore during scenarios
  const currentPhase: StepPhase | null = !inScenario && currentStepIdx >= 0 ? flowSteps[currentStepIdx].phase : null;
  const currentStep = currentStepIdx >= 0 ? activeSteps[currentStepIdx] : null;
  const activeArrows = new Set(currentStep?.activeArrows || []);
  const isArrowActive = (id: string) => activeArrows.has(id);
  const isTimeGap = currentStep?.timeGap === true;
  const scenario = inScenario ? SCENARIOS[scenarioName!] : null;

  // Helper: phase state (pending | active | done) — only meaningful for main flow
  const phaseState = (p: StepPhase): 'pending' | 'active' | 'done' => {
    if (inScenario || isAtStart) return 'pending';
    const firstIdx = flowSteps.findIndex(s => s.phase === p);
    const lastIdx = flowSteps.map(s => s.phase).lastIndexOf(p);
    if (currentStepIdx < firstIdx) return 'pending';
    if (currentStepIdx >= firstIdx && currentStepIdx <= lastIdx) return 'active';
    return 'done';
  };

  // Button factory
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
        color: opts.disabled ? '#475569' : (opts.color || '#334155'),
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
      gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <motion.h2
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0 }}
          >
            architecture overview
            <span style={{ fontSize: 12, color: '#475569', marginLeft: 10, fontFamily: 'monospace', fontWeight: 500 }}>
              · the big picture
            </span>
          </motion.h2>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 3, fontFamily: 'monospace' }}>
            💡 Click any box: <span style={{ color: '#3b82f6' }}>Handler</span> / <span style={{ color: '#8b5cf6' }}>Service</span> / <span style={{ color: '#f97316' }}>Repository</span> for details · <span style={{ color: '#f43f5e' }}>Worker</span> & <span style={{ color: '#06b6d4' }}>Postgres</span> to zoom into that slide.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', marginRight: 4 }}>
            {inScenario ? 'Scenario step ' : 'Step '}
            {Math.max(currentStepIdx + 1, 0)} / {activeSteps.length}
          </span>

          {/* Speed toggle — only meaningful for "play all" auto-advance */}
          <div style={{
            display: 'flex',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            overflow: 'hidden',
          }} title="Auto-play speed">
            {([0.5, 1, 2] as const).map(s => (
              <button
                key={s}
                onClick={() => setPlaySpeed(s)}
                style={{
                  padding: '6px 10px',
                  border: 'none',
                  background: playSpeed === s ? '#22c55e20' : '#ffffff',
                  color: playSpeed === s ? '#16a34a' : '#475569',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                }}
              >
                {s}×
              </button>
            ))}
          </div>

          {/* Play-all / Pause toggle */}
          {isPlaying
            ? ctrlBtn('❚❚ pause', pausePlay, { color: '#fbbf24', primary: true })
            : ctrlBtn('▶ play all', playAll, { color: '#22c55e', primary: true, disabled: isAtEnd && false })
          }

          {/* Manual primary button (run / step / restart) */}
          {isAtStart
            ? ctrlBtn('▶ run flow', runAll, { color: '#475569' })
            : isAtEnd
              ? ctrlBtn('↻ restart', runAll, { color: '#475569' })
              : ctrlBtn('step →', stepForward, { color: '#475569' })
          }
          {ctrlBtn('reset', reset, { color: '#475569', disabled: isAtStart })}
        </div>
      </div>

      {/* Phase chip strip */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {PHASE_ORDER.map((p, i) => {
          const meta = PHASE_META[p];
          const state = phaseState(p);
          const isActive = state === 'active';
          const isDone = state === 'done';
          const bg = isActive ? `${meta.color}25` : isDone ? `${meta.color}10` : '#f8fafc';
          const border = isActive ? meta.color : isDone ? `${meta.color}60` : '#e2e8f0';
          const textColor = isActive ? meta.color : isDone ? `${meta.color}aa` : '#475569';
          return (
            <React.Fragment key={p}>
              <motion.button
                onClick={() => jumpToPhase(p)}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                animate={isActive ? { scale: [1, 1.03, 1] } : { scale: 1 }}
                transition={isActive ? { repeat: Infinity, duration: 1.5 } : { duration: 0.2 }}
                title={`Jump to “${meta.label}” phase`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: bg,
                  border: `1.5px solid ${border}`,
                  fontSize: 12,
                  fontWeight: 700,
                  color: textColor,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 13 }}>{isDone ? '✓' : meta.icon}</span>
                <span>{i + 1}. {meta.label}</span>
              </motion.button>
              {i < PHASE_ORDER.length - 1 && (
                <span style={{ color: '#e2e8f0', fontSize: 14 }}>→</span>
              )}
            </React.Fragment>
          );
        })}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#475569', fontFamily: 'monospace' }} title="Keyboard shortcuts">
          <kbd style={kbdStyle}>Space</kbd> next step ·{' '}
          <kbd style={kbdStyle}>R</kbd> restart ·{' '}
          <kbd style={kbdStyle}>Esc</kbd> reset
        </span>
      </div>

      {/* Wrapper around everything below the phase chips. Its `position: relative`
          gives the popup-blur backdrop a containing block, so the blur covers
          the diagram row + event log + phase explainer + what-if buttons — but
          NOT the header or phase chips above. */}
      <div style={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 0,
      }}>

      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
        {/* SVG Diagram */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 0, position: 'relative' }}>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 900 400"
            preserveAspectRatio="xMidYMid meet"
            style={{ maxHeight: '100%' }}
          >
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
              <rect x={200} y={10} width={220} height={370} rx="16"
                fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="6 4" />
              <text x={310} y={395} textAnchor="middle" fill="#475569" fontSize="12"
                fontFamily="monospace" fontWeight="600">your gRPC service (boilerplate)</text>
            </motion.g>
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
              <rect x={720} y={130} width={170} height={130} rx="16"
                fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="6 4" />
              <text x={805} y={275} textAnchor="middle" fill="#475569" fontSize="12"
                fontFamily="monospace" fontWeight="600">background workers</text>
            </motion.g>

            <Box label="Client" sublabel="Your gRPC service" color="#22c55e"
              x={20} y={160} w={140} h={80} delay={0.1} icon="📱" glowing={isGlowing('client')} />
            <Box label="Handler" sublabel="gRPC API layer" color="#3b82f6"
              x={230} y={25} w={160} h={75} delay={0.15} icon="🔌" glowing={isGlowing('handler')} muted
              onClick={() => setPopupLayer('handler')}
              hint="Click to learn what the Handler does" />
            <Box label="Service" sublabel="Business logic" color="#8b5cf6"
              x={230} y={155} w={160} h={75} delay={0.2} icon="⚙️" glowing={isGlowing('service')} muted
              onClick={() => setPopupLayer('service')}
              hint="Click to learn what the Service does" />
            <Box label="Repository" sublabel="SQL queries" color="#f97316"
              x={230} y={280} w={160} h={75} delay={0.25} icon="📦" glowing={isGlowing('repository')} muted
              onClick={() => setPopupLayer('repository')}
              hint="Click to learn what the Repository does" />
            <Box label="PostgreSQL" sublabel="workitems_active / _inactive" color="#06b6d4"
              x={500} y={250} w={180} h={100} delay={0.3} icon="🐘" glowing={isGlowing('postgres')}
              onClick={() => setPopupLayer('postgres')}
              hint="Click to learn what PostgreSQL does in postgres-lro" />
            <Box label="Worker" sublabel="Poll, Claim, Process" color="#f43f5e"
              x={740} y={150} w={140} h={85} delay={0.35} icon="🔧" glowing={isGlowing('worker')}
              onClick={() => setPopupLayer('worker')}
              hint="Click to learn what the Worker does" />

            <StaticArrow x1={160} y1={180} x2={228} y2={80} label="Compute()" delay={0.4} color="#22c55e" active={isArrowActive('compute')} />
            <StaticArrow x1={310} y1={102} x2={310} y2={153} label="" delay={0.45} color="#3b82f6" active={isArrowActive('handler-service')} />
            <StaticArrow x1={310} y1={232} x2={310} y2={278} label="" delay={0.5} color="#8b5cf6" active={isArrowActive('service-repo')} />
            <StaticArrow x1={392} y1={318} x2={498} y2={300} label="SQL" delay={0.55} color="#f97316" active={isArrowActive('repo-postgres')} />
            <StaticArrow x1={740} y1={170} x2={592} y2={252} label="ClaimWorkItem" delay={0.6} color="#f43f5e" active={isArrowActive('claim')} />
            <StaticArrow x1={740} y1={220} x2={682} y2={300} label="Release" delay={0.65} color="#22c55e" active={isArrowActive('release')} />

            {particles.map(p => (
              <AnimatedParticle key={p.id} particle={p} now={now} />
            ))}

            {/* Time-passes overlay */}
            {isTimeGap && (
              <motion.g
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                <rect x={250} y={140} width={400} height={120} rx="16"
                  fill="#ffffffe6" stroke="#fbbf24" strokeWidth="2" strokeDasharray="6 4" />
                <motion.text
                  x={450} y={180}
                  textAnchor="middle"
                  fontSize="34"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ repeat: Infinity, duration: 1.6 }}
                >⏱</motion.text>
                <text x={450} y={215} textAnchor="middle"
                  fill="#fbbf24" fontSize="15" fontWeight="700"
                  fontFamily="monospace">
                  seconds · minutes · hours later …
                </text>
                <text x={450} y={238} textAnchor="middle"
                  fill="#334155" fontSize="12">
                  the client decides when to check back
                </text>
              </motion.g>
            )}
          </svg>

          {/* Layer info popup (Handler / Service / Repository) */}
          <AnimatePresence>
            {popupLayer && (() => {
              const info = LAYER_INFO[popupLayer];
              return (
                <>
                  {/* The blur backdrop lives outside this column, at the
                      lower-section wrapper level (further down in the JSX),
                      so it can cover the event log + explainer + what-if too.
                      Only the popup card itself is rendered here. */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 8 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      width: 820,
                      background: '#ffffff',
                      border: `3px solid ${info.color}`,
                      borderRadius: 14,
                      boxShadow: `0 20px 56px ${info.color}40, 0 8px 22px rgba(15, 23, 42, 0.15)`,
                      zIndex: 1000,
                    }}
                  >
                    {/* Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 16,
                      padding: '22px 26px',
                      background: `${info.color}14`,
                      borderBottom: `1px solid ${info.color}30`,
                    }}>
                      <span style={{ fontSize: 52, lineHeight: 1, flexShrink: 0 }}>{info.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 38, fontWeight: 900, color: info.color, fontFamily: 'monospace', letterSpacing: '-0.01em' }}>
                            {info.name}
                          </span>
                          <span style={{ fontSize: 17, color: '#475569', fontFamily: 'monospace', fontWeight: 600 }}>
                            {info.file}
                          </span>
                        </div>
                        <div style={{ fontSize: 20, color: '#0f172a', fontStyle: 'italic', marginTop: 7, lineHeight: 1.4, fontWeight: 600 }}>
                          {info.tagline}
                        </div>
                      </div>
                      <button
                        onClick={() => setPopupLayer(null)}
                        title="Close (Esc)"
                        style={{
                          flexShrink: 0,
                          width: 28, height: 28, borderRadius: 6,
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          color: '#475569',
                          cursor: 'pointer',
                          fontSize: 16, lineHeight: 1, padding: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >×</button>
                    </div>
                    {/* Bullets — headline + explanation per point */}
                    <ol style={{
                      margin: 0,
                      padding: '18px 26px 16px 26px',
                      listStyle: 'none',
                      counterReset: 'point',
                    }}>
                      {info.points.map((p, i) => (
                        <li
                          key={i}
                          style={{
                            counterIncrement: 'point',
                            marginBottom: 10,
                            paddingLeft: 42,
                            position: 'relative',
                          }}
                        >
                          <span
                            aria-hidden
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 1,
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: `${info.color}18`,
                              border: `2px solid ${info.color}`,
                              color: info.color,
                              fontSize: 13,
                              fontWeight: 800,
                              fontFamily: 'monospace',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              lineHeight: 1,
                            }}
                          >{i + 1}</span>
                          <div style={{
                            fontSize: 20,
                            color: '#0f172a',
                            fontWeight: 700,
                            lineHeight: 1.3,
                          }}>
                            {p.headline}
                          </div>
                          <div style={{
                            fontSize: 14,
                            color: '#475569',
                            fontWeight: 400,
                            lineHeight: 1.45,
                            marginTop: 3,
                          }}>
                            {p.explain}
                          </div>
                        </li>
                      ))}
                    </ol>
                    <div style={{
                      padding: '10px 22px 14px',
                      fontSize: 11,
                      color: '#94a3b8',
                      fontFamily: 'monospace',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}>
                      {info.linkTo && goToSlide && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const target = info.linkTo!.slide;
                            setPopupLayer(null);
                            goToSlide(target);
                          }}
                          style={{
                            padding: '7px 14px',
                            borderRadius: 8,
                            border: `1.5px solid ${info.color}`,
                            background: `${info.color}14`,
                            color: info.color,
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 800,
                            fontFamily: 'monospace',
                          }}
                          title={`Open the ${info.linkTo.label} slide`}
                        >
                          ⤵ jump to {info.linkTo.label} slide
                        </button>
                      )}
                      <span style={{ marginLeft: 'auto' }}>
                        press <kbd style={kbdStyle}>Esc</kbd> or click outside to close
                      </span>
                    </div>
                  </motion.div>
                </>
              );
            })()}
          </AnimatePresence>
        </div>

        {/* Event log */}
        <div style={{
          width: 340,
          background: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}>
          <div style={{
            padding: '12px 14px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: 18 }}>📋</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#334155', fontFamily: 'monospace' }}>
              Flow Events
            </span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
            <AnimatePresence>
              {events.map((ev, i) => {
                const isLatest = i === events.length - 1;
                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, x: 10, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    style={{
                      padding: isLatest ? '16px 14px' : '9px 14px',
                      borderBottom: '1px solid #f8fafc',
                      borderLeft: isLatest ? `4px solid ${ev.color}` : '4px solid transparent',
                      background: isLatest ? `${ev.color}0e` : 'transparent',
                      transition: 'background 200ms, padding 200ms',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{
                        flexShrink: 0,
                        width: isLatest ? 36 : 26,
                        height: isLatest ? 36 : 26,
                        borderRadius: '50%',
                        background: `${ev.color}22`,
                        border: `1.5px solid ${ev.color}`,
                        color: ev.color,
                        fontSize: isLatest ? 17 : 13,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                      }}>{ev.step}</span>
                      <span style={{ fontSize: isLatest ? 26 : 18, flexShrink: 0 }}>{ev.icon}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>{ev.time}</span>
                        <div style={{
                          fontSize: isLatest ? 22 : 15,
                          color: ev.color,
                          lineHeight: 1.4,
                          marginTop: 3,
                          fontWeight: isLatest ? 800 : 600,
                        }}>{ev.label}</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={logBottomRef} />
            {events.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
                Click "Run Flow" or "step →" to walk through the architecture
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phase explainer (plain English) — scenario takes precedence over phase */}
      <AnimatePresence mode="wait">
        <motion.div
          key={scenarioName ?? currentPhase ?? 'idle'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          style={{
            padding: '12px 18px',
            background: scenario ? '#fbbf2410' : currentPhase ? `${PHASE_META[currentPhase].color}10` : '#ffffff',
            border: `1.5px solid ${scenario ? '#fbbf2460' : currentPhase ? `${PHASE_META[currentPhase].color}60` : '#f8fafc'}`,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span style={{ fontSize: 28, flexShrink: 0 }}>
            {scenario ? scenario.icon : currentPhase ? PHASE_META[currentPhase].icon : '💡'}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            {scenario ? (
              <>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fbbf24',
                  fontFamily: 'monospace',
                  marginBottom: 4,
                }}>
                  scenario — {scenario.label}
                </div>
                <div style={{ fontSize: 15, color: '#0f172a', lineHeight: 1.4 }}>
                  {scenario.headline}
                </div>
                <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.45, marginTop: 4 }}>
                  {scenario.detail}
                </div>
              </>
            ) : currentPhase ? (
              <>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: PHASE_META[currentPhase].color,
                  fontFamily: 'monospace',
                  marginBottom: 4,
                }}>
                  Phase {PHASE_ORDER.indexOf(currentPhase) + 1} of 4 — {PHASE_META[currentPhase].label}
                </div>
                <div style={{ fontSize: 15, color: '#0f172a', lineHeight: 1.4 }}>
                  {PHASE_EXPLAINER[currentPhase].headline}
                </div>
                <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.45, marginTop: 4 }}>
                  {PHASE_EXPLAINER[currentPhase].detail}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#475569', fontFamily: 'monospace', marginBottom: 4 }}>
                  how it works
                </div>
                <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.45 }}>
                  Long-running jobs (seconds to hours) can't block a gRPC call.
                  postgres-lro stores the request in Postgres, lets background workers
                  race to claim it, and gives the client a handle to come back for the result.
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                  Press <kbd style={kbdStyle}>Space</kbd> or click <strong>▶ run flow</strong> — or jump straight to a phase above, or try a "what if?" scenario below.
                </div>
              </>
            )}
          </div>
          {scenario && (
            <button
              onClick={backToMain}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: 8,
                border: '1.5px solid #475569',
                background: 'transparent',
                color: '#334155',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'monospace',
              }}
            >← back to main flow</button>
          )}
        </motion.div>
      </AnimatePresence>

      {/* "What if?" scenario buttons */}
      <div style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        padding: '6px 0',
      }}>
        <span style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', marginRight: 6 }}>
          What if…?
        </span>
        {Object.values(SCENARIOS).map(s => {
          const isActive = scenarioName === s.name;
          return (
            <motion.button
              key={s.name}
              onClick={() => runScenario(s.name)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                border: `1.5px solid ${isActive ? '#fbbf24' : '#e2e8f0'}`,
                background: isActive ? '#fbbf2418' : '#f8fafc',
                color: isActive ? '#fbbf24' : '#334155',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'monospace',
              }}
            >
              <span style={{ fontSize: 14 }}>{s.icon}</span>
              <span>{s.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Blur backdrop for the layer popup — covers the diagram row, event log,
          phase explainer, and what-if buttons (everything inside this wrapper).
          The popup card itself lives inside the diagram column with a higher
          z-index, so it floats sharp above this blurred area. */}
      <AnimatePresence>
        {popupLayer && (
          <motion.div
            onClick={() => setPopupLayer(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 999,
              cursor: 'default',
              background: 'rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(5px)',
              WebkitBackdropFilter: 'blur(5px)',
            }}
          />
        )}
      </AnimatePresence>

      </div>{/* /lower-section wrapper */}

    </div>
  );
};
