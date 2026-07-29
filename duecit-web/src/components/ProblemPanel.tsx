'use client';

import { useMemo, useState } from 'react';
import { marked } from 'marked';

interface Sample { input: string; output: string; }
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

type Tab = 'description' | 'io';

function diffBadge(difficulty?: string) {
  if (difficulty === 'easy') return { className: 'diff-badge-easy', label: 'Easy' };
  if (difficulty === 'medium') return { className: 'diff-badge-medium', label: 'Medium' };
  if (difficulty === 'hard') return { className: 'diff-badge-hard', label: 'Hard' };
  return null;
}

function renderMarkdown(text: string) {
  try {
    return marked.parse(text || '', { async: false }) as string;
  } catch {
    return `<pre>${text}</pre>`;
  }
}

function MarkdownBlock({ content }: { content: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return <div className="md-block min-w-0 max-w-full overflow-x-hidden break-words" dangerouslySetInnerHTML={{ __html: html }} />;
}

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
    <section
      className="relative flex h-full min-w-0 select-none flex-col overflow-hidden bg-[var(--panel)]"
      onCopy={(event) => event.preventDefault()}
      onCut={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      aria-label="Problem statement"
    >
      {watermark && (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden opacity-[0.035]" aria-hidden>
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="absolute whitespace-nowrap font-mono text-[10px] text-[var(--text)]" style={{ top: `${index * 10}%`, left: `${(index % 4) * 25}%`, transform: 'rotate(-22deg)' }}>
              {watermark}
            </div>
          ))}
        </div>
      )}

      <header className="shrink-0 border-b border-[var(--border)] px-5 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="min-w-0">
            <p className="terminal-kicker text-[var(--accent)]">problem statement // dsa-014</p>
            <h2 className="mt-3 truncate text-2xl font-semibold tracking-[-0.04em]" title={title}>{title}</h2>
          </div>
          {badge && <span className={`ml-auto shrink-0 ${badge.className}`}>{badge.label}</span>}
        </div>
        <div className="mt-5 flex gap-5" role="tablist" aria-label="Problem details">
          <button type="button" role="tab" aria-selected={activeTab === 'description'} onClick={() => setActiveTab('description')} className={`border-b-2 px-0 pb-3 font-mono text-[10px] uppercase tracking-[0.12em] ${activeTab === 'description' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'}`}>Problem</button>
          <button type="button" role="tab" aria-selected={activeTab === 'io'} onClick={() => setActiveTab('io')} className={`border-b-2 px-0 pb-3 font-mono text-[10px] uppercase tracking-[0.12em] ${activeTab === 'io' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'}`}>I/O Format</button>
        </div>
      </header>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 problem-statement">
        {activeTab === 'description' ? (
          <>
            <Section title="Description"><MarkdownBlock content={statement} /></Section>
            {constraints && <Section title="Constraints"><div className="constraints-block"><MarkdownBlock content={constraints} /></div></Section>}
            {safeSamples.length > 0 && <Section title="Examples">{safeSamples.map((sample, index) => <SampleBlock key={`${index}-${sample.input}`} index={index + 1} input={sample.input} output={sample.output} />)}</Section>}
          </>
        ) : (
          <>
            {inputFormat && <Section title="Input Format"><MarkdownBlock content={inputFormat} /></Section>}
            {outputFormat && <Section title="Output Format"><MarkdownBlock content={outputFormat} /></Section>}
            <Section title="How to Submit">
              {ioMode === 'function' ? (
                <div className="solution-hint-function">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">✦ function mode</p>
                  <p className="mt-2 text-xs leading-relaxed">Write <strong>only</strong> the required function. The hidden driver reads input, calls your solution, and prints the returned value.</p>
                  {(solutionSignature || signature?.funcName) && <pre className="solution-sig-block overflow-x-auto">{solutionSignature || `${signature?.funcName}(${(signature?.params || []).join(', ')})`}</pre>}
                  <p className="mt-2 text-xs text-[var(--text-muted)]">{language === 'java' && usesDriver ? 'Keep the Solution class and method shown in the editor.' : 'Return your answer from the function. Do not read stdin or print.'}</p>
                </div>
              ) : (
                <div className="solution-hint-raw">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">⚡ full program mode</p>
                  <p className="mt-2 text-xs leading-relaxed">Read input from <strong>stdin</strong> and write output to <strong>stdout</strong>. No prompts, labels, or extra text.</p>
                  <pre className="code-example-block overflow-x-auto">{`# Python example\nn = int(input())\narr = list(map(int, input().split()))\nprint(max(arr))`}</pre>
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-6"><h3 className="section-title">{title}</h3>{children}</section>;
}

function SampleBlock({ index, input, output }: { index: number; input: string; output: string }) {
  return (
    <div className="sample-block min-w-0">
      <div className="sample-label flex items-center justify-between gap-3"><span>Example {String(index).padStart(2, '0')}</span><span>expected / exact</span></div>
      <div className="sample-grid min-w-0"><div className="min-w-0"><div className="sample-io-label">Input</div><pre className="sample-io-code overflow-x-auto">{input}</pre></div><div className="min-w-0"><div className="sample-io-label">Output</div><pre className="sample-io-code overflow-x-auto">{output}</pre></div></div>
    </div>
  );
}
