'use client';

import dynamic from 'next/dynamic';
import { useRef, useCallback, useEffect } from 'react';
import type { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="h-full bg-[#1e1e1e] text-zinc-400 text-sm flex items-center justify-center">
      Loading editor...
    </div>
  ),
});
// comment here to mute languages
export const LANGUAGES = [
  { id: 'python', label: 'Python 3' },
  // { id: 'javascript', label: 'JavaScript' },
  // { id: 'cpp', label: 'C++17' },
  // { id: 'java', label: 'Java' },
  // { id: 'go', label: 'Go' },
  // { id: 'c', label: 'C' },
] as const;

interface DuelEditorProps {
  language: string;
  onLanguageChange?: (lang: string) => void;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  onTabSwitch?: () => void;
  // Whether the judge wraps this code (function-only, LeetCode-style) or
  // runs it raw (full program, stdin -> stdout). This is now driven purely
  // by whether the problem has a signature + the language supports wrapping
  // (see judge/wrapper.go) - it is NOT tied to competitive vs practice mode.
  // A problem with a signature gets function-only editing in BOTH modes;
  // a problem without one requires a full program in BOTH modes.
  ioMode?: 'function' | 'raw';
  // Whether this match affects ELO. Purely a match.mode concern, independent
  // of ioMode above - e.g. a rated competitive match can still be
  // function-only if the problem has a signature.
  rated?: boolean;
  signature?: { funcName: string; params: string[] };
  solutionSignature?: string;
}

const LANG_MAP: Record<string, string> = {
  python: 'python',
  //keeping these below languges nute because of debugging issues
  javascript: 'javascript', 
  cpp: 'cpp',
  java: 'java',
  go: 'go',
  c: 'c',
};

export default function DuelEditor({
  language,
  onLanguageChange,
  value,
  onChange,
  readOnly = false,
  onTabSwitch,
  ioMode = 'raw',
  rated = false,
  signature,
  solutionSignature,
}: DuelEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const prevLenRef = useRef(0);
  // Keep a ref to the latest value to avoid stale closures in onDidChangeModelContent
  const valueRef = useRef(value);
  const isResettingRef = useRef(false);

  // Sync ref whenever value prop changes
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const handleMount: OnMount = useCallback(
    (ed, monaco) => {
      editorRef.current = ed;

      ed.onDidPaste(() => {
        ed.trigger('keyboard', 'undo', null);
      });

      ed.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV,
        () => { /* blocked */ }
      );

      ed.onDidChangeModelContent(() => {
        // Skip if this change was triggered by our own setValue reset
        if (isResettingRef.current) return;

        const currentLen = ed.getValue().length;
        const delta = currentLen - prevLenRef.current;

        // Only block jumps > 500 chars AND only when previous content existed
        // Use valueRef.current (not stale captured value) to restore correctly
        if (delta > 500 && prevLenRef.current > 0) {
          isResettingRef.current = true;
          ed.setValue(valueRef.current);
          isResettingRef.current = false;
          prevLenRef.current = valueRef.current.length;
        } else {
          prevLenRef.current = currentLen;
        }
      });
    },
    [] // no deps needed — uses refs for latest values
  );

  useEffect(() => {
    if (!onTabSwitch) return;
    const handler = () => onTabSwitch();
    window.addEventListener('blur', handler);
    return () => window.removeEventListener('blur', handler);
  }, [onTabSwitch]);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="editor-toolbar flex items-center gap-3 px-3 py-1.5 text-sm text-zinc-300">
        <label className="flex items-center gap-2">
          <span className="text-zinc-500">Language:</span>
          <select
            className="bg-zinc-800 border border-zinc-600 text-zinc-200 px-2 py-0.5 text-xs rounded"
            value={language}
            onChange={(e) => onLanguageChange?.(e.target.value)}
            disabled={readOnly}
           >  
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))} 
          </select>
        </label>
        {readOnly && (
          <span className="text-yellow-500 text-xs ml-auto">Reading phase — editor locked</span>
        )}
        {!readOnly && ioMode === 'function' && (
          <span className="text-emerald-400 text-xs ml-auto">
            💡 Write only your{' '}
            <code className="bg-zinc-700 px-1 rounded">
              {signature?.funcName
                ? solutionSignature || `${signature.funcName}(${(signature.params || []).join(', ')})`
                : 'solve()'}
            </code>{' '}
            function, I/O is handled automatically
            {rated ? ' · Rated' : ' · Not rated'}
          </span>
        )}
        {!readOnly && ioMode === 'raw' && (
          <span className="text-blue-400 text-xs ml-auto">
            ⚡ Write the full program (stdin → stdout){rated ? ' · Rated' : ' · Not rated'}
          </span>
        )}
      </div>
      <div
        className="flex-1 min-h-0 border border-zinc-700 overflow-hidden"
        onCopy={(e) => !readOnly && e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        onPaste={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Editor
          height="100%"
          language={LANG_MAP[language] || 'python'}
          value={value}
          onChange={(v) => onChange(v || '')}
          onMount={handleMount}
          theme="vs-dark"
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: 'Consolas, "Courier New", monospace',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            contextmenu: false,
            copyWithSyntaxHighlighting: false,
            lineNumbers: 'on',
            renderLineHighlight: 'line',
          }}
        />
      </div>
    </div>
  );
}

export function getCodeLength(code: string) {
  return code.length;
}
