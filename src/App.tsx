import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

import { ArchitectureSlide } from './slides/ArchitectureSlide';
import { ClaimMechanismSlide } from './slides/ClaimMechanismSlide';
import { StateMachineSlide } from './slides/StateMachineSlide';
import { DatabaseSchemaSlide } from './slides/DatabaseSchemaSlide';
import { SimulationSlide } from './slides/SimulationSlide';

import { TitleSlide } from './slides/TitleSlide';
import { ProblemSlide } from './slides/ProblemSlide';
import { LROIntroSlide } from './slides/LROIntroSlide';
import { TimelineSlide } from './slides/TimelineSlide';
import { FeaturesSlide } from './slides/FeaturesSlide';
import { VersioningSlide } from './slides/VersioningSlide';
import { UsagePatternsSlide } from './slides/UsagePatternsSlide';
import { DSFlowSlide } from './slides/DSFlowSlide';
import { SummarySlide } from './slides/SummarySlide';

type SlideGroup = 'intro' | 'big' | 'zoom-in' | 'zoom-out' | 'reference' | 'features' | 'outro';

interface SlideMeta {
  title: string;
  component: React.FC<{ isActive: boolean; goToSlide?: (target: number | string) => void }>;
  group: SlideGroup;
  subtitle?: string; // one-liner shown under the nav label
}

const slides: SlideMeta[] = [
  // ─── Intro ───────────────────────────────────────────────────────
  { title: 'Title',            component: TitleSlide,           group: 'intro',
    subtitle: 'cover · who and what' },
  { title: 'The Problem',      component: ProblemSlide,         group: 'intro',
    subtitle: 'why a framework at all' },
  { title: 'What is an LRO?',  component: LROIntroSlide,        group: 'intro',
    subtitle: 'definition · café analogy' },
  { title: 'Foundation',       component: TimelineSlide,        group: 'intro',
    subtitle: 'MLE services timeline' },

  // ─── The 5 polished core slides (untouched) ──────────────────────
  { title: 'Architecture',     component: ArchitectureSlide,    group: 'big',
    subtitle: 'the big picture' },
  { title: 'Claim Mechanism',  component: ClaimMechanismSlide,  group: 'zoom-in',
    subtitle: 'zoom in · Worker ↔ Postgres' },
  { title: 'State Machine',    component: StateMachineSlide,    group: 'zoom-in',
    subtitle: 'zoom in · the status column' },
  { title: 'Sandbox',          component: SimulationSlide,      group: 'zoom-out',
    subtitle: 'zoom out · everything, live' },
  { title: 'Database Schema',  component: DatabaseSchemaSlide,  group: 'reference',
    subtitle: 'reference · inside the tables' },

  // ─── Outro: features, usage, summary ─────────────────────────────
  { title: 'Built-in Features', component: FeaturesSlide,       group: 'features',
    subtitle: 'heartbeat · cache · GC · orchestration' },
  { title: 'Versioning',       component: VersioningSlide,      group: 'features',
    subtitle: 'semver match modes' },
  { title: 'How to Use It',    component: UsagePatternsSlide,   group: 'outro',
    subtitle: 'three files, that’s the whole service' },
  { title: 'DSFlow',           component: DSFlowSlide,          group: 'outro',
    subtitle: 'scaffold a service from YAML' },
  { title: 'Summary',          component: SummarySlide,         group: 'outro',
    subtitle: 'the whole thing on one screen' },
];

const GROUP_LABEL: Record<SlideGroup, string> = {
  'intro':     'Set the stage',
  'big':       'The big picture',
  'zoom-in':   'Zoom in',
  'zoom-out':  'Zoom out, live',
  'reference': 'Reference',
  'features':  'Built-in capabilities',
  'outro':     'Ship it',
};

const GROUP_ORDER: SlideGroup[] = ['intro', 'big', 'zoom-in', 'zoom-out', 'reference', 'features', 'outro'];

function App() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));
  const [direction, setDirection] = useState(0);
  // Sidebar collapse state — persisted across reloads so presenter setting sticks.
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('sidebarCollapsed') === '1'; } catch { return false; }
  });
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(c => {
      const next = !c;
      try { localStorage.setItem('sidebarCollapsed', next ? '1' : '0'); } catch {}
      return next;
    });
  }, []);

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= slides.length) return;
    setDirection(index > currentSlide ? 1 : -1);
    setCurrentSlide(index);
    setVisited(prev => { const next = new Set(Array.from(prev)); next.add(index); return next; });
  }, [currentSlide]);

  // Resolve either an index, an exact title, or a case-insensitive substring of a title.
  const goToSlide = useCallback((target: number | string) => {
    if (typeof target === 'number') {
      goTo(target);
      return;
    }
    const needle = target.toLowerCase();
    const exact = slides.findIndex(s => s.title.toLowerCase() === needle);
    if (exact >= 0) { goTo(exact); return; }
    const partial = slides.findIndex(s => s.title.toLowerCase().includes(needle));
    if (partial >= 0) goTo(partial);
  }, [goTo]);

  const goNext = useCallback(() => goTo(currentSlide + 1), [currentSlide, goTo]);
  const goPrev = useCallback(() => goTo(currentSlide - 1), [currentSlide, goTo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev]);

  const SlideComponent = slides[currentSlide].component;
  const progress = ((currentSlide + 1) / slides.length) * 100;

  return (
    <div className="app">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          gap: 8,
        }}>
          {!sidebarCollapsed && (
            <div style={{ minWidth: 0 }}>
              <h1 className="sidebar-title">postgres-lro</h1>
              <span className="sidebar-subtitle">package unpacked</span>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, lineHeight: 1, padding: 0,
              flexShrink: 0,
            }}
          >
            {sidebarCollapsed ? '›' : '‹'}
          </button>
        </div>
        <nav className="sidebar-nav">
          {GROUP_ORDER.map(group => {
            const groupSlides = slides
              .map((s, i) => ({ slide: s, index: i }))
              .filter(({ slide }) => slide.group === group);
            if (groupSlides.length === 0) return null;
            return (
              <div key={group} style={{ marginBottom: 10 }}>
                {!sidebarCollapsed && (
                  <div style={{
                    padding: '8px 20px 4px',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    fontFamily: 'monospace',
                  }}>
                    {GROUP_LABEL[group]}
                  </div>
                )}
                {groupSlides.map(({ slide, index }) => (
                  <button
                    key={index}
                    className={`nav-item ${index === currentSlide ? 'active' : ''}`}
                    onClick={() => goTo(index)}
                    title={sidebarCollapsed ? `${index + 1}. ${slide.title}` : undefined}
                    style={{
                      alignItems: 'flex-start',
                      justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                      padding: sidebarCollapsed ? '8px 0' : '10px 20px',
                    }}
                  >
                    <span className={`nav-number ${
                      index === currentSlide ? 'active' : visited.has(index) ? 'visited' : 'inactive'
                    }`}>
                      {visited.has(index) && index !== currentSlide ? '✓' : index + 1}
                    </span>
                    {!sidebarCollapsed && (
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span className="nav-label">{slide.title}</span>
                        {slide.subtitle && (
                          <span style={{
                            fontSize: 10,
                            color: '#475569',
                            fontFamily: 'monospace',
                            marginTop: 1,
                          }}>{slide.subtitle}</span>
                        )}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        {!sidebarCollapsed && (
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid #e2e8f0',
          }}>
            <div className="keyboard-hint">
              <span className="key-hint">
                <span className="key">←</span>
                <span className="key">→</span>
                navigate
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="main-content">
        <div className="slide-container">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: direction * 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -50 }}
              transition={{ duration: 0.3 }}
              style={{ height: '100%' }}
            >
              <SlideComponent isActive={true} goToSlide={goToSlide} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom bar */}
        <div className="bottom-bar">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="slide-counter">
            {currentSlide + 1} / {slides.length}
          </span>
          <div className="nav-buttons">
            <button className="nav-btn" onClick={goPrev} disabled={currentSlide === 0}>
              Previous
            </button>
            <button className="nav-btn" onClick={goNext} disabled={currentSlide === slides.length - 1}>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
