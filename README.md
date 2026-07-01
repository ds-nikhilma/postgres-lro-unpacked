# postgres-lro · unpacked

> A reusable, React-based **interactive presentation framework**, and the deck I built with it for the **postgres-lro** Go library.

This repo is two things in one:

1. **A working deck** — 14 slides that walk an audience through `postgres-lro`, a PostgreSQL-backed work-queue framework for Long-Running Operations. Live simulations, click-to-explore state machines, real-time instruments, a step-through SQL race, a "watch a 4-minute request fail" playback, and more.
2. **A framework you can fork** — the slide registry, the navigation system, the design tokens, and the per-slide patterns are all generic. Strip out the postgres-lro slides, drop in your own, and you have your own interactive deck.

> 🎤 Originally presented at the **Waltham Show & Tell**.

![title slide](docs/screenshots/01-title.png)

---

## Table of contents

- [Why build a deck this way?](#why-build-a-deck-this-way)
- [The deck — slide tour](#the-deck--slide-tour)
- [Use it for your own presentations](#use-it-for-your-own-presentations)
  - [Quick start (5 minutes)](#quick-start-5-minutes)
  - [Build your first slide (10 minutes)](#build-your-first-slide-10-minutes)
  - [The slide registry](#the-slide-registry)
  - [Design language](#design-language)
  - [Patterns from the existing slides](#patterns-from-the-existing-slides)
- [Project anatomy](#project-anatomy)
- [Capturing screenshots](#capturing-screenshots)
- [Deploying](#deploying)
- [What is `postgres-lro` itself?](#what-is-postgres-lro-itself)
- [License](#license)

---

## Why build a deck this way?

Most decks die in two places: **Google Slides** (no interaction, no animation worth showing) and **Slidev/reveal.js** (great markup, but a click is rarely more than "next slide"). For technical talks where the *point* is "watch the system behave", neither is enough.

This framework leans on a small idea: a slide is just a React component. A whole deck is a `slides[]` array. Navigation is keyboard + sidebar. That's it. From there, every slide is free to be a fully animated, click-to-explore, framer-motion-driven mini-app — without you having to invent a "plugin system" or a "shortcode" language.

Costs:

- You're writing React, not Markdown. There's no shortcut for slide-as-component.
- There's no built-in PDF export.
- Speaker notes are not a primary feature (the slides themselves are the narration).

Benefits:

- Every slide can do whatever React can do: live simulations, controllable timelines, hover effects, SVG paths, drag, sound, anything.
- The same component patterns (event log + headline/detail explainer + reset button) compose across the deck — viewers learn the shape once.
- Slides survive ten years: it's plain TypeScript and CSS, no proprietary slide format.
- You can deep-link from one slide to another (`goToSlide('Architecture')`) so an interactive element can pull the audience to a deeper view on demand.

---

## The deck — slide tour

The deck is grouped into seven sections, going from *setup* → *core mechanics* → *built-in features* → *developer ergonomics*. The five sections in the middle are the heart of the talk; the intro and outro frame them.

### Set the stage

| # | Slide | What it shows |
|---|-------|---------------|
| 1 | **Title** — cover · live workitems pulse | The wordmark and a live `workitems_active`-style ticker that tells you immediately what kind of system this talk is about. ![title](docs/screenshots/01-title.png) |
| 2 | **The Problem** — watch a 4-min request fail | Two parallel timelines play in real time (20 s of playback = 4 minutes of work). The "without" lane shows the gateway killing the HTTP connection at 60 s while the work keeps running with no one listening. The "with" lane shows three short calls (submit → poll → result) on the same axis. ![problem](docs/screenshots/02-problem.png) |
| 3 | **What is an LRO?** — three calls, not one | The protocol, shown as a literal request/response log. Hover the three verbs (`POST /jobs`, `GET /jobs/{id}`, `DELETE /jobs/{id}`) for intent; press play to watch a real exchange unfold. ![lro intro](docs/screenshots/03-lro-intro.png) |
| 4 | **Foundation** — why a framework, not a library | A two-column "concern checklist": every claim/heartbeat/cache/GC concern that *used* to be copy-pasted ~200 LOC per service is now owned by the framework. Click a row to see what it actually requires. ![foundation](docs/screenshots/04-foundation.png) |

### The big picture

| # | Slide | What it shows |
|---|-------|---------------|
| 5 | **Architecture** — the big picture | End-to-end interactive architecture: Client → Handler → Service → Repository → PostgreSQL → Worker. "Run Flow" sends an animated dot through the system, hop by hop. Plain-English narration on each step. Plus four "what if?" scenarios (worker crashes, two workers race, cache hit, client polls). ![architecture](docs/screenshots/05-architecture.png) |

### Zoom in

| # | Slide | What it shows |
|---|-------|---------------|
| 6 | **Claim Mechanism** — Worker ↔ Postgres | Three workers race for three work items. SQL on the right (with `FOR UPDATE SKIP LOCKED` highlighted as the race plays), step-by-step explainer on the left, race log at the bottom. ![claim mechanism](docs/screenshots/06-claim-mechanism.png) |
| 7 | **State Machine** — the status column | An interactive `queued` → `running` → `{done,failed,canceled,expired}` graph. A glowing token sits on the current state; click an action to walk the token along its transition. Toggle "show technical" to see the Go API names. ![state machine](docs/screenshots/07-state-machine.png) |

### Zoom out, live

| # | Slide | What it shows |
|---|-------|---------------|
| 8 | **Sandbox** — everything, live | The full dashboard: submit/burst jobs, three crashable worker pods, live `workitems_active` / `workitems_inactive` tables, scrolling event log, stats bar. Drives the architecture from the top. ![sandbox](docs/screenshots/08-sandbox.png) |

### Reference

| # | Slide | What it shows |
|---|-------|---------------|
| 9 | **Database Schema** — inside the tables | Pick a lifecycle stage (queued · running · heartbeat · done · failed) and see the exact column values at that moment, with changed fields highlighted. The reference appendix. ![database schema](docs/screenshots/09-database-schema.png) |

### Built-in capabilities

| # | Slide | What it shows |
|---|-------|---------------|
| 10 | **Built-in Features** — four instruments, running live | Four mini-instruments side-by-side, all running at once: a beating heart with `claim_until` ticking down, a cache hit/miss sparkline with a rolling hit-rate, a GC broom sweeping inactive rows, and an orchestration tree where children flip queued→running→done. No tabs. The point is the *parallel* nature of the work. ![features](docs/screenshots/10-features.png) |
| 11 | **Versioning** — rolling deploy in flight | A six-pod fleet. Pick a constraint (`AT_LEAST`, `AT_LEAST_EXACT_MAJOR`, `AT_LEAST_EXACT_MINOR`, `EXACT`) and watch which pods are eligible to claim new jobs. Press "deploy v2.0.0" and watch the fleet rotate one pod at a time — in-flight jobs survive because their version is pinned at enqueue, not at claim. ![versioning](docs/screenshots/11-versioning.png) |

### Ship it

| # | Slide | What it shows |
|---|-------|---------------|
| 12 | **How to Use It** — before & after, side-by-side diff | Two columns: the same gRPC method, on the left as a hand-rolled synchronous handler (will time out), on the right rewritten to call `handler.Compute()`. Toggle "dim unchanged" to study just the diff; toggle "show inline notes" for line-level commentary. ![usage](docs/screenshots/12-usage.png) |
| 13 | **DSFlow** — 12 lines in, ~1.5k lines out | A YAML config on the left, a live LOC counter on the right. Press "dsflow generate" and watch eight buckets fill up: proto, service, worker, SQL, infra, k8s, tests, CI. Lands on `ratio · 1 : 123`. ![dsflow](docs/screenshots/13-dsflow.png) |
| 14 | **Summary** — one sentence · four receipts | The whole deck condensed into a single typed-out sentence (`one Postgres database · one Go library · three files per service · no new infrastructure · durable, versioned, observable.`), followed by four "receipts" the audience can take a picture of. ![summary](docs/screenshots/14-summary.png) |

---

## Use it for your own presentations

The fastest way to make this yours is to clone, run, delete my slides, and start adding your own. The framework gets out of the way.

### Quick start (5 minutes)

```bash
git clone https://github.com/<your-username>/postgres-lro-unpacked.git my-deck
cd my-deck
npm install
npm start
# open http://localhost:3000
```

Navigation:

| Key | Action |
|-----|--------|
| `→`, `↓`, `Space` | Next slide |
| `←`, `↑` | Previous slide |
| Sidebar | Jump to any slide |
| `‹` button | Collapse / expand sidebar |

> **Heads-up:** some slides (e.g. the Architecture slide) intercept `→` for an internal stepper. If you build a slide that needs the arrow key, hook your handler with `e.stopPropagation()` *or* leave navigation to the sidebar.

### Build your first slide (10 minutes)

A slide is a React component that receives `{ isActive, goToSlide }` and returns the slide UI. Walk through this template — every slide in this repo follows the same shape.

```tsx
// src/slides/MySlide.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';

export const MySlide: React.FC<SlideProps> = ({ isActive, goToSlide }) => {
  const [step, setStep] = useState(0);

  // Slides should `return null` when not active — they get unmounted on
  // navigation, so internal state resets naturally.
  if (!isActive) return null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', padding: '24px 32px', gap: 14,
    }}>
      {/* 1. Header — always the same shape: h2 + accent subtitle */}
      <div>
        <motion.h2
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0 }}
        >
          my slide
          <span style={{
            fontSize: 15, color: '#3b82f6', marginLeft: 12,
            fontFamily: 'monospace', fontWeight: 600,
          }}>
            · one-line subtitle
          </span>
        </motion.h2>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6, fontFamily: 'monospace' }}>
          a one-liner that tells the audience what to do
        </div>
      </div>

      {/* 2. Controls (if any) */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center',
        padding: '12px 16px', background: '#f8fafc',
        border: '1px solid #e2e8f0', borderRadius: 10,
      }}>
        <button
          onClick={() => setStep(s => s + 1)}
          style={{
            padding: '9px 18px', background: '#3b82f6', color: '#ffffff',
            border: 'none', borderRadius: 8,
            fontFamily: 'monospace', fontSize: 13, fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          ▶ next step
        </button>
        <button
          onClick={() => setStep(0)}
          style={{
            padding: '9px 14px', background: '#ffffff', color: '#475569',
            border: '1px solid #e2e8f0', borderRadius: 8,
            fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ↺ reset
        </button>
      </div>

      {/* 3. The body — let it grow to fill the rest of the slide */}
      <div style={{
        flex: 1, minHeight: 0,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ fontSize: 64, fontFamily: 'monospace', color: '#0f172a' }}
          >
            {step}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
```

Then register it in `src/App.tsx`:

```tsx
import { MySlide } from './slides/MySlide';

const slides: SlideMeta[] = [
  // …
  { title: 'My Slide', component: MySlide, group: 'features', subtitle: 'one-line hook' },
  // …
];
```

The slide shows up in the sidebar immediately. Hot reload works.

### The slide registry

`App.tsx` holds one source of truth — the `slides[]` array. Each entry is `{ title, component, group, subtitle? }`. The order in the array *is* the navigation order; the `group` decides how the sidebar sections.

```tsx
type SlideGroup = 'intro' | 'big' | 'zoom-in' | 'zoom-out' | 'reference' | 'features' | 'outro';

const slides: SlideMeta[] = [
  { title: 'Title',  component: TitleSlide,  group: 'intro', subtitle: '…' },
  // …
];

const GROUP_LABEL: Record<SlideGroup, string> = {
  'intro':     'Set the stage',
  'big':       'The big picture',
  'zoom-in':   'Zoom in',
  // …
};

const GROUP_ORDER: SlideGroup[] = ['intro', 'big', 'zoom-in', /* … */];
```

To add a new section, add to `SlideGroup`, `GROUP_LABEL`, and `GROUP_ORDER`. That's the whole "framework" — there is no plugin system.

Every slide receives the same props:

```ts
interface SlideProps {
  isActive: boolean;                              // gate animations on enter
  goToSlide?: (target: number | string) => void;  // deep-link to any slide
}
```

`goToSlide` accepts either an index or a case-insensitive substring of the title. Use it for cross-slide navigation — e.g. the `ArchitectureMini` "you-are-here" inset on the zoom-in slides links back to the full Architecture slide.

### Design 

The slides in this repo follow a small set of conventions. They aren't enforced — but if you follow them, every slide will look like it belongs to the same deck without you fighting CSS.

| Token | Value |
|-------|-------|
| Background | `#ffffff` |
| Panel | `#f8fafc` with `1px solid #e2e8f0` |
| Border-radius | `8px` (controls), `10–12px` (panels) |
| Text — primary | `#0f172a` |
| Text — secondary | `#334155` / `#475569` |
| Text — muted | `#94a3b8` |
| Slide pad | `padding: 24px 32px; gap: 12-16` |
| Header h2 | `fontSize: 28, fontWeight: 800` + a monospace subtitle in the slide's accent colour |
| Buttons | `padding: 9px 18px`, `borderRadius: 8`, monospace, `whileHover={{ y: -2 }}`, `whileTap={{ scale: 0.98 }}` |
| Body font | system sans |
| Code / labels / identifiers | monospace (`JetBrains Mono`, `Fira Code` fallback) |

**Per-slide accent colour.** Each slide picks one accent and uses it for the heading underscore, button background, panel borders, and the SQL/code highlight. The slide stays visually distinct without changing the whole theme.

| Slide | Accent |
|-------|--------|
| Title | cyan → violet gradient |
| The Problem | amber `#f59e0b` |
| What is an LRO? | cyan `#06b6d4` |
| Foundation | green `#22c55e` |
| Architecture | blue `#3b82f6` |
| Claim Mechanism | rose `#f43f5e` |
| State Machine | violet `#8b5cf6` |
| Sandbox | green `#22c55e` |
| Database Schema | cyan / orange |
| Built-in Features | violet `#8b5cf6` |
| Versioning | sky `#0ea5e9` |
| How to Use It | teal `#0f766e` |
| DSFlow | fuchsia `#a21caf` |
| Summary | slate (neutral) |

### Patterns from the existing slides

After 14 slides built this way, a handful of patterns recur. Steal them.

**Plain English over jargon, with a toggle.** Default narration is conversational ("worker grabs it"). A `Show technical` toggle reveals the Go API name (`ClaimWorkItem()`). Lets you write for the room without losing the engineers in the back.

**Headline + detail explainer.** Every interactive phase has two strings — a punchy headline (what's happening) and a reassuring detail (why it works). The audience can scan the headline or read the detail; both feel intentional.

**Event log on the right.** Every interactive slide has a chronological log of what just happened. It does the work of speaker notes without putting you behind a podium. New entries scroll into view, old entries dim.

**Happy path + edge paths.** Every interactive slide ships with a "walk the happy path" button so you don't have to remember the script. Then there are buttons for the interesting edge cases (worker crash, cache hit, race condition).

**Always a reset.** Every slide has a `↺ reset`. You will press it many times during rehearsal.

**`AnimatePresence mode="wait"`** when swapping content panels — content slides in/out cleanly without overlap.

**`if (!isActive) return null;`** at the top of every slide — kills background timers and prevents stale state.

**Deep-link from "you-are-here" insets.** When a slide zooms into one component of a system, render a small thumbnail of the full architecture with that component highlighted, and make it click-to-go-back. See `src/components/ArchitectureMini.tsx`.

**Presenter-paced timings.** Animations are deliberately slow — 1–2 seconds per state change, not 200 ms. Look at `ArchitectureSlide.tsx`'s `PACE` global; bump it to slow the whole deck, drop it to demo-speed for rehearsal.

---

## Project anatomy

```
src/
├── App.tsx                # slide registry, sidebar, keyboard nav
├── App.css                # layout for sidebar / bottom bar (everything else is inline styles per slide)
├── index.css              # globals
├── types.ts               # WorkItem + SlideProps
├── components/            # tiny shared building blocks
│   ├── ArchitectureMini.tsx   # "you are here" inset
│   ├── CodeBlock.tsx          # syntax-highlighted Go snippets
│   ├── DatabaseTable.tsx      # animated workitems_active / inactive table
│   ├── FlowArrow.tsx          # SVG animated arrows
│   └── StatusBadge.tsx        # pulsing status pills
└── slides/                # 14 slides, one file each
    ├── TitleSlide.tsx
    ├── ProblemSlide.tsx
    ├── LROIntroSlide.tsx
    ├── TimelineSlide.tsx
    ├── ArchitectureSlide.tsx
    ├── ClaimMechanismSlide.tsx
    ├── StateMachineSlide.tsx
    ├── SimulationSlide.tsx
    ├── DatabaseSchemaSlide.tsx
    ├── FeaturesSlide.tsx
    ├── VersioningSlide.tsx
    ├── UsagePatternsSlide.tsx
    ├── DSFlowSlide.tsx
    └── SummarySlide.tsx
```

Dependencies are deliberately small:

```jsonc
{
  "react": "^19",
  "react-dom": "^19",
  "framer-motion": "^12",
  "react-scripts": "5.0.1",     // CRA — but easy to migrate to Vite if you prefer
  "typescript": "^4.9"
}
```

No state management library, no router, no UI kit. Each slide composes whatever local React state it needs and animates with framer-motion. Total bundle is ~140 KB gzipped.

---

## Capturing screenshots

Screenshots live in `docs/screenshots/` and are referenced from this README. To refresh them after a UI change:

1. `npm start`
2. Open `http://localhost:3000` at viewport `1600 × 900`.
3. Click each sidebar item in turn and capture the viewport. Files are named `NN-<slug>.png` matching the slide order in the *Slide tour* table.

**Don't use arrow keys to navigate during capture.** The Architecture slide intercepts `ArrowRight` for its internal stepper, so a key-based capture loop drifts out of sync. Click the sidebar instead.

A Playwright MCP script for automating this is straightforward — see the conversation history in this repo's first commit if you want a starting point.

---

## Deploying

The project is a stock create-react-app, so it builds to a static `build/` folder:

```bash
npm run build
# build/ is now ready to deploy
```

**GitHub Pages**:

```bash
npm install gh-pages --save-dev
```

Add to `package.json`:

```jsonc
{
  "homepage": "https://<your-username>.github.io/<repo-name>/",
  "scripts": {
    "predeploy": "npm run build",
    "deploy":    "gh-pages -d build"
  }
}
```

Then `npm run deploy`.

**Netlify / Vercel / Cloudflare Pages**: point the build command at `npm run build` and the output dir at `build/`. Both work out of the box.

**Static hosting**: any web server can serve the `build/` directory. There are no server-side requirements.

---

## What is `postgres-lro` itself?

The Go library this deck is about. Two sub-modules:

- **`lro`** — the request side: gRPC API surface, durable storage of work items in PostgreSQL, expiring claims, request caching, version pinning.
- **`worker`** — the worker side: long-polls for work, runs your handler, heartbeats while alive, releases the claim when done.

You write three files (handler setup, request handler, worker) and you have a fault-tolerant, observable, version-aware queue service backed by one Postgres database. No Redis, no Kafka, no Temporal cluster.

The deck unpacks all of it.

---

## License

[MIT](LICENSE)
