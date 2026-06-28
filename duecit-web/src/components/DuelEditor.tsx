'use client';

import { useRef, useCallback, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

export const LANGUAGES = [
  { id: 'python', label: 'Python 3' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'cpp', label: 'C++17' },
  { id: 'java', label: 'Java' },
  { id: 'go', label: 'Go' },
  { id: 'c', label: 'C' },
] as const;

interface DuelEditorProps {
  language: string;
  onLanguageChange?: (lang: string) => void;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  onTabSwitch?: () => void;
}

const LANG_MAP: Record<string, string> = {
  python: 'python',
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
}: DuelEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const prevLenRef = useRef(0);

  const handleMount: OnMount = useCallback(
    (ed) => {
      editorRef.current = ed;

      ed.onDidPaste(() => {
        ed.trigger('keyboard', 'undo', null);
      });

      ed.addCommand(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).monaco?.KeyMod?.CtrlCmd | (window as any).monaco?.KeyCode?.KeyV,
        () => { /* blocked */ }
      );

      ed.onDidChangeModelContent(() => {
        const len = ed.getValue().length;
        if (len - prevLenRef.current > 500 && prevLenRef.current > 0) {
          ed.setValue(value);
        }
        prevLenRef.current = ed.getValue().length;
      });
    },
    [value]
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
