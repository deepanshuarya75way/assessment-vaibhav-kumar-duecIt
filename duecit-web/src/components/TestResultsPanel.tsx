'use client';

import { useState } from 'react';

export interface TestCaseResult {
  passed: boolean;
  verdict: string;
  input: string;
  expected: string;
  actual: string;
  error?: string;
  executionTime?: number;
}

interface TestResultsPanelProps {
  verdict?: string;
  passedCount?: number;
  totalCount?: number;
  testResults?: TestCaseResult[];
  isRunning?: boolean;
  isSubmitting?: boolean;
  mode: 'run' | 'submit' | 'idle';
  /** If true, show the full "waiting for opponent" status */
  submittedWaiting?: boolean;
}

const VERDICT_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  AC:  { label: 'Accepted',              color: '#16a34a', bg: '#dcfce7', icon: '✓' },
  WA:  { label: 'Wrong Answer',          color: '#dc2626', bg: '#fee2e2', icon: '✗' },
  CE:  { label: 'Compilation Error',     color: '#d97706', bg: '#fef3c7', icon: '⚠' },
  RE:  { label: 'Runtime Error',         color: '#9333ea', bg: '#f3e8ff', icon: '💥' },
  TLE: { label: 'Time Limit Exceeded',   color: '#0369a1', bg: '#e0f2fe', icon: '⏱' },
  ENGINE_ERROR: { label: 'Judge Error',  color: '#6b7280', bg: '#f3f4f6', icon: '⚙' },
  UNSUPPORTED_LANGUAGE: { label: 'Unsupported Language', color: '#6b7280', bg: '#f3f4f6', icon: '?' },
};

function getVerdictMeta(verdict?: string) {
  return verdict ? (VERDICT_META[verdict] || { label: verdict, color: '#6b7280', bg: '#f3f4f6', icon: '?' }) : null;
}

function VerdictBanner({ verdict, passedCount, totalCount, isRun }: {
  verdict?: string;
  passedCount?: number;
  totalCount?: number;
  isRun?: boolean;
}) {
  const meta = getVerdictMeta(verdict);
  if (!meta) return null;
  return (
    <div
      className="verdict-banner"
      style={{ background: meta.bg, borderColor: meta.color + '44' }}
    >
      <span className="verdict-icon" style={{ color: meta.color }}>{meta.icon}</span>
      <div className="flex flex-col">
        <span className="verdict-label" style={{ color: meta.color }}>{meta.label}</span>
        {typeof passedCount === 'number' && typeof totalCount === 'number' && totalCount > 0 && (
          <span className="verdict-sub">
            {isRun ? 'Sample' : 'Test'} cases: {passedCount}/{totalCount} passed
          </span>
        )}
      </div>
      {/* Progress bar for multiple test cases */}
      {typeof passedCount === 'number' && typeof totalCount === 'number' && totalCount > 0 && (
        <div className="verdict-progress-wrap">
          <div
            className="verdict-progress-fill"
            style={{
              width: `${Math.round((passedCount / totalCount) * 100)}%`,
              background: meta.color,
            }}
          />
        </div>
      )}
    </div>
  );
}

function ErrorBlock({ error, verdict }: { error: string; verdict?: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = error.split('\n');
  const preview = lines.slice(0, 4).join('\n');
  const hasMore = lines.length > 4;

  const isCE = verdict === 'CE';
  const isRE = verdict === 'RE';
  const borderColor = isCE ? '#d97706' : isRE ? '#9333ea' : '#6b7280';
  const bgColor = isCE ? '#fffbeb' : isRE ? '#faf5ff' : '#f9fafb';
  const labelColor = isCE ? '#92400e' : isRE ? '#581c87' : '#374151';
  const errorLabel = isCE ? 'Compilation Error Output' : isRE ? 'Runtime Error Output' : 'Error Output';

  return (
    <div className="error-block" style={{ borderColor, background: bgColor }}>
      <div className="error-label" style={{ color: labelColor }}>
        {errorLabel}
      </div>
      <pre className="error-text">
        {expanded ? error : preview}
        {!expanded && hasMore && <span className="text-gray-400"> …</span>}
      </pre>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="error-expand-btn"
          style={{ color: borderColor }}
        >
          {expanded ? '▲ Collapse' : `▼ Show ${lines.length - 4} more lines`}
        </button>
      )}
    </div>
  );
}

function TestCaseCard({ tc, index }: { tc: TestCaseResult; index: number }) {
  const [open, setOpen] = useState(!tc.passed && index === 0);
  const meta = getVerdictMeta(tc.verdict);

  return (
    <div className={`tc-card ${tc.passed ? 'tc-pass' : 'tc-fail'}`}>
      {/* Card header */}
      <button
        className="tc-header"
        onClick={() => setOpen(!open)}
      >
        <span className="tc-number">Case {index + 1}</span>
        {meta && (
          <span className="tc-verdict-pill" style={{ background: meta.bg, color: meta.color }}>
            {meta.icon} {meta.label}
          </span>
        )}
        {typeof tc.executionTime === 'number' && (
          <span className="tc-time">{tc.executionTime}ms</span>
        )}
        <span className="tc-chevron">{open ? '▼' : '▶'}</span>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="tc-body">
          {/* Input */}
          <div className="tc-row">
            <div className="tc-row-label">Input</div>
            <pre className="tc-code tc-input-code">{tc.input || '(empty)'}</pre>
          </div>

          {/* Expected */}
          <div className="tc-row">
            <div className="tc-row-label">Expected Output</div>
            <pre className="tc-code tc-expected-code">{tc.expected || '(empty)'}</pre>
          </div>

          {/* Actual */}
          {!tc.passed && (
            <div className="tc-row">
              <div className="tc-row-label">Your Output</div>
              <pre className={`tc-code ${tc.actual ? 'tc-actual-code' : 'tc-empty-code'}`}>
                {tc.actual || '(no output)'}
              </pre>
            </div>
          )}

          {/* Error message */}
          {tc.error && <ErrorBlock error={tc.error} verdict={tc.verdict} />}
        </div>
      )}
    </div>
  );
}

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div className="run-loading">
      <div className="run-spinner" />
      <span className="run-loading-text">{label}</span>
    </div>
  );
}

export default function TestResultsPanel({
  verdict,
  passedCount,
  totalCount,
  testResults,
  isRunning,
  isSubmitting,
  mode,
  submittedWaiting,
}: TestResultsPanelProps) {
  // Global CE/RE error (from first failing case)
  const globalError = testResults?.find(t => t.error && !t.passed)?.error;
  const globalVerdict = verdict || testResults?.find(t => !t.passed)?.verdict;

  if (isRunning) return <LoadingSpinner label="Running against sample cases…" />;
  if (isSubmitting) return <LoadingSpinner label="Submitting — judging all test cases…" />;

  if (mode === 'idle') return (
    <div className="run-idle">
      <span className="run-idle-icon">▶</span>
      <span>Run Samples to test your code, or Submit to judge all test cases.</span>
    </div>
  );

  return (
    <div className="results-panel">
      {/* Overall verdict */}
      <VerdictBanner
        verdict={verdict}
        passedCount={passedCount}
        totalCount={totalCount}
        isRun={mode === 'run'}
      />

      {/* Submitted waiting message */}
      {submittedWaiting && (
        <div className="submitted-waiting">
          <span className="waiting-spinner" />
          <span>Submitted — waiting for opponent or time limit…</span>
        </div>
      )}

      {/* Global error (CE / Engine error) shown once */}
      {globalError && (globalVerdict === 'CE' || globalVerdict === 'ENGINE_ERROR') && (
        <div className="px-3 pb-1">
          <ErrorBlock error={globalError} verdict={globalVerdict} />
        </div>
      )}

      {/* Per-case breakdown */}
      {testResults && testResults.length > 0 && (
        <div className="tc-list">
          <div className="tc-list-header">
            Test Cases ({testResults.filter(t => t.passed).length}/{testResults.length} passed)
          </div>
          {testResults.map((tc, i) => (
            <TestCaseCard key={i} tc={tc} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
