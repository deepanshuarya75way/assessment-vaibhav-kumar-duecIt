'use client';

import dynamic from 'next/dynamic';
import { useRef, useCallback, useEffect } from 'react';
import type { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useTheme } from '@/lib/theme';

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-[var(--editor-bg)] font-mono text-xs text-[var(--text-muted)]"><span className="run-spinner mr-2" /> loading solution.py…</div>,
});

export const LANGUAGES = [
  { id: 'python', label: 'Python 3' },
  { id: 'cpp', label: 'C++17' },
  { id: 'java', label: 'Java' },
] as const;

interface DuelEditorProps {
  language: string;
  onLanguageChange?: (lang: string) => void;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  onTabSwitch?: () => void;
  ioMode?: 'function' | 'raw';
  rated?: boolean;
  signature?: { funcName: string; params: string[] };
  solutionSignature?: string;
}

const LANG_MAP: Record<string, string> = { python: 'python', javascript: 'javascript', cpp: 'cpp', java: 'java', go: 'go', c: 'c' };

export default function DuelEditor({ language, onLanguageChange, value, onChange, readOnly = false, onTabSwitch, ioMode = 'raw', rated = false, signature, solutionSignature }: DuelEditorProps) {
  const { theme } = useTheme();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const prevLenRef = useRef(0);
  const valueRef = useRef(value);
  const isResettingRef = useRef(false);

  useEffect(() => { valueRef.current = value; }, [value]);

  const handleMount: OnMount = useCallback((ed, monaco) => {
    editorRef.current = ed;
    ed.onDidPaste(() => ed.trigger('keyboard', 'undo', null));
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => { /* paste is intentionally blocked */ });
    ed.onDidChangeModelContent(() => {
      if (isResettingRef.current) return;
      const currentLen = ed.getValue().length;
      const delta = currentLen - prevLenRef.current;
      if (delta > 500 && prevLenRef.current > 0) {
        isResettingRef.current = true;
        ed.setValue(valueRef.current);
        isResettingRef.current = false;
        prevLenRef.current = valueRef.current.length;
      } else {
        prevLenRef.current = currentLen;
      }
    });
  }, []);

  useEffect(() => {
    if (!onTabSwitch) return;
    const handler = () => onTabSwitch();
    window.addEventListener('blur', handler);
    return () => window.removeEventListener('blur', handler);
  }, [onTabSwitch]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--editor-bg)]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--editor-chrome)] px-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
        <div className="flex h-full items-center gap-4">
          <span className="flex h-full items-center gap-2 border-b-2 border-[var(--accent)] text-[var(--text)]"><span className="text-[var(--accent)]">{`{}`}</span> solution.py</span>
          <span className="hidden items-center gap-2 sm:flex"><span className="text-[var(--text-faint)]">▣</span> tests</span>
        </div>
        <span className="hidden text-[var(--accent)] sm:inline">opponent / 6 lines</span>
      </div>
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--border)] px-3 font-mono text-[10px] text-[var(--text-muted)]">
        <label className="flex items-center gap-2"><span className="text-[var(--text-faint)]">language</span><select className="border border-[var(--border)] bg-[var(--panel-raised)] px-2 py-1 text-[10px] text-[var(--text)] outline-none focus:border-[var(--accent)]" value={language} onChange={(e) => onLanguageChange?.(e.target.value)} disabled={readOnly}>{LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
        <span className={readOnly ? 'text-[var(--warning)]' : 'text-[var(--accent)]'}>{readOnly ? 'read phase / editor locked' : ioMode === 'function' ? `synced / ${rated ? 'rated' : 'practice'}` : `synced / no paste / ${rated ? 'rated' : 'practice'}`}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden border-x border-[var(--border)]" onCopy={(e) => !readOnly && e.preventDefault()} onCut={(e) => e.preventDefault()} onPaste={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
        <Editor height="100%" language={LANG_MAP[language] || 'python'} value={value} onChange={(v) => onChange(v || '')} onMount={handleMount} theme={theme === 'dark' ? 'vs-dark' : 'light'} options={{ readOnly, minimap: { enabled: false }, fontSize: 13, fontFamily: 'JetBrains Mono, Consolas, monospace', scrollBeyondLastLine: false, wordWrap: 'on', contextmenu: false, copyWithSyntaxHighlighting: false, lineNumbers: 'on', renderLineHighlight: 'line', padding: { top: 16, bottom: 16 } }} />
      </div>
      <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-3 py-2 font-mono text-[10px] text-[var(--text-muted)]"><span>{ioMode === 'function' ? <><span className="text-[var(--accent)]">function mode</span> · write {solutionSignature || signature?.funcName || 'solve()'} only</> : <>full program mode · stdin → stdout</>}</span><span className="hidden text-[var(--text-faint)] sm:inline">autosave: on</span></div>
    </div>
  );
}

export function getCodeLength(code: string) { return code.length; }
