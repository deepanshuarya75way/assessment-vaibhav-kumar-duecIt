'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Trophy, RotateCcw, ChevronUp, ChevronDown, Share2, AlertTriangle, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { wsClient } from '@/lib/ws';
import { ratingClass } from '@/components/AppNav';
import ProblemPanel from '@/components/ProblemPanel';
import DuelEditor, { getCodeLength } from '@/components/DuelEditor';
import MatchTimer from '@/components/MatchTimer';
import AntiCapture from '@/components/AntiCapture';
import TestResultsPanel, { type TestCaseResult } from '@/components/TestResultsPanel';


const WRAPPER_SUPPORTED_LANGS = ['python', 'javascript', 'go', 'java', 'cpp', 'c'];

interface Problem {
  id: string; title: string; statement: string;
  inputFormat: string; outputFormat: string; constraints: string;
  difficulty?: string;
  samples: { input: string; output: string }[];
  starterCode?: Record<string, string>;
  inputSpec?: InputVar[];
  signature?: { funcName: string; params: string[]; returnType: string };
  driverLanguages?: string[];
}

interface InputVar { name: string; type: string; lengthVar?: string; passToFunc?: boolean; }

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}
function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeProblem(value: unknown): Problem {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const signatureRaw = raw.signature && typeof raw.signature === 'object' ? raw.signature as Record<string, unknown> : null;
  const signature = signatureRaw ? {
    funcName: typeof signatureRaw.funcName === 'string' ? signatureRaw.funcName : '',
    params: toStringArray(signatureRaw.params),
    returnType: typeof signatureRaw.returnType === 'string' ? signatureRaw.returnType : '',
  } : undefined;
  const starterRaw = raw.starterCode && typeof raw.starterCode === 'object' ? raw.starterCode as Record<string, unknown> : {};
  const starterCode = Object.fromEntries(Object.entries(starterRaw).filter((e): e is [string, string] => typeof e[1] === 'string'));
  const inputSpec = Array.isArray(raw.inputSpec)
    ? raw.inputSpec.map((item) => {
      const v = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return { name: typeof v.name === 'string' ? v.name : '', type: typeof v.type === 'string' ? v.type : 'string', lengthVar: typeof v.lengthVar === 'string' ? v.lengthVar : undefined, passToFunc: typeof v.passToFunc === 'boolean' ? v.passToFunc : undefined };
    }).filter((v) => v.name)
    : [];
  const samples = Array.isArray(raw.samples)
    ? raw.samples.map((s) => { const o = s && typeof s === 'object' ? s as Record<string, unknown> : {}; return { input: typeof o.input === 'string' ? o.input : '', output: typeof o.output === 'string' ? o.output : '' }; })
    : [];
  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    title: typeof raw.title === 'string' ? raw.title : 'Untitled problem',
    statement: typeof raw.statement === 'string' ? raw.statement : '',
    inputFormat: typeof raw.inputFormat === 'string' ? raw.inputFormat : '',
    outputFormat: typeof raw.outputFormat === 'string' ? raw.outputFormat : '',
    constraints: typeof raw.constraints === 'string' ? raw.constraints : '',
    difficulty: typeof raw.difficulty === 'string' ? raw.difficulty : undefined,
    samples, starterCode, inputSpec, signature,
    driverLanguages: toStringArray(raw.driverLanguages),
  };
}

function normalizeOpponent(value: unknown): Opponent {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { userId: typeof raw.userId === 'string' ? raw.userId : '', username: typeof raw.username === 'string' ? raw.username : 'opponent', rating: toNumber(raw.rating) };
}

function computeIoMode(problem: Problem | undefined, language: string): 'function' | 'raw' {
  if (!problem) return 'raw';
  return (!!problem.driverLanguages?.includes(language) || (WRAPPER_SUPPORTED_LANGS.includes(language) && !!problem.signature?.funcName)) ? 'function' : 'raw';
}
function hasHiddenDriver(problem: Problem | undefined, language: string) { return !!problem?.driverLanguages?.includes(language); }
function getParamType(problem: Problem, param: string) { return problem.inputSpec?.find((v) => v.name === param)?.type || 'string'; }
function getParamSpec(problem: Problem, param: string) { return problem.inputSpec?.find((v) => v.name === param); }
function javaType(t: string) { return ({ int: 'int', float: 'double', bool: 'boolean', string: 'String', 'int[]': 'int[]', 'float[]': 'double[]', 'string[]': 'String[]' } as Record<string, string>)[t] || 'Object'; }
function cppType(t: string) { return ({ int: 'int', float: 'double', bool: 'bool', string: 'string', 'int[]': 'vector<int>', 'float[]': 'vector<double>', 'string[]': 'vector<string>' } as Record<string, string>)[t] || 'auto'; }
function goType(t: string) { return ({ int: 'int', float: 'float64', bool: 'bool', string: 'string', 'int[]': '[]int', 'float[]': '[]float64', 'string[]': '[]string' } as Record<string, string>)[t] || 'interface{}'; }
function cType(t: string) { if (t === 'float') return 'double'; if (t === 'bool') return 'bool'; if (t === 'string') return 'char*'; if (t.endsWith('[]')) return t === 'float[]' ? 'double*' : t === 'string[]' ? 'char**' : 'int*'; return 'int'; }
function defaultReturn(type: string, language: string) {
  if (type.endsWith('[]')) { if (language === 'java') return type === 'int[]' ? 'return new int[0];' : type === 'float[]' ? 'return new double[0];' : 'return new String[0];'; if (language === 'cpp') return 'return {};'; if (language === 'go') return 'return nil'; if (language === 'c') return 'return NULL;'; return 'return [];'; }
  if (type === 'bool') return language === 'python' ? 'return False' : 'return false;';
  if (type === 'string') return language === 'python' ? "return ''" : 'return "";';
  if (type === 'float') return (language === 'python' || language === 'go') ? 'return 0.0' : 'return 0.0;';
  return (language === 'python' || language === 'go') ? 'return 0' : 'return 0;';
}
function functionSignatureForLanguage(language: string, problem: Problem, driverMode: boolean) {
  const sig = problem.signature; if (!sig?.funcName) return '';
  const params = sig.params || [];
  if (language === 'python') return `def ${sig.funcName}(${params.join(', ')}):`;
  if (language === 'javascript') return `function ${sig.funcName}(${params.join(', ')})`;
  if (language === 'go') { const typed = params.map((p) => `${p} ${goType(getParamType(problem, p))}`).join(', '); return `func ${sig.funcName}(${typed}) ${goType(sig.returnType)}`; }
  if (language === 'java') { const typed = params.map((p) => `${javaType(getParamType(problem, p))} ${p}`).join(', '); const method = `public static ${javaType(sig.returnType)} ${sig.funcName}(${typed})`; return driverMode ? `class Solution { ${method} }` : method; }
  if (language === 'cpp') { const typed = params.map((p) => { const t = cppType(getParamType(problem, p)); return getParamType(problem, p).endsWith('[]') ? `const ${t}& ${p}` : `${t} ${p}`; }).join(', '); return `${cppType(sig.returnType)} ${sig.funcName}(${typed})`; }
  if (language === 'c') { const typed: string[] = []; params.forEach((p) => { const spec = getParamSpec(problem, p); const t = spec?.type || 'int'; typed.push(`${cType(t)} ${p}`); if (t.endsWith('[]')) typed.push(`int ${p}Size`); }); if (sig.returnType.endsWith('[]')) typed.push('int* returnSize'); return `${cType(sig.returnType)} ${sig.funcName}(${typed.join(', ')})`; }
  return `${sig.funcName}(${params.join(', ')})`;
}
function buildFunctionStarter(language: string, problem?: Problem, driverMode = false) {
  if (!problem?.signature?.funcName) return '';
  const sigText = functionSignatureForLanguage(language, problem, driverMode);
  const ret = defaultReturn(problem.signature.returnType, language);
  if (language === 'python') return `${sigText}\n    # write your logic here\n    ${ret}\n`;
  if (language === 'javascript') return `${sigText} {\n  // write your logic here\n  ${ret}\n}\n`;
  if (language === 'java') { const method = functionSignatureForLanguage(language, problem, false); const body = `    ${method} {\n        // write your logic here\n        ${ret}\n    }`; return driverMode ? `class Solution {\n${body}\n}\n` : `${method} {\n    // write your logic here\n    ${ret}\n}\n`; }
  if (language === 'cpp' || language === 'c' || language === 'go') { const indent = language === 'go' ? '\t' : '    '; return `${sigText} {\n${indent}// write your logic here\n${indent}${ret}\n}\n`; }
  return '';
}
function starterLooksFunctionOnly(starter: string, problem: Problem | undefined, language: string) {
  if (!starter || !problem?.signature?.funcName || !starter.includes(problem.signature.funcName)) return false;
  const rawMarkers = ['public class Main', 'static void main', 'int main(', 'func main(', 'readFileSync(0', 'Scanner sc'];
  if (rawMarkers.some((m) => starter.includes(m))) return false;
  if (language === 'java' && hasHiddenDriver(problem, language) && !starter.includes('class Solution')) return false;
  return true;
}

function verdictLabel(verdict?: string) {
  switch (verdict) {
    case 'AC': return 'Accepted';
    case 'WA': return 'Wrong Answer';
    case 'CE': return 'Compilation Error';
    case 'RE': return 'Runtime Error';
    case 'TLE': return 'Time Limit Exceeded';
    case 'UNSUPPORTED_LANGUAGE': return 'Unsupported Language';
    case 'ENGINE_ERROR': return 'Judge Error';
    default: return 'Result';
  }
}

interface Opponent { userId: string; username: string; rating: number; }
interface MatchState {
  matchId: string; problem: Problem; opponent: Opponent; mode: string; language: string;
  serverTime: number; codingStartsAt: number; codingEndsAt: number; readPhaseSec: number;
}

/* ─── Main DuelPage ─────────────────────────────────────────────────── */
export default function DuelPage() {


  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const matchId = params.matchId as string;

  const [match, setMatch] = useState<MatchState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [phase, setPhase] = useState<'reading' | 'coding' | 'finished'>('reading');
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const prevCodeLen = useRef(0);
  const matchInitialized = useRef(false);
  const [runResult, setRunResult] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedWaiting, setSubmittedWaiting] = useState(false);
  const [tabWarnings, setTabWarnings] = useState(0);
  const [opponentProgress, setOpponentProgress] = useState('');
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [runDetails, setRunDetails] = useState<TestCaseResult[] | null>(null);
  const [runVerdict, setRunVerdict] = useState<string | undefined>(undefined);
  const [runPassedCount, setRunPassedCount] = useState<number | undefined>(undefined);
  const [runTotalCount, setRunTotalCount] = useState<number | undefined>(undefined);
  const [resultsPanelMode, setResultsPanelMode] = useState<'idle' | 'run' | 'submit'>('idle');
  const [resultsPanelOpen, setResultsPanelOpen] = useState(false);
  const [phaseFlash, setPhaseFlash] = useState(false);
  const [tabWarningMessage, setTabWarningMessage] = useState('');


  useEffect(() => {
    if (!match) return;

    try {
      localStorage.setItem(`duel:${matchId}:language`, language);
      localStorage.setItem(`duel:${matchId}:code:${language}`, code)
    } catch (error) {
      console.log('could not save it')
    }
  }, [match, matchId, language, code])

  
  const loadStarterCode = useCallback((lang: string, problem?: Problem) => {
    const ioMode = computeIoMode(problem, lang);
    const key = ioMode === 'function' ? `${lang}_practice` : lang;
    const driverMode = hasHiddenDriver(problem, lang);
    const generated = buildFunctionStarter(lang, problem, driverMode);
    const practiceStarter = problem?.starterCode?.[key] || '';
    const legacyStarter = problem?.starterCode?.[lang] || '';
    const starter = ioMode === 'function'
      ? (driverMode && generated ? generated : practiceStarter || (starterLooksFunctionOnly(legacyStarter, problem, lang) ? legacyStarter : generated) || '')
      : legacyStarter;
    setCode(starter);
    prevCodeLen.current = starter.length;
  }, []);

  const initMatch = useCallback((data: Record<string, unknown>) => {
    const matchLanguage = typeof data.language === 'string' && data.language ? data.language : 'python';
    const m: MatchState = {
      matchId: typeof data.matchId === 'string' ? data.matchId : matchId,
      problem: normalizeProblem(data.problem),
      opponent: normalizeOpponent(data.opponent),
      mode: typeof data.mode === 'string' ? data.mode : 'competitive',
      language: matchLanguage,
      serverTime: toNumber(data.serverTime) || Date.now(),
      codingStartsAt: toNumber(data.codingStartsAt),
      codingEndsAt: toNumber(data.codingEndsAt),
      readPhaseSec: toNumber(data.readPhaseSec),
    };
    setMatch(m);
    setLoadError('');
    if (!matchInitialized.current) {
      matchInitialized.current = true;
      let savedLanguage = matchLanguage;
      let savedCode: string | null = null;

      try {
        savedLanguage = localStorage.getItem(`duel:${matchId}:language`) || matchLanguage

        savedCode = localStorage.getItem(`duel:${matchId}:code:${savedLanguage}`)
      } catch {

      }
      setLanguage(matchLanguage);
      if (savedCode !== null) {
        setCode(savedCode);
        prevCodeLen.current = savedCode.length
      } else {
        loadStarterCode(matchLanguage, m.problem);
      }

    }
    const now = Date.now();
    const status = data.status as string | undefined;
    const serverPhase = data.phase as string;
    if (status === 'finished' || serverPhase === 'finished') { setPhase('finished'); }
    else if ((m.codingStartsAt > 0 && now >= m.codingStartsAt) || serverPhase === 'coding') { setPhase('coding'); }
    else { setPhase('reading'); }
    if (data.hasSubmitted) { setSubmitted(true); setRunResult('Submitted — waiting for opponent or timeout…'); }
  }, [matchId, loadStarterCode]);

  const fetchMatchResult = useCallback(async () => {
    try {
      const result = await api.getMatchResult(matchId);
      setResults(result); setPhase('finished'); setRunResult('Match completed.');
      
      sessionStorage.removeItem(`match:${matchId}`);
      return true;
    } catch { return false; }
  }, [matchId]);

  const syncMatchDetails = useCallback(async () => {
    try {
      const details = await api.getMatchDetails(matchId);
      if (!details) return;
      const d = details as Record<string, unknown>;
      setMatch((prev) => !prev ? prev : { ...prev, serverTime: toNumber(d.serverTime) || prev.serverTime, codingStartsAt: toNumber(d.codingStartsAt) || prev.codingStartsAt, codingEndsAt: toNumber(d.codingEndsAt) || prev.codingEndsAt });
      const serverPhase = d.phase as string;
      const status = d.status as string | undefined;
      if (status === 'finished' || serverPhase === 'finished') { await fetchMatchResult(); }
      else if (serverPhase === 'coding') { setPhase('coding'); }
      sessionStorage.setItem(`match:${matchId}`, JSON.stringify(details));
    } catch { /* ignore */ }
  }, [matchId, fetchMatchResult]);

  useEffect(() => {
    if (!user) return
    const handleOnline = () => {
      syncMatchDetails().catch(console.error)
    }

    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('online', handleOnline)
    }

  }, [user, syncMatchDetails])

  useEffect(()=>{
    if(!match || phase==='finished') return

    const id = setInterval(()=>{
      syncMatchDetails().catch(()=>{})
    },5000)
    return()=> clearInterval(id);
  },[match,phase,syncMatchDetails])


  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('accessToken');
    if (token) wsClient.connect(token).catch(() => { });
    const loadMatch = async () => {
      let loadedFromStorage = false;
      const stored = sessionStorage.getItem(`match:${matchId}`);
      if (stored) { try { initMatch(JSON.parse(stored)); loadedFromStorage = true; } catch { /* fall through */ } }
      try {
        const details = await api.getMatchDetails(matchId);
        if (details) {
          initMatch(details as Record<string, unknown>);
          sessionStorage.setItem(`match:${matchId}`, JSON.stringify(details));
          if ((details as Record<string, unknown>).phase === 'finished' || (details as Record<string, unknown>).status === 'finished') await fetchMatchResult();
        } else if (!loadedFromStorage) { setLoadError('Match data was not available. The match may have expired or been removed.'); }
      } catch (err) { if (!loadedFromStorage) setLoadError(err instanceof Error ? err.message : 'Could not load match data.'); }
    };
    loadMatch();
    const unsubFound = wsClient.on('match:found', (data) => { if ((data.matchId as string) === matchId) { sessionStorage.setItem(`match:${matchId}`, JSON.stringify(data)); initMatch(data); } });
    const unsubCoding = wsClient.on('match:coding_start', (data) => {
      if ((data.matchId as string) === matchId) {
        setPhase('coding');
        setPhaseFlash(true);
        setTimeout(() => setPhaseFlash(false), 2000);
        if (data.codingEndsAt) setMatch((m) => m ? { ...m, codingEndsAt: data.codingEndsAt as number } : m);
      }
    });
    const unsubProgress = wsClient.on('submission:progress', (data) => { if (data.userId !== user.id) setOpponentProgress(`${data.passedCount}/${data.totalCount}${data.isFullAC ? ' ✓' : ''}`); });
    const unsubFinished = wsClient.on('match:finished', (data) => { setPhase('finished'); setResults(data); setRunResult('Match completed.'); sessionStorage.removeItem(`match:${matchId}`); });
    return () => { unsubFound(); unsubCoding(); unsubProgress(); unsubFinished(); };
  }, [user, matchId, initMatch, fetchMatchResult]);

  useEffect(() => { if (!match || phase === 'finished') return; const id = setInterval(() => syncMatchDetails().catch(() => { }), 5000); return () => clearInterval(id); }, [match, phase, syncMatchDetails]);
  useEffect(() => { if (phase !== 'finished' && !results && match && match.codingEndsAt > 0 && Date.now() >= match.codingEndsAt) { const id = setTimeout(() => fetchMatchResult().catch(() => { }), 0); return () => clearTimeout(id); } }, [phase, results, match, fetchMatchResult]);
  useEffect(() => { if (!submitted || results || phase === 'finished') return; const id = setInterval(() => fetchMatchResult().catch(() => { }), 2000); return () => clearInterval(id); }, [submitted, results, phase, fetchMatchResult]);

  const handleLanguageChange = (lang: string) => { setLanguage(lang); if (match) loadStarterCode(lang, match.problem); };
  const handleTabSwitch = useCallback(() => {
    setTabWarnings((warnings) => {
      const next = warnings + 1;
      if (next >= 3) setTabWarningMessage('Tab switching limit reached — your match may be forfeited.');
      else setTabWarningMessage(`Tab switch detected — warning ${next}/3.`);
      return next;
    });
  }, []);
  useEffect(() => {
    if (!tabWarningMessage) return;
    const timeout = window.setTimeout(() => setTabWarningMessage(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [tabWarningMessage]);

  const handleRun = async () => {
    if (!match) return;
    setRunning(true); setRunDetails(null); setRunVerdict(undefined); setRunPassedCount(undefined); setRunTotalCount(undefined);
    setResultsPanelMode('run'); setResultsPanelOpen(true); setSubmittedWaiting(false);
    try {
      const result = await api.runCode(matchId, code, language) as { passedCount?: number; totalCount?: number; verdict?: string; testResults?: Array<{ passed: boolean; verdict?: string; input: string; expectedOutput: string; actualOutput: string; error?: string; executionTime?: number }>; };
      const passed = result.passedCount ?? 0; const total = result.totalCount ?? result.testResults?.length ?? 0;
      setRunVerdict(result.verdict); setRunPassedCount(passed); setRunTotalCount(total);
      setRunResult(`${verdictLabel(result.verdict)} — ${passed}/${total} sample${total !== 1 ? 's' : ''} passed`);
      if (result.testResults) setRunDetails(result.testResults.map(r => ({ passed: r.passed, verdict: r.verdict || (r.passed ? 'AC' : 'WA'), input: r.input || '', expected: r.expectedOutput || '', actual: r.actualOutput || '', error: r.error, executionTime: r.executionTime })));
    } catch (err) { setRunResult(err instanceof Error ? err.message : 'Run failed'); setRunVerdict('ENGINE_ERROR'); }
    finally { setRunning(false); }
  };

  const handleSubmit = async () => {
    if (!match || submitting || submitted) return;
    setSubmitting(true); setResultsPanelMode('submit'); setResultsPanelOpen(true); setSubmittedWaiting(false);
    setRunDetails(null); setRunVerdict(undefined); setRunPassedCount(undefined); setRunTotalCount(undefined);
    try {
      const result = await api.submitCode(matchId, code, language, prevCodeLen.current) as { matchFinished: boolean; submission?: { passedCount?: number; totalCount?: number; verdict?: string; isFullAC?: boolean; testResults?: Array<{ passed: boolean; verdict?: string; input: string; expectedOutput: string; actualOutput: string; error?: string; executionTime?: number }>; }; };
      prevCodeLen.current = getCodeLength(code); setSubmitted(true);
      const sub = result.submission;
      if (sub?.testResults) setRunDetails(sub.testResults.map(r => ({ passed: r.passed, verdict: r.verdict || (r.passed ? 'AC' : 'WA'), input: r.input || '', expected: r.expectedOutput || '', actual: r.actualOutput || '', error: r.error, executionTime: r.executionTime })));
      const passed = sub?.passedCount ?? 0; const total = sub?.totalCount ?? sub?.testResults?.length ?? 0;
      setRunVerdict(sub?.verdict); setRunPassedCount(passed); setRunTotalCount(total);
      setRunResult(total > 0 ? `Submitted — ${verdictLabel(sub?.verdict)} — ${passed}/${total} test cases passed` : 'Submitted');
      if (result.matchFinished) { setSubmittedWaiting(false); setRunResult('Match completed. Loading results…'); await fetchMatchResult(); }
      else { setSubmittedWaiting(true); }
    } catch (err) { setRunResult(err instanceof Error ? err.message : 'Submit failed'); setRunVerdict('ENGINE_ERROR'); }
    finally { setSubmitting(false); }
  };

  /* ── Loading / error states ── */
  if (loading || !user) {
    return (
      <div className="h-screen surface flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[color-mix(in_srgb,var(--primary)_30%,transparent)] border-t-[#3B82F6] rounded-full animate-spin" />
      </div>
    );
  }

  if (phase === 'finished' && results) {
    return <ResultsView results={results} onBack={() => router.push('/dashboard')} />;
  }

  if (phase === 'finished' && !results) {
    return (
      <div className="h-screen surface flex flex-col items-center justify-center gap-4">
        <div className="w-6 h-6 border-2 border-[color-mix(in_srgb,var(--primary)_30%,transparent)] border-t-[#3B82F6] rounded-full animate-spin" />
        <p className="text-sm text-secondary">Match completed. Loading results…</p>
        <button onClick={() => fetchMatchResult()} className="px-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated)] border border-[var(--border)] text-sm text-secondary rounded-xl transition-colors">Refresh</button>
        <Link href="/dashboard" className="text-xs text-muted hover:text-secondary">← Back to Dashboard</Link>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="h-screen surface flex flex-col items-center justify-center gap-4">
        {loadError ? (
          <>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 max-w-sm text-center">
              <AlertTriangle size={28} className="text-[var(--error)] mx-auto mb-3" />
              <p className="font-bold text-primary mb-2">Could not load duel</p>
              <p className="text-sm text-muted">{loadError}</p>
            </div>
            <button onClick={() => { setLoadError(''); window.location.reload(); }}
              className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-semibold rounded-xl transition-colors">Retry</button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-[color-mix(in_srgb,var(--primary)_30%,transparent)] border-t-[#3B82F6] rounded-full animate-spin" />
            <p className="text-sm text-secondary">Waiting for match data…</p>
          </div>
        )}
        <Link href="/dashboard" className="text-xs text-muted hover:text-secondary">← Back to Dashboard</Link>
      </div>
    );
  }

  const editorLocked = phase === 'reading';
  const watermark = `${user.username} · ${matchId.slice(-8)}`;
  const ioMode = computeIoMode(match.problem, language);
  const usesDriver = hasHiddenDriver(match.problem, language);
  const solutionSignature = ioMode === 'function' ? functionSignatureForLanguage(language, match.problem, usesDriver) : '';
  const rated = match.mode === 'competitive';

  return (
    <AntiCapture username={user.username} matchId={matchId}>
      <div className="terminal-shell flex h-screen flex-col overflow-hidden">
        <AnimatePresence>
          {phaseFlash && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="border border-[var(--accent)] bg-[var(--accent)] px-7 py-4 font-mono text-sm font-semibold uppercase tracking-[0.12em] text-[var(--accent-contrast)]">&gt; coding_phase / live_sync</motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {tabWarningMessage && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} role="status" className="fixed left-1/2 top-4 z-[110] -translate-x-1/2 border border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-2 font-mono text-[11px] text-[var(--warning)] shadow-lg">
              ! {tabWarningMessage}
            </motion.div>
          )}
        </AnimatePresence>

        <header className="flex min-h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--panel)] px-4 lg:px-5">
          <div className="flex min-w-0 items-center gap-3 font-mono text-[11px]"><Link href="/dashboard" className="flex h-7 w-7 shrink-0 items-center justify-center border border-[var(--accent)] text-[var(--accent)] no-underline">&gt;_</Link><span className="font-semibold text-[var(--text)]">DuecIt</span><span className="hidden text-[var(--text-faint)] sm:inline">/ arena / live</span><span className="hidden border-l border-[var(--border)] pl-3 text-[var(--accent)] md:inline">DSA-014</span><span className="truncate text-[var(--text)]">{match.problem.title}</span><span className="hidden border-l border-[var(--border)] pl-3 text-[var(--text-muted)] lg:inline">opponent <span className="text-[var(--text)]">{match.opponent.username}</span> <span className={ratingClass(match.opponent.rating)}>{match.opponent.rating}</span></span></div>
          <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em]">{tabWarnings > 0 && <span className="hidden items-center gap-1 border border-[var(--warning)] px-2 py-2 text-[var(--warning)] sm:flex"><AlertTriangle size={11} /> {tabWarnings}</span>}{opponentProgress && <span className="hidden border border-[var(--border)] px-2 py-2 text-[var(--text-muted)] md:inline">opponent / {opponentProgress}</span>}{submitted && <span className="hidden items-center gap-1 border border-[var(--accent)] px-2 py-2 text-[var(--accent)] sm:flex"><Check size={11} /> submitted</span>}<span className={`flex items-center gap-2 border px-2 py-2 ${phase === 'reading' ? 'border-[var(--warning)] text-[var(--warning)]' : 'border-[var(--accent)] text-[var(--accent)]'}`}><span>{phase === 'reading' ? 'read' : 'code'}</span>{phase === 'reading' ? <MatchTimer serverTime={match.serverTime} targetTime={match.codingStartsAt} label="Read" onExpire={() => setPhase('coding')} /> : <MatchTimer serverTime={match.serverTime} targetTime={match.codingEndsAt} label="Code" onExpire={() => { setRunResult('Time up. Waiting for result…'); fetchMatchResult().catch(() => { }); }} />}</span></div>
        </header>

        <div className={`flex min-h-8 shrink-0 items-center justify-between border-b px-4 font-mono text-[10px] uppercase tracking-[0.12em] ${editorLocked ? 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]' : 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'}`}><span>{editorLocked ? '▣ read phase / editor locked' : '⌁ coding phase / live sync'}</span><span className="hidden sm:inline">{editorLocked ? '00:45 elapsed' : 'transition complete · 08:32 remaining'}</span></div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[40%_60%] lg:overflow-hidden">
          <div className={`relative min-h-[420px] border-b border-[var(--border)] lg:min-h-0 lg:border-b-0 lg:border-r ${editorLocked ? 'ring-1 ring-inset ring-[var(--warning)]/20' : ''}`}>
            <ProblemPanel title={match.problem.title} statement={match.problem.statement} inputFormat={match.problem.inputFormat} outputFormat={match.problem.outputFormat} constraints={match.problem.constraints} samples={match.problem.samples} difficulty={match.problem.difficulty} watermark={watermark} ioMode={ioMode} signature={match.problem.signature} language={language} solutionSignature={solutionSignature} usesDriver={usesDriver} />
          </div>
          <div className="flex min-h-[560px] flex-col bg-[var(--editor-bg)] lg:min-h-0">
            <div className="min-h-[420px] min-w-0 flex-1 lg:min-h-0"><DuelEditor language={language} onLanguageChange={handleLanguageChange} value={code} onChange={setCode} readOnly={editorLocked} onTabSwitch={handleTabSwitch} ioMode={ioMode} rated={rated} signature={match.problem.signature} solutionSignature={solutionSignature} /></div>
            {resultsPanelOpen && <div className="flex h-[220px] shrink-0 flex-col overflow-hidden border-t border-[var(--border)]"><TestResultsPanel verdict={runVerdict} passedCount={runPassedCount} totalCount={runTotalCount} testResults={runDetails || undefined} isRunning={running} isSubmitting={submitting} mode={resultsPanelMode} submittedWaiting={submittedWaiting} /></div>}
            <div className="action-bar"><button onClick={handleRun} disabled={editorLocked || running || submitting} className="run-btn">&gt; run_samples</button><button onClick={handleSubmit} disabled={editorLocked || submitting || submitted} className={`submit-btn ${submitted ? 'submit-btn-done' : ''}`}>{submitting ? '⌛ submitting…' : submitted ? '✓ submitted' : '&gt; submit'}</button>{runResult && <span className="action-status" title={runResult}>{runResult}</span>}{resultsPanelMode !== 'idle' && <button onClick={() => setResultsPanelOpen((o) => !o)} className="ml-auto flex items-center gap-1 border-0 bg-transparent font-mono text-[10px] uppercase text-[var(--text-muted)] hover:text-[var(--accent)]">{resultsPanelOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}{resultsPanelOpen ? 'hide' : 'results'}</button>}</div>
          </div>
        </div>
        <footer className="flex min-h-7 shrink-0 items-center justify-between border-t border-[var(--border)] bg-[var(--panel)] px-4 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-faint)]"><span>match / {matchId.slice(-8)} · secure session · tab warnings {tabWarnings}/3</span><span className="hidden sm:inline">DuecIt // every match is a lesson</span></footer>
      </div>
    </AntiCapture>
  );
}

/* ─── Result Screen ──────────────────────────────────────────────────── */
function ResultsView({ results, onBack }: { results: Record<string, unknown>; onBack: () => void }) {
  const [showWinnerCode, setShowWinnerCode] = useState(false);
  const [showLoserCode, setShowLoserCode] = useState(false);
  const [confetti, setConfetti] = useState(true);

  const isDraw = results.draw as boolean;
  const winner = results.winner as Record<string, unknown> | undefined;
  const loser = results.loser as Record<string, unknown> | undefined;
  const winnerRatingChange = (winner?.ratingChange as number) ?? 0;
  const loserRatingChange = (loser?.ratingChange as number) ?? 0;
  const isRated = winnerRatingChange !== 0 || loserRatingChange !== 0;

  useEffect(() => { const t = setTimeout(() => setConfetti(false), 3500); return () => clearTimeout(t); }, []);

  return (
    <div className="min-h-screen surface">
      {/* Confetti dots */}
      {confetti && !isDraw && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden>
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div key={i}
              initial={{ y: -20, x: `${(i * 37) % 100}vw`, opacity: 1, scale: Math.random() * 0.6 + 0.4 }}
              animate={{ y: '110vh', opacity: 0 }}
              transition={{ duration: Math.random() * 2 + 1.5, delay: Math.random() * 0.8, ease: 'easeIn' }}
              className="absolute w-2 h-2 rounded-full"
              style={{ background: ['#3B82F6', '#8B5CF6', '#22C55E', '#F59E0B', '#EF4444'][i % 5] }}
            />
          ))}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 pt-12 pb-16">

        {/* Outcome hero */}
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5 }}
          className={`rounded-3xl p-10 text-center mb-6 border ${isDraw
              ? 'bg-[var(--bg-card)] border-[color-mix(in_srgb,var(--warning)_20%,transparent)] shadow-[0_0_60px_rgba(245,158,11,0.06)]'
              : 'bg-gradient-to-br from-[#111827] to-[#0D1117] border-[color-mix(in_srgb,var(--primary)_20%,transparent)] shadow-[0_0_60px_rgba(59,130,246,0.08)]'
            }`}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="text-5xl mb-4">{isDraw ? '🤝' : '🏆'}</motion.div>
          <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="text-3xl font-black text-primary mb-2">
            {isDraw ? <span className="text-[var(--warning)]">Draw!</span> : (
              <><span className="text-[var(--primary)]">{winner?.username as string}</span> <span>wins!</span></>
            )}
          </motion.h1>
          <p className="text-sm text-muted">
            {isDraw ? 'Both players performed equally.' : 'Match completed.'}
            {!isRated && ' · Unrated match'}
          </p>
        </motion.div>

        {/* Player comparison card */}
        {winner && loser && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden mb-5">
            {/* Header */}
            <div className="grid grid-cols-4 text-xs font-semibold text-muted uppercase tracking-widest px-5 py-3 bg-[var(--bg-input)] border-b border-[var(--border)]">
              <div>Player</div><div className="text-center">Score</div><div className="text-center">Time</div><div className="text-center">Rating</div>
            </div>
            {/* Winner row */}
            <div className={`grid grid-cols-4 items-center px-5 py-4 ${!isDraw ? 'bg-[#22C55E]/5 border-l-2 border-[#22C55E]' : ''}`}>
              <div>
                <div className="flex items-center gap-1.5">
                  {!isDraw && <Trophy size={13} className="text-[var(--warning)]" />}
                  <span className="font-bold text-sm text-primary">{winner.username as string}</span>
                </div>
                <p className="text-xs text-muted mt-0.5">{isDraw ? 'Player' : 'Winner'}</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-primary font-mono">{Math.round(winner.score as number)}</p>
                <p className="text-xs text-muted">pts</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-sm text-secondary">{Math.round((winner.solveTimeMs as number) / 1000)}s</p>
              </div>
              <div className="text-center">
                {isRated ? (
                  <>
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                      className={`font-bold font-mono text-base ${winnerRatingChange >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                      {winnerRatingChange >= 0 ? '+' : ''}{winnerRatingChange}
                    </motion.p>
                    <p className="text-xs text-muted">→ {winner.newRating as number}</p>
                  </>
                ) : <p className="text-sm text-muted font-mono">{winner.newRating as number}</p>}
              </div>
            </div>
            <div className="border-t border-[var(--border)]" />
            {/* Loser row */}
            <div className="grid grid-cols-4 items-center px-5 py-4">
              <div>
                <p className="font-bold text-sm text-secondary">{loser.username as string}</p>
                <p className="text-xs text-muted mt-0.5">{isDraw ? 'Player' : 'Runner-up'}</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-secondary font-mono">{Math.round(loser.score as number)}</p>
                <p className="text-xs text-muted">pts</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-sm text-secondary">{Math.round((loser.solveTimeMs as number) / 1000)}s</p>
              </div>
              <div className="text-center">
                {isRated ? (
                  <>
                    <p className={`font-bold font-mono text-base ${loserRatingChange >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                      {loserRatingChange >= 0 ? '+' : ''}{loserRatingChange}
                    </p>
                    <p className="text-xs text-muted">→ {loser.newRating as number}</p>
                  </>
                ) : <p className="text-sm text-muted font-mono">{loser.newRating as number}</p>}
              </div>
            </div>
          </motion.div>
        )}

        {/* Solutions */}
        {[
          { player: winner, show: showWinnerCode, setShow: setShowWinnerCode },
          { player: loser, show: showLoserCode, setShow: setShowLoserCode },
        ].filter(({ player }) => player && Boolean(player.code)).map(({ player, show, setShow }, idx) => (
          <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + idx * 0.1 }}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden mb-4">
            <button onClick={() => setShow((o) => !o)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-secondary hover:text-primary hover:bg-[color-mix(in_srgb,var(--text)_2%,transparent)] transition-colors">
              <span>{player!.username as string}&apos;s Solution <span className="text-muted font-normal">({player!.language as string})</span></span>
              {show ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {show && (
              <motion.pre initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-[var(--bg-input)] text-secondary p-5 overflow-x-auto text-xs font-mono border-t border-[var(--border)] leading-relaxed max-h-96">
                {player!.code as string}
              </motion.pre>
            )}
          </motion.div>
        ))}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={onBack}
            className="flex items-center gap-2 px-6 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold rounded-xl transition-all hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(59,130,246,0.35)] text-sm">
            <RotateCcw size={14} /> Play Again
          </button>
          <button onClick={() => { if (navigator.share) navigator.share({ title: 'DuecIt Match Result', url: window.location.href }); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated)] border border-[var(--border)] text-secondary font-semibold rounded-xl transition-all text-sm">
            <Share2 size={14} /> Share
          </button>
        </div>
      </div>
    </div>
  );
}
