'use client';

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
}

function diffClass(d?: string) {
  if (d === 'easy') return 'diff-easy';
  if (d === 'medium') return 'diff-medium';
  if (d === 'hard') return 'diff-hard';
  return '';
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
}: ProblemPanelProps) {
  return (
    <div
      className="relative h-full overflow-y-auto cf-panel p-4 select-none problem-statement"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {watermark && (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.04] z-10"
          aria-hidden
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-xs font-mono whitespace-nowrap rotate-[-25deg] text-black"
              style={{ top: `${i * 12}%`, left: `${(i % 3) * 30}%` }}
            >
              {watermark}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mb-3 border-b border-[var(--cf-border)] pb-2">
        <h2 className="text-lg font-bold text-[var(--cf-blue)]">{title}</h2>
        {difficulty && (
          <span className={`text-xs uppercase ${diffClass(difficulty)}`}>
            {difficulty}
          </span>
        )}
      </div>

      <Section title="Problem Statement">
        <p className="whitespace-pre-wrap leading-relaxed">{statement}</p>
      </Section>

      <Section title="Input">
        <pre className="whitespace-pre-wrap font-mono text-xs bg-[#f8f8f8] border border-[#ddd] p-2">{inputFormat}</pre>
      </Section>

      <Section title="Output">
        <pre className="whitespace-pre-wrap font-mono text-xs bg-[#f8f8f8] border border-[#ddd] p-2">{outputFormat}</pre>
      </Section>

      <Section title="Constraints">
        <pre className="whitespace-pre-wrap font-mono text-xs bg-[#f8f8f8] border border-[#ddd] p-2">{constraints}</pre>
      </Section>

      <Section title="Examples">
        {samples.map((s, i) => (
          <div key={i} className="mb-3">
            <div className="font-bold text-xs mb-1">Example {i + 1}</div>
            <div className="font-mono text-xs">
              <div className="mb-1">
                <span className="font-bold">Input</span>
                <pre className="bg-[#f8f8f8] border border-[#ddd] p-2 mt-0.5">{s.input}</pre>
              </div>
              <div>
                <span className="font-bold">Output</span>
                <pre className="bg-[#f8f8f8] border border-[#ddd] p-2 mt-0.5">{s.output}</pre>
              </div>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="font-bold text-sm mb-1.5">{title}</h3>
      {children}
    </div>
  );
}
