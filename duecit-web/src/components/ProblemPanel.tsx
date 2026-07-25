'use client';

import { useState, useMemo } from 'react';
import { marked } from 'marked';

interface Sample {
  input: string;
  output: string;
}

interface ProblemPanelProps {
  title: string;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  samples: Sample[];
  difficulty?: string;
  watermark?: string;
  ioMode?: 'function' | 'raw';
  signature?: { funcName: string; params: string[] };
  language?: string;
  solutionSignature?: string;
  usesDriver?: boolean;
}

function diffBadge(d?: string) {
  if (d === 'easy') return { cls: 'diff-badge-easy', label: 'Easy' };
  if (d === 'medium') return { cls: 'diff-badge-medium', label: 'Medium' };
  if (d === 'hard') return { cls: 'diff-badge-hard', label: 'Hard' };
  return null;
}

function renderMarkdown(text: string): string {
  if (!text) return '';
  try {
    // marked.parse returns string when not async
    return marked.parse(text, { async: false }) as string;
  } catch {
    return `<pre style="white-space:pre-wrap">${text}</pre>`;
  }
}

function MarkdownBlock({ content }: { content: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return (
    <div
      className="md-block"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

type Tab = 'description' | 'io';

export default function ProblemPanel({
  title,
  statement,
  inputFormat,
  outputFormat,
  constraints,
  samples,
  difficulty,
  watermark,
  ioMode = 'raw',
  signature,
  language,
  solutionSignature,
  usesDriver = false,
}: ProblemPanelProps) {
  const safeSamples = Array.isArray(samples) ? samples : [];
  const [activeTab, setActiveTab] = useState<Tab>('description');
  const badge = diffBadge(difficulty);

  return (
    <div
      className="relative h-full flex flex-col bg-[var(--cf-panel)] select-none"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {/* Watermark overlay */}
      {watermark && (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.035] z-10"
          aria-hidden
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-[10px] font-mono whitespace-nowrap rotate-[-22deg] text-black"
              style={{ top: `${i * 10}%`, left: `${(i % 4) * 25}%` }}
            >
              {watermark}
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 px-4 pt-3 pb-0 border-b border-[var(--cf-border)]">
        <div className="flex items-start gap-2 mb-2">
          <h2 className="text-base font-bold text-[var(--cf-blue)] leading-snug flex-1">{title}</h2>
          {badge && (
            <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
              {badge.label}
            </span>
          )}
        </div>
        {/* Tabs */}
        <div className="flex gap-0">
          {(['description', 'io'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === t
                  ? 'border-[var(--cf-blue)] text-[var(--cf-blue)]'
                  : 'border-transparent text-[var(--cf-muted)] hover:text-[var(--cf-text)]'
              }`}
            >
              {t === 'description' ? 'Problem' : 'I/O Format'}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 problem-statement">
        {activeTab === 'description' && (
          <>
            {/* Statement */}
            <Section title="Description">
              <MarkdownBlock content={statement} />
            </Section>

            {/* Constraints */}
            {constraints && (
              <Section title="Constraints">
                <div className="constraints-block">
                  <MarkdownBlock content={constraints} />
                </div>
              </Section>
            )}

            {/* Samples */}
            {safeSamples.length > 0 && (
              <Section title="Examples">
                {safeSamples.map((s, i) => (
                  <SampleBlock key={i} index={i + 1} input={s.input} output={s.output} />
                ))}
              </Section>
            )}
          </>
        )}

        {activeTab === 'io' && (
          <>
            {inputFormat && (
              <Section title="Input Format">
                <MarkdownBlock content={inputFormat} />
              </Section>
            )}

            {outputFormat && (
              <Section title="Output Format">
                <MarkdownBlock content={outputFormat} />
              </Section>
            )}

            {/* How to write your solution */}
            <Section title="How to Submit">
              {ioMode === 'function' ? (
                <div className="solution-hint-function">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-emerald-600 font-bold text-xs">✦ FUNCTION MODE</span>
                  </div>
                  <p className="text-xs leading-relaxed mb-2">
                    Write <strong>only</strong> the required function below. The hidden driver reads
                    input, calls your solution, and prints the returned value.
                  </p>
                  {(solutionSignature || signature?.funcName) && (
                    <pre className="solution-sig-block">
                      {solutionSignature || `${signature?.funcName}(${(signature?.params || []).join(', ')})`}
                    </pre>
                  )}
                  <p className="text-xs text-[var(--cf-muted)] mt-2">
                    {language === 'java' && usesDriver
                      ? 'For Java: keep the Solution class and method shown in the editor. Do not write Main, main(), Scanner, or print statements.'
                      : 'Return your answer from the function. Do not read stdin or print anything yourself.'}
                  </p>
                </div>
              ) : (
                <div className="solution-hint-raw">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-blue-600 font-bold text-xs">⚡ FULL PROGRAM MODE</span>
                  </div>
                  <p className="text-xs leading-relaxed mb-2">
                    Read input from <strong>stdin</strong> and write output to <strong>stdout</strong>.
                    Do not print prompts, labels, or extra text — only the required output.
                  </p>
                  <pre className="code-example-block">{`# Python example
n = int(input())
arr = list(map(int, input().split()))
print(max(arr))  # replace with your logic`}</pre>
                  <p className="text-xs text-[var(--cf-muted)] mt-2">
                    Use &quot;Run Samples&quot; to test against the examples before submitting.
                  </p>
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="section-title">{title}</h3>
      {children}
    </div>
  );
}

function SampleBlock({ index, input, output }: { index: number; input: string; output: string }) {
  return (
    <div className="sample-block">
      <div className="sample-label">Example {index}</div>
      <div className="sample-grid">
        <div>
          <div className="sample-io-label">Input</div>
          <pre className="sample-io-code">{input}</pre>
        </div>
        <div>
          <div className="sample-io-label">Output</div>
          <pre className="sample-io-code">{output}</pre>
        </div>
      </div>
    </div>
  );
}
