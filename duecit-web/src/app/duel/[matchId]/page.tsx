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
  const [phase, setPhase] = useState<'reading' | 'coding' | 'finished'>('reading');
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const prevCodeLen = useRef(0);
  const [runResult, setRunResult] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [tabWarnings, setTabWarnings] = useState(0);
  const [opponentProgress, setOpponentProgress] = useState('');
  const [results, setResults] = useState<Record<string, unknown> | null>(null);

  const loadStarterCode = useCallback((lang: string, problem?: Problem) => {
    const starter = problem?.starterCode?.[lang] || '';
    setCode(starter);
    prevCodeLen.current = starter.length;
  }, []);

  const initMatch = useCallback((data: Record<string, unknown>) => {
    const m: MatchState = {
      matchId: data.matchId as string,
      problem: data.problem as Problem,
      opponent: data.opponent as Opponent,
      mode: data.mode as string,
      serverTime: data.serverTime as number,
      codingStartsAt: data.codingStartsAt as number,
      codingEndsAt: data.codingEndsAt as number,
      readPhaseSec: data.readPhaseSec as number,
    };
    setMatch(m);
    loadStarterCode(language, m.problem);

    const now = Date.now();
    const status = data.status as string | undefined;
    const serverPhase = data.phase as string;
    if (status === 'finished' || serverPhase === 'finished') {
      setPhase('finished');
    } else if (now >= m.codingStartsAt || serverPhase === 'coding') {
      setPhase('coding');
    } else {
      setPhase('reading');
    }

    if (data.hasSubmitted) {
      setSubmitted(true);
      setRunResult('Submitted — waiting for opponent or timeout...');
    }
  }, [language, loadStarterCode]);

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
      initMatch(details as Record<string, unknown>);
      sessionStorage.setItem(`match:${matchId}`, JSON.stringify(details));
      const d = details as Record<string, unknown>;
      if (d.status === 'finished' || d.phase === 'finished') {
        await fetchMatchResult();
      }
    } catch { /* ignore */ }
  }, [matchId, initMatch, fetchMatchResult]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('accessToken');
    if (token) wsClient.connect(token).catch(() => {});

    const loadMatch = async () => {
      const stored = sessionStorage.getItem(`match:${matchId}`);
      if (stored) {
        try {
          initMatch(JSON.parse(stored));
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
        }
      } catch { /* waiting for ws */ }
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
    if (phase !== 'finished' && !results && match && Date.now() >= match.codingEndsAt) {
      fetchMatchResult().catch(() => {});
    }
  }, [phase, results, match, fetchMatchResult]);

  useEffect(() => {
    if (!submitted || results || phase === 'finished') return;
    const id = setInterval(() => {
      fetchMatchResult().catch(() => {});
    }, 2000);
    return () => clearInterval(id);
  }, [submitted, results, fetchMatchResult]);

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
    setRunResult('Running...');
    try {
      const result = await api.runCode(matchId, code, language) as {
        passedCount?: number; totalCount?: number;
        PassedCount?: number; TotalCount?: number;
      };
      const passed = result.passedCount ?? result.PassedCount ?? 0;
      const total = result.totalCount ?? result.TotalCount ?? 0;
      setRunResult(`${passed}/${total} samples passed`);
    } catch (err) {
      setRunResult(err instanceof Error ? err.message : 'Run failed');
    }
  };

  const handleSubmit = async () => {
    if (!match || submitting || submitted) return;
    setSubmitting(true);
    try {
      const result = await api.submitCode(matchId, code, language, prevCodeLen.current) as {
        matchFinished: boolean;
      };
      prevCodeLen.current = getCodeLength(code);
      setSubmitted(true);
      setRunResult('Submitted — waiting for opponent or timeout...');
      if (result.matchFinished) {
        setRunResult('Match completed. Loading results...');
        await fetchMatchResult();
      }
    } catch (err) {
      setRunResult(err instanceof Error ? err.message : 'Submit failed');
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
          <div className="text-[var(--cf-blue)] font-bold animate-pulse">Waiting for match data...</div>
          <Link href="/dashboard" className="text-[var(--cf-blue)] underline text-sm">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const editorLocked = phase === 'reading';
  const watermark = `${user.username} · ${matchId.slice(-8)}`;

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
            />
          </div>
          <div className="flex flex-col min-h-0 bg-[var(--editor-bg)]">
            <div className="flex-1 min-h-0 p-1">
              <DuelEditor
                language={language}
                onLanguageChange={handleLanguageChange}
                value={code}
                onChange={setCode}
                readOnly={editorLocked}
                onTabSwitch={handleTabSwitch}
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] border-t border-zinc-700">
              <button
                onClick={handleRun}
                disabled={editorLocked}
                className="cf-btn-secondary text-xs px-3 py-1 disabled:opacity-40"
              >
                Run Samples
              </button>
              <button
                onClick={handleSubmit}
                disabled={editorLocked || submitting || submitted}
                className="cf-btn text-xs px-4 py-1 disabled:opacity-40"
              >
                {submitting ? 'Submitting...' : submitted ? 'Submitted' : 'Submit'}
              </button>
              {runResult && <span className="text-zinc-400 text-xs ml-2">{runResult}</span>}
            </div>
          </div>
        </div>
      </div>
    </AntiCapture>
  );
}

function ResultsView({
  results,
  onBack,
}: {
  results: Record<string, unknown>;
  onBack: () => void;
}) {
  const isDraw = results.draw as boolean;
  const winner = results.winner as Record<string, unknown> | undefined;
  const loser = results.loser as Record<string, unknown> | undefined;

  return (
    <main className="max-w-4xl mx-auto p-4">
      <div className="cf-panel p-6 mb-4 text-center">
        <h1 className="text-2xl font-bold mb-2">
          {isDraw ? (
            <span className="text-[var(--cf-orange)]">Draw</span>
          ) : (
            <>
              <span className="text-[var(--cf-green)]">{winner?.username as string}</span> wins!
            </>
          )}
        </h1>
      </div>

      {!isDraw && winner && loser && (
        <table className="cf-table mb-4">
          <thead>
            <tr>
              <th>Player</th>
              <th>Score</th>
              <th>Time</th>
              <th>Rating Δ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-bold text-[var(--cf-green)]">{winner.username as string}</td>
              <td>{Math.round(winner.score as number)}</td>
              <td>{Math.round((winner.solveTimeMs as number) / 1000)}s</td>
              <td className="text-[var(--cf-green)]">
                +{winner.ratingChange as number} → {winner.newRating as number}
              </td>
            </tr>
            <tr>
              <td>{loser.username as string}</td>
              <td>{Math.round(loser.score as number)}</td>
              <td>{Math.round((loser.solveTimeMs as number) / 1000)}s</td>
              <td className="text-red-600">
                {loser.ratingChange as number} → {loser.newRating as number}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {winner && Boolean(winner.code) && (
        <div className="cf-panel p-4 mb-4">
          <h2 className="font-bold mb-2">
            Winner&apos;s solution ({winner.language as string})
          </h2>
          <pre className="bg-[#f8f8f8] border border-[#ddd] p-3 overflow-x-auto text-xs font-mono">
            {winner.code as string}
          </pre>
        </div>
      )}

      {loser && Boolean(loser.code) && (
        <div className="cf-panel p-4 mb-4">
          <h2 className="font-bold mb-2">{loser.username as string}&apos;s solution</h2>
          <pre className="bg-[#f8f8f8] border border-[#ddd] p-3 overflow-x-auto text-xs font-mono">
            {loser.code as string}
          </pre>
        </div>
      )}

      <div className="text-center">
        <button onClick={onBack} className="cf-btn px-6 py-2">Back to Dashboard</button>
      </div>
    </main>
  );
}
