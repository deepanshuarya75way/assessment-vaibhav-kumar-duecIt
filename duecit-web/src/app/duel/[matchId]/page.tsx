'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { wsClient } from '@/lib/ws';
import AppNav, { ratingClass } from '@/components/AppNav';
import ProblemPanel from '@/components/ProblemPanel';
import DuelEditor, { getCodeLength } from '@/components/DuelEditor';
import MatchTimer from '@/components/MatchTimer';
import AntiCapture from '@/components/AntiCapture';
import TestResultsPanel, { type TestCaseResult } from '@/components/TestResultsPanel';

// Languages the function-wrapper actually supports (see judge/wrapper.go).
// Keep in sync with backend WrapPracticeCode's switch cases - anything not
// in this list runs as a raw full program regardless of match mode.
const WRAPPER_SUPPORTED_LANGS = ['python', 'javascript', 'go', 'java', 'cpp', 'c'];

interface Problem {
  id: string;
  title: string;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  difficulty?: string;
  samples: { input: string; output: string }[];
  starterCode?: Record<string, string>;
  inputSpec?: InputVar[];
  signature?: { funcName: string; params: string[]; returnType: string };
  driverLanguages?: string[];
}

interface InputVar {
  name: string;
  type: string;
  lengthVar?: string;
  passToFunc?: boolean;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeProblem(value: unknown): Problem {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const signatureRaw = raw.signature && typeof raw.signature === 'object'
    ? raw.signature as Record<string, unknown>
    : null;
  const signature = signatureRaw
    ? {
        funcName: typeof signatureRaw.funcName === 'string' ? signatureRaw.funcName : '',
        params: toStringArray(signatureRaw.params),
        returnType: typeof signatureRaw.returnType === 'string' ? signatureRaw.returnType : '',
      }
    : undefined;

  const starterRaw = raw.starterCode && typeof raw.starterCode === 'object'
    ? raw.starterCode as Record<string, unknown>
    : {};
  const starterCode = Object.fromEntries(
    Object.entries(starterRaw).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );

  const inputSpec = Array.isArray(raw.inputSpec)
    ? raw.inputSpec.map((item) => {
        const v = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return {
          name: typeof v.name === 'string' ? v.name : '',
          type: typeof v.type === 'string' ? v.type : 'string',
          lengthVar: typeof v.lengthVar === 'string' ? v.lengthVar : undefined,
          passToFunc: typeof v.passToFunc === 'boolean' ? v.passToFunc : undefined,
        };
      }).filter((v) => v.name)
    : [];

  const samples = Array.isArray(raw.samples)
    ? raw.samples.map((sample) => {
        const s = sample && typeof sample === 'object' ? sample as Record<string, unknown> : {};
        return {
          input: typeof s.input === 'string' ? s.input : '',
          output: typeof s.output === 'string' ? s.output : '',
        };
      })
    : [];

  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    title: typeof raw.title === 'string' ? raw.title : 'Untitled problem',
    statement: typeof raw.statement === 'string' ? raw.statement : '',
    inputFormat: typeof raw.inputFormat === 'string' ? raw.inputFormat : '',
    outputFormat: typeof raw.outputFormat === 'string' ? raw.outputFormat : '',
    constraints: typeof raw.constraints === 'string' ? raw.constraints : '',
    difficulty: typeof raw.difficulty === 'string' ? raw.difficulty : undefined,
    samples,
    starterCode,
    inputSpec,
    signature,
    driverLanguages: toStringArray(raw.driverLanguages),
  };
}

function normalizeOpponent(value: unknown): Opponent {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    userId: typeof raw.userId === 'string' ? raw.userId : '',
    username: typeof raw.username === 'string' ? raw.username : 'opponent',
    rating: toNumber(raw.rating),
  };
}

// Single source of truth for "is this problem+language function-only or raw
// full-program". Used by both the banner/instructions render AND
// loadStarterCode below - previously these were two separate inline checks
// that quietly drifted apart (banner said "write only twoSum(nums, target)"
// while the editor preloaded the raw stdin template, since loadStarterCode
// was still keying off match.mode instead of this). Change the rule once,
// here, and both call sites stay in sync automatically.
function computeIoMode(problem: Problem | undefined, language: string): 'function' | 'raw' {
  if (!problem) return 'raw';
  const hasDriver = !!problem.driverLanguages?.includes(language);
  const hasAutoWrapper = WRAPPER_SUPPORTED_LANGS.includes(language) && !!problem.signature?.funcName;
  return hasDriver || hasAutoWrapper ? 'function' : 'raw';
}

function hasHiddenDriver(problem: Problem | undefined, language: string) {
  return !!problem?.driverLanguages?.includes(language);
}

function getParamType(problem: Problem, param: string) {
  return problem.inputSpec?.find((v) => v.name === param)?.type || 'string';
}

function getParamSpec(problem: Problem, param: string) {
  return problem.inputSpec?.find((v) => v.name === param);
}

function javaType(type: string) {
  const map: Record<string, string> = {
    int: 'int',
    float: 'double',
    bool: 'boolean',
    string: 'String',
    'int[]': 'int[]',
    'float[]': 'double[]',
    'string[]': 'String[]',
  };
  return map[type] || 'Object';
}

function cppType(type: string) {
  const map: Record<string, string> = {
    int: 'int',
    float: 'double',
    bool: 'bool',
    string: 'string',
    'int[]': 'vector<int>',
    'float[]': 'vector<double>',
    'string[]': 'vector<string>',
  };
  return map[type] || 'auto';
}

function goType(type: string) {
  const map: Record<string, string> = {
    int: 'int',
    float: 'float64',
    bool: 'bool',
    string: 'string',
    'int[]': '[]int',
    'float[]': '[]float64',
    'string[]': '[]string',
  };
  return map[type] || 'interface{}';
}

function cType(type: string) {
  if (type === 'float') return 'double';
  if (type === 'bool') return 'bool';
  if (type === 'string') return 'char*';
  if (type.endsWith('[]')) return type === 'float[]' ? 'double*' : type === 'string[]' ? 'char**' : 'int*';
  return 'int';
}

function defaultReturn(type: string, language: string) {
  if (type.endsWith('[]')) {
    if (language === 'java') return type === 'int[]' ? 'return new int[0];' : type === 'float[]' ? 'return new double[0];' : 'return new String[0];';
    if (language === 'cpp') return 'return {};';
    if (language === 'go') return 'return nil';
    if (language === 'c') return 'return NULL;';
    return 'return [];';
  }
  if (type === 'bool') return language === 'python' ? 'return False' : 'return false;';
  if (type === 'string') return language === 'python' ? "return ''" : 'return "";';
  if (type === 'float') return language === 'python' || language === 'go' ? 'return 0.0' : 'return 0.0;';
  return language === 'python' || language === 'go' ? 'return 0' : 'return 0;';
}

function functionSignatureForLanguage(language: string, problem: Problem, driverMode: boolean) {
  const sig = problem.signature;
  if (!sig?.funcName) return '';
  const params = sig.params || [];
  if (language === 'python') return `def ${sig.funcName}(${params.join(', ')}):`;
  if (language === 'javascript') return `function ${sig.funcName}(${params.join(', ')})`;
  if (language === 'go') {
    const typed = params.map((p) => `${p} ${goType(getParamType(problem, p))}`).join(', ');
    return `func ${sig.funcName}(${typed}) ${goType(sig.returnType)}`;
  }
  if (language === 'java') {
    const typed = params.map((p) => `${javaType(getParamType(problem, p))} ${p}`).join(', ');
    const method = `public static ${javaType(sig.returnType)} ${sig.funcName}(${typed})`;
    return driverMode ? `class Solution { ${method} }` : method;
  }
  if (language === 'cpp') {
    const typed = params.map((p) => {
      const type = cppType(getParamType(problem, p));
      return getParamType(problem, p).endsWith('[]') ? `const ${type}& ${p}` : `${type} ${p}`;
    }).join(', ');
    return `${cppType(sig.returnType)} ${sig.funcName}(${typed})`;
  }
  if (language === 'c') {
    const typed: string[] = [];
    params.forEach((p) => {
      const spec = getParamSpec(problem, p);
      const type = spec?.type || 'int';
      typed.push(`${cType(type)} ${p}`);
      if (type.endsWith('[]')) typed.push(`int ${p}Size`);
    });
    if (sig.returnType.endsWith('[]')) typed.push('int* returnSize');
    return `${cType(sig.returnType)} ${sig.funcName}(${typed.join(', ')})`;
  }
  return `${sig.funcName}(${params.join(', ')})`;
}

function buildFunctionStarter(language: string, problem?: Problem, driverMode = false) {
  if (!problem?.signature?.funcName) return '';
  const sigText = functionSignatureForLanguage(language, problem, driverMode);
  const ret = defaultReturn(problem.signature.returnType, language);
  if (language === 'python') return `${sigText}\n    # write your logic here\n    ${ret}\n`;
  if (language === 'javascript') return `${sigText} {\n  // write your logic here\n  ${ret}\n}\n`;
  if (language === 'java') {
    const method = functionSignatureForLanguage(language, problem, false);
    const body = `    ${method} {\n        // write your logic here\n        ${ret}\n    }`;
    return driverMode ? `class Solution {\n${body}\n}\n` : `${method} {\n    // write your logic here\n    ${ret}\n}\n`;
  }
  if (language === 'cpp' || language === 'c' || language === 'go') {
    const indent = language === 'go' ? '\t' : '    ';
    return `${sigText} {\n${indent}// write your logic here\n${indent}${ret}\n}\n`;
  }
  return '';
}

function starterLooksFunctionOnly(starter: string, problem: Problem | undefined, language: string) {
  if (!starter || !problem?.signature?.funcName || !starter.includes(problem.signature.funcName)) return false;
  const rawProgramMarkers = ['public class Main', 'static void main', 'int main(', 'func main(', 'readFileSync(0', 'Scanner sc'];
  if (rawProgramMarkers.some((marker) => starter.includes(marker))) return false;
  if (language === 'java' && hasHiddenDriver(problem, language) && !starter.includes('class Solution')) return false;
  return true;
}

interface Opponent {
  userId: string;
  username: string;
  rating: number;
}

interface MatchState {
  matchId: string;
  problem: Problem;
  opponent: Opponent;
  mode: string;
  language: string;
  serverTime: number;
  codingStartsAt: number;
  codingEndsAt: number;
  readPhaseSec: number;
}

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
  // Guard: only load starter code on first match init, never on sync polls
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

  const loadStarterCode = useCallback((lang: string, problem?: Problem) => {
    const ioMode = computeIoMode(problem, lang);
    const key = ioMode === 'function' ? `${lang}_practice` : lang;
    const driverMode = hasHiddenDriver(problem, lang);
    const generated = buildFunctionStarter(lang, problem, driverMode);
    const practiceStarter = problem?.starterCode?.[key] || '';
    const legacyStarter = problem?.starterCode?.[lang] || '';
    const starter = ioMode === 'function'
      ? (driverMode && generated
          ? generated
          : practiceStarter || (starterLooksFunctionOnly(legacyStarter, problem, lang) ? legacyStarter : generated) || '')
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

    // Only load starter code ONCE — never overwrite the user's typed code
    if (!matchInitialized.current) {
      matchInitialized.current = true;
      setLanguage(matchLanguage);
      loadStarterCode(matchLanguage, m.problem);
    }

    const now = Date.now();
    const status = data.status as string | undefined;
    const serverPhase = data.phase as string;
    if (status === 'finished' || serverPhase === 'finished') {
      setPhase('finished');
    } else if ((m.codingStartsAt > 0 && now >= m.codingStartsAt) || serverPhase === 'coding') {
      setPhase('coding');
    } else {
      setPhase('reading');
    }

    if (data.hasSubmitted) {
      setSubmitted(true);
      setRunResult('Submitted — waiting for opponent or timeout...');
    }
  }, [matchId, loadStarterCode]);

  const fetchMatchResult = useCallback(async () => {
    try {
      const result = await api.getMatchResult(matchId);
      setResults(result);
      setPhase('finished');
      setRunResult('Match completed.');
      sessionStorage.removeItem(`match:${matchId}`);
      return true;
    } catch {
      return false;
    }
  }, [matchId]);

  const syncMatchDetails = useCallback(async () => {
    try {
      const details = await api.getMatchDetails(matchId);
      if (!details) return;
      const d = details as Record<string, unknown>;

      // Only update timing + phase — do NOT call initMatch which would reset the editor code
      setMatch((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          serverTime: toNumber(d.serverTime) || prev.serverTime,
          codingStartsAt: toNumber(d.codingStartsAt) || prev.codingStartsAt,
          codingEndsAt: toNumber(d.codingEndsAt) || prev.codingEndsAt,
        };
      });

      const serverPhase = d.phase as string;
      const status = d.status as string | undefined;
      if (status === 'finished' || serverPhase === 'finished') {
        await fetchMatchResult();
      } else if (serverPhase === 'coding') {
        setPhase('coding');
      }

      sessionStorage.setItem(`match:${matchId}`, JSON.stringify(details));
    } catch { /* ignore */ }
  }, [matchId, fetchMatchResult]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('accessToken');
    if (token) wsClient.connect(token).catch(() => {});

    const loadMatch = async () => {
      let loadedFromStorage = false;
      const stored = sessionStorage.getItem(`match:${matchId}`);
      if (stored) {
        try {
          initMatch(JSON.parse(stored));
          loadedFromStorage = true;
        } catch { /* fall through */ }
      }
      try {
        const details = await api.getMatchDetails(matchId);
        if (details) {
          initMatch(details as Record<string, unknown>);
          sessionStorage.setItem(`match:${matchId}`, JSON.stringify(details));
          if ((details as Record<string, unknown>).phase === 'finished' ||
              (details as Record<string, unknown>).status === 'finished') {
            await fetchMatchResult();
          }
        } else if (!loadedFromStorage) {
          setLoadError('Match data was not available. The match may have expired or been removed.');
        }
      } catch (err) {
        if (!loadedFromStorage) {
          setLoadError(err instanceof Error ? err.message : 'Could not load match data.');
        }
      }
    };
    loadMatch();

    const unsubFound = wsClient.on('match:found', (data) => {
      if ((data.matchId as string) === matchId) {
        sessionStorage.setItem(`match:${matchId}`, JSON.stringify(data));
        initMatch(data);
      }
    });

    const unsubCoding = wsClient.on('match:coding_start', (data) => {
      if ((data.matchId as string) === matchId) {
        setPhase('coding');
        if (data.codingEndsAt) {
          setMatch((m) => m ? { ...m, codingEndsAt: data.codingEndsAt as number } : m);
        }
      }
    });

    const unsubProgress = wsClient.on('submission:progress', (data) => {
      if (data.userId !== user.id) {
        setOpponentProgress(`${data.passedCount}/${data.totalCount}${data.isFullAC ? ' ✓' : ''}`);
      }
    });

    const unsubFinished = wsClient.on('match:finished', (data) => {
      setPhase('finished');
      setResults(data);
      setRunResult('Match completed.');
      sessionStorage.removeItem(`match:${matchId}`);
    });

    return () => {
      unsubFound();
      unsubCoding();
      unsubProgress();
      unsubFinished();
    };
  }, [user, matchId, initMatch, fetchMatchResult]);

  useEffect(() => {
    if (!match || phase === 'finished') return;
    const id = setInterval(() => {
      syncMatchDetails().catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [match, phase, syncMatchDetails]);

  useEffect(() => {
    if (phase !== 'finished' && !results && match && match.codingEndsAt > 0 && Date.now() >= match.codingEndsAt) {
      const id = setTimeout(() => fetchMatchResult().catch(() => {}), 0);
      return () => clearTimeout(id);
    }
  }, [phase, results, match, fetchMatchResult]);

  useEffect(() => {
    if (!submitted || results || phase === 'finished') return;
    const id = setInterval(() => {
      fetchMatchResult().catch(() => {});
    }, 2000);
    return () => clearInterval(id);
  }, [submitted, results, phase, fetchMatchResult]);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    if (match) loadStarterCode(lang, match.problem);
  };

  const handleTabSwitch = useCallback(() => {
    setTabWarnings((w) => {
      const next = w + 1;
      if (next >= 3) alert('Warning: Excessive tab switching may result in forfeit.');
      return next;
    });
  }, []);

  const handleRun = async () => {
    if (!match) return;
    setRunning(true);
    setRunDetails(null);
    setRunVerdict(undefined);
    setRunPassedCount(undefined);
    setRunTotalCount(undefined);
    setResultsPanelMode('run');
    setResultsPanelOpen(true);
    setSubmittedWaiting(false);
    try {
      const result = await api.runCode(matchId, code, language) as {
        passedCount?: number; totalCount?: number; verdict?: string;
        testResults?: Array<{ passed: boolean; verdict?: string; input: string; expectedOutput: string; actualOutput: string; error?: string; executionTime?: number }>;
      };
      const passed = result.passedCount ?? 0;
      const total = result.totalCount ?? result.testResults?.length ?? 0;
      setRunVerdict(result.verdict);
      setRunPassedCount(passed);
      setRunTotalCount(total);
      setRunResult(`${verdictLabel(result.verdict)} - ${passed}/${total} sample${total !== 1 ? 's' : ''} passed`);
      if (result.testResults) {
        setRunDetails(result.testResults.map(r => ({
          passed: r.passed,
          verdict: r.verdict || (r.passed ? 'AC' : 'WA'),
          input: r.input || '',
          expected: r.expectedOutput || '',
          actual: r.actualOutput || '',
          error: r.error,
          executionTime: r.executionTime,
        })));
      }
    } catch (err) {
      setRunResult(err instanceof Error ? err.message : 'Run failed');
      setRunVerdict('ENGINE_ERROR');
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!match || submitting || submitted) return;
    setSubmitting(true);
    setResultsPanelMode('submit');
    setResultsPanelOpen(true);
    setSubmittedWaiting(false);
    setRunDetails(null);
    setRunVerdict(undefined);
    setRunPassedCount(undefined);
    setRunTotalCount(undefined);
    try {
      const result = await api.submitCode(matchId, code, language, prevCodeLen.current) as {
        matchFinished: boolean;
        submission?: {
          passedCount?: number;
          totalCount?: number;
          verdict?: string;
          isFullAC?: boolean;
          testResults?: Array<{ passed: boolean; verdict?: string; input: string; expectedOutput: string; actualOutput: string; error?: string; executionTime?: number }>;
        };
      };
      prevCodeLen.current = getCodeLength(code);
      setSubmitted(true);

      const sub = result.submission;
      if (sub?.testResults) {
        setRunDetails(sub.testResults.map(r => ({
          passed: r.passed,
          verdict: r.verdict || (r.passed ? 'AC' : 'WA'),
          input: r.input || '',
          expected: r.expectedOutput || '',
          actual: r.actualOutput || '',
          error: r.error,
          executionTime: r.executionTime,
        })));
      }
      const passed = sub?.passedCount ?? 0;
      const total = sub?.totalCount ?? sub?.testResults?.length ?? 0;
      setRunVerdict(sub?.verdict);
      setRunPassedCount(passed);
      setRunTotalCount(total);
      setRunResult(
        total > 0
          ? `Submitted - ${verdictLabel(sub?.verdict)} - ${passed}/${total} test cases passed`
          : 'Submitted'
      );

      if (result.matchFinished) {
        setRunResult('Match completed. Loading results...');
        setSubmittedWaiting(false);
        await fetchMatchResult();
      } else {
        setSubmittedWaiting(true);
      }
    } catch (err) {
      setRunResult(err instanceof Error ? err.message : 'Submit failed');
      setRunVerdict('ENGINE_ERROR');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) return <div className="p-8 text-center">Loading...</div>;

  if (phase === 'finished' && results) {
    return (
      <>
        <AppNav />
        <ResultsView results={results} onBack={() => router.push('/dashboard')} />
      </>
    );
  }

  if (phase === 'finished' && !results) {
    return (
      <div className="min-h-screen">
        <AppNav />
        <div className="flex flex-col items-center justify-center gap-4 p-12">
          <div className="text-[var(--cf-blue)] font-bold">Match completed. Loading results...</div>
          <button onClick={() => fetchMatchResult()} className="cf-btn px-4 py-2">
            Refresh Result
          </button>
          <Link href="/dashboard" className="text-[var(--cf-blue)] underline text-sm">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen">
        <AppNav />
        <div className="flex flex-col items-center justify-center gap-4 p-12">
          {loadError ? (
            <>
              <div className="cf-panel p-4 max-w-md text-center">
                <div className="font-bold text-red-600 mb-2">Could not load duel</div>
                <p className="text-sm text-[var(--cf-muted)]">{loadError}</p>
              </div>
              <button
                onClick={() => {
                  setLoadError('');
                  window.location.reload();
                }}
                className="cf-btn px-4 py-2"
              >
                Retry
              </button>
            </>
          ) : (
            <div className="text-[var(--cf-blue)] font-bold animate-pulse">Waiting for match data...</div>
          )}
          <Link href="/dashboard" className="text-[var(--cf-blue)] underline text-sm">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const editorLocked = phase === 'reading';
  const watermark = `${user.username} · ${matchId.slice(-8)}`;

  // Whether the judge wraps this code (function-only) or runs it raw (full
  // program) - see computeIoMode above for the single source of truth.
  // NOT tied to competitive vs practice: a competitive match on a problem
  // with a driver/signature is just as function-only as a practice match.
  const ioMode = computeIoMode(match.problem, language);
  const usesDriver = hasHiddenDriver(match.problem, language);
  const solutionSignature = ioMode === 'function'
    ? functionSignatureForLanguage(language, match.problem, usesDriver)
    : '';
  // Whether this match affects ELO - this is the actual practice/competitive
  // distinction now (see finalizeMatch on the backend).
  const rated = match.mode === 'competitive';

  return (
    <AntiCapture username={user.username} matchId={matchId}>
      <div className="h-screen flex flex-col">
        <div className="cf-nav px-4 py-1.5 flex items-center justify-between text-sm shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-bold">DuecIt</span>
            <span className="opacity-70">|</span>
            <span>{match.problem.title}</span>
            <span className="opacity-70">vs</span>
            <Link href={`/profile/${match.opponent.username}`} className="font-bold no-underline hover:underline">
              {match.opponent.username}
            </Link>
            <span className={ratingClass(match.opponent.rating)}>({match.opponent.rating})</span>
            <span className="bg-white/20 px-1.5 py-0.5 text-xs capitalize">{match.mode}</span>
          </div>
          <div className="flex items-center gap-3">
            {phase === 'reading' ? (
              <MatchTimer
                serverTime={match.serverTime}
                targetTime={match.codingStartsAt}
                label="Read"
                onExpire={() => setPhase('coding')}
              />
            ) : (
              <MatchTimer
                serverTime={match.serverTime}
                targetTime={match.codingEndsAt}
                label="Code"
                onExpire={() => {
                  setRunResult('Code time ended. Waiting for result...');
                  fetchMatchResult().catch(() => {});
                }}
              />
            )}
            {tabWarnings > 0 && (
              <span className="text-yellow-300 text-xs">Tab: {tabWarnings}</span>
            )}
            {opponentProgress && (
              <span className="text-xs opacity-80">Opponent: {opponentProgress}</span>
            )}
            {submitted && (
              <span className="text-xs bg-green-700 px-2 py-0.5">Submitted</span>
            )}
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 min-h-0">
          <div className="min-h-0 border-r border-[var(--cf-border)]">
            <ProblemPanel
              title={match.problem.title}
              statement={match.problem.statement}
              inputFormat={match.problem.inputFormat}
              outputFormat={match.problem.outputFormat}
              constraints={match.problem.constraints}
              samples={match.problem.samples}
              difficulty={match.problem.difficulty}
              watermark={watermark}
              ioMode={ioMode}
              signature={match.problem.signature}
              language={language}
              solutionSignature={solutionSignature}
              usesDriver={usesDriver}
            />
          </div>
          <div className="flex flex-col min-h-0 bg-[var(--editor-bg)]">
            {/* Editor fills remaining space, results panel below */}
            <div
              className="min-h-0 flex-1"
              style={{ height: resultsPanelOpen ? 'calc(100% - 220px)' : 'calc(100% - 44px)' }}
            >
              <DuelEditor
                language={language}
                onLanguageChange={handleLanguageChange}
                value={code}
                onChange={setCode}
                readOnly={editorLocked}
                onTabSwitch={handleTabSwitch}
                ioMode={ioMode}
                rated={rated}
                signature={match.problem.signature}
                solutionSignature={solutionSignature}
              />
            </div>

            {/* Results panel (expandable) */}
            {resultsPanelOpen && (
              <div style={{ height: '220px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <TestResultsPanel
                  verdict={runVerdict}
                  passedCount={runPassedCount}
                  totalCount={runTotalCount}
                  testResults={runDetails || undefined}
                  isRunning={running}
                  isSubmitting={submitting}
                  mode={resultsPanelMode}
                  submittedWaiting={submittedWaiting}
                />
              </div>
            )}

            {/* Action bar */}
            <div className="action-bar">
              <button
                onClick={handleRun}
                disabled={editorLocked || running || submitting}
                className="run-btn"
                id="run-samples-btn"
              >
                ▶ Run Samples
              </button>
              <button
                onClick={handleSubmit}
                disabled={editorLocked || submitting || submitted}
                className={`submit-btn ${submitted ? 'submit-btn-done' : ''}`}
                id="submit-code-btn"
              >
                {submitting ? '⏳ Submitting…' : submitted ? '✓ Submitted' : '⚡ Submit'}
              </button>
              {runResult && (
                <span className="action-status" title={runResult}>{runResult}</span>
              )}
              {/* Toggle results panel */}
              {(resultsPanelMode !== 'idle') && (
                <button
                  onClick={() => setResultsPanelOpen(o => !o)}
                  style={{ marginLeft: 'auto', fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {resultsPanelOpen ? '▼ Hide' : '▲ Results'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AntiCapture>
  );
}

function verdictLabel(verdict?: string) {
  switch (verdict) {
    case 'AC':
      return 'Accepted';
    case 'WA':
      return 'Wrong Answer';
    case 'CE':
      return 'Compilation Error';
    case 'RE':
      return 'Runtime Error';
    case 'TLE':
      return 'Time Limit Exceeded';
    case 'UNSUPPORTED_LANGUAGE':
      return 'Unsupported Language';
    case 'ENGINE_ERROR':
      return 'Judge Error';
    default:
      return 'Result';
  }
}

function ResultsView({
  results,
  onBack,
}: {
  results: Record<string, unknown>;
  onBack: () => void;
}) {
  const [showWinnerCode, setShowWinnerCode] = useState(false);
  const [showLoserCode, setShowLoserCode] = useState(false);

  const isDraw = results.draw as boolean;
  const winner = results.winner as Record<string, unknown> | undefined;
  const loser = results.loser as Record<string, unknown> | undefined;

  const winnerRatingChange = (winner?.ratingChange as number) ?? 0;
  const loserRatingChange = (loser?.ratingChange as number) ?? 0;
  const isRated = winnerRatingChange !== 0 || loserRatingChange !== 0;

  return (
    <div className="min-h-screen bg-[var(--cf-bg)]">
      <div className="max-w-3xl mx-auto p-4 pt-6">

        {/* Outcome card */}
        <div className={`rounded-lg p-6 mb-5 text-center shadow-sm ${
          isDraw
            ? 'bg-amber-50 border border-amber-200'
            : 'bg-gradient-to-br from-[#336699]/5 to-[#336699]/10 border border-[#336699]/20'
        }`}>
          <div className="text-4xl mb-2">{isDraw ? '🤝' : '🏆'}</div>
          <h1 className="text-2xl font-bold mb-1">
            {isDraw ? (
              <span className="text-amber-600">Draw!</span>
            ) : (
              <>
                <span className="text-[var(--cf-blue)]">{winner?.username as string}</span>{' '}
                <span className="text-gray-700">wins!</span>
              </>
            )}
          </h1>
          <p className="text-sm text-gray-500">
            {isDraw ? 'Both players performed equally.' : 'Match completed.'}
            {isRated ? '' : ' (Unrated match)'}
          </p>
        </div>

        {/* Player comparison */}
        {winner && loser && (
          <div className="cf-panel mb-5 overflow-hidden rounded-lg shadow-sm">
            <div className="grid grid-cols-3 text-center text-xs font-bold uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200 py-2">
              <div>Player</div>
              <div>Score / Time</div>
              <div>Rating</div>
            </div>
            <div className={`grid grid-cols-3 items-center py-4 px-4 ${!isDraw ? 'bg-green-50 border-l-4 border-green-500' : ''}`}>
              <div>
                <div className="font-bold text-sm">{!isDraw && <span className="text-green-500 mr-1">👑</span>}{winner.username as string}</div>
                <div className="text-xs text-gray-500">{isDraw ? 'Player' : 'Winner'}</div>
              </div>
              <div className="text-center">
                <div className="font-bold">{Math.round(winner.score as number)}<span className="text-xs text-gray-400 font-normal"> pts</span></div>
                <div className="text-xs text-gray-500">{Math.round((winner.solveTimeMs as number) / 1000)}s</div>
              </div>
              <div className="text-center">
                {isRated ? (
                  <>
                    <div className="font-bold text-green-600">{winnerRatingChange >= 0 ? '+' : ''}{winnerRatingChange}</div>
                    <div className="text-xs text-gray-500">→ {winner.newRating as number}</div>
                  </>
                ) : (
                  <div className="text-xs text-gray-400">{winner.newRating as number}</div>
                )}
              </div>
            </div>
            <div className="border-t border-gray-200" />
            <div className="grid grid-cols-3 items-center py-4 px-4 bg-white">
              <div>
                <div className="font-bold text-sm">{loser.username as string}</div>
                <div className="text-xs text-gray-500">{isDraw ? 'Player' : 'Runner-up'}</div>
              </div>
              <div className="text-center">
                <div className="font-bold">{Math.round(loser.score as number)}<span className="text-xs text-gray-400 font-normal"> pts</span></div>
                <div className="text-xs text-gray-500">{Math.round((loser.solveTimeMs as number) / 1000)}s</div>
              </div>
              <div className="text-center">
                {isRated ? (
                  <>
                    <div className="font-bold text-red-600">{loserRatingChange >= 0 ? '+' : ''}{loserRatingChange}</div>
                    <div className="text-xs text-gray-500">→ {loser.newRating as number}</div>
                  </>
                ) : (
                  <div className="text-xs text-gray-400">{loser.newRating as number}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Solutions */}
        {winner && Boolean(winner.code) && (
          <div className="cf-panel mb-4 rounded-lg shadow-sm overflow-hidden">
            <button onClick={() => setShowWinnerCode(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold hover:bg-gray-50 transition-colors">
              <span>{winner.username as string}&apos;s Solution ({winner.language as string})</span>
              <span className="text-gray-400">{showWinnerCode ? '▼' : '▶'}</span>
            </button>
            {showWinnerCode && (
              <pre className="bg-[#1e1e1e] text-[#d4d4d4] p-4 overflow-x-auto text-xs font-mono border-t border-gray-200 leading-relaxed">
                {winner.code as string}
              </pre>
            )}
          </div>
        )}

        {loser && Boolean(loser.code) && (
          <div className="cf-panel mb-4 rounded-lg shadow-sm overflow-hidden">
            <button onClick={() => setShowLoserCode(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold hover:bg-gray-50 transition-colors">
              <span>{loser.username as string}&apos;s Solution ({loser.language as string})</span>
              <span className="text-gray-400">{showLoserCode ? '▼' : '▶'}</span>
            </button>
            {showLoserCode && (
              <pre className="bg-[#1e1e1e] text-[#d4d4d4] p-4 overflow-x-auto text-xs font-mono border-t border-gray-200 leading-relaxed">
                {loser.code as string}
              </pre>
            )}
          </div>
        )}

        <div className="flex justify-center mt-6">
          <button onClick={onBack} className="cf-btn px-8 py-2 rounded">Back to Dashboard</button>
        </div>
      </div>
    </div>
  );
}

