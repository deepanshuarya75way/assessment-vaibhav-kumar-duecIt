'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, AdminStats, ActiveMatch, InputVar, ParamType, PARAM_TYPES } from '@/lib/api';
import AppNav from '@/components/AppNav';

interface Problem {
  id?: string;
  problemId: string;
  title: string;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  samples: { input: string; output: string }[];
  category: string;
  difficulty: string;
  tags: string[];
  inputSpec?: InputVar[];
  signature?: { funcName: string; returnType: ParamType };
}

interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  sizeBucket: string;
  weight: number;
  isHidden: boolean;
}

type Tab = 'monitor' | 'problems';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('monitor');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activeMatches, setActiveMatches] = useState<ActiveMatch[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selected, setSelected] = useState<Problem | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showTCForm, setShowTCForm] = useState(false);
  const [form, setForm] = useState<Partial<Problem>>({
    category: 'dsa',
    difficulty: 'easy',
    tags: [],
    samples: [{ input: '', output: '' }],
    inputSpec: [],
    signature: { funcName: '', returnType: 'string' },
  });
  const [tcForm, setTCForm] = useState({
    input: '',
    expectedOutput: '',
    sizeBucket: 'small',
    weight: 10,
    isHidden: true,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadMonitor();
      loadProblems();
      const id = setInterval(loadMonitor, 10000);
      return () => clearInterval(id);
    }
  }, [user]);

  const loadMonitor = async () => {
    try {
      const [s, m] = await Promise.all([api.adminStats(), api.adminActiveMatches()]);
      setStats(s);
      setActiveMatches(m || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    }
  };

  const loadProblems = async () => {
    try {
      const list = await api.listProblems() as Problem[];
      setProblems(list || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load problems');
    }
  };

  const loadTestCases = async (problemId: string) => {
    try {
      const list = await api.getTestCases(problemId) as TestCase[];
      setTestCases(list || []);
    } catch {
      setTestCases([]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const inputSpec = form.inputSpec || [];
      const hasSignature = !!form.signature?.funcName;
      const payload = {
        ...form,
        problemId: form.problemId || undefined,
        inputSpec: inputSpec.length ? inputSpec : undefined,
        signature: hasSignature
          ? {
              funcName: form.signature!.funcName,
              returnType: form.signature!.returnType,
              params: inputSpec.filter((v) => v.passToFunc).map((v) => v.name),
            }
          : undefined,
      };
      await api.createProblem(payload);
      setShowForm(false);
      setForm({
        category: 'dsa',
        difficulty: 'easy',
        tags: [],
        samples: [{ input: '', output: '' }],
        inputSpec: [],
        signature: { funcName: '', returnType: 'string' },
      });
      loadProblems();
      loadMonitor();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this problem?')) return;
    await api.deleteProblem(id);
    if (selected?.problemId === id) setSelected(null);
    loadProblems();
    loadMonitor();
  };

  const handleAddTC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await api.addTestCase(selected.problemId, tcForm);
      setShowTCForm(false);
      setTCForm({ input: '', expectedOutput: '', sizeBucket: 'small', weight: 10, isHidden: true });
      loadTestCases(selected.problemId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add test case');
    }
  };

  const handleDeleteTC = async (tcId: string) => {
    if (!selected) return;
    await api.deleteTestCase(selected.problemId, tcId);
    loadTestCases(selected.problemId);
  };

  if (loading || !user) return <div className="p-6">Loading...</div>;

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="p-4 max-w-6xl mx-auto">
        <h1 className="text-xl font-bold mb-2 text-[var(--cf-blue)]">Admin Portal</h1>
        <p className="text-xs text-[var(--cf-muted)] mb-4">
          Monitoring and problem management only — admins cannot enter matchmaking.
        </p>

        {error && <p className="text-red-600 text-sm mb-3 border border-red-200 bg-red-50 p-2">{error}</p>}

        <div className="flex gap-2 mb-4 border-b border-[var(--cf-border)]">
          <button
            onClick={() => setTab('monitor')}
            className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px ${
              tab === 'monitor' ? 'border-[var(--cf-blue)] text-[var(--cf-blue)]' : 'border-transparent text-[var(--cf-muted)]'
            }`}
          >
            Monitoring
          </button>
          <button
            onClick={() => setTab('problems')}
            className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px ${
              tab === 'problems' ? 'border-[var(--cf-blue)] text-[var(--cf-blue)]' : 'border-transparent text-[var(--cf-muted)]'
            }`}
          >
            Problems & Test Cases
          </button>
        </div>

        {tab === 'monitor' && stats && (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { label: 'Total Users', value: stats.totalUsers },
                { label: 'Active Matches', value: stats.activeMatches },
                { label: 'Problems', value: stats.totalProblems },
              ].map((s) => (
                <div key={s.label} className="cf-panel p-4 text-center">
                  <div className="text-2xl font-bold text-[var(--cf-blue)]">{s.value}</div>
                  <div className="text-xs text-[var(--cf-muted)]">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="cf-panel p-4">
              <h2 className="font-bold mb-3">Active Matches</h2>
              {activeMatches.length === 0 ? (
                <p className="text-sm text-[var(--cf-muted)]">No active matches.</p>
              ) : (
                <table className="cf-table">
                  <thead>
                    <tr>
                      <th>Match ID</th>
                      <th>Problem</th>
                      <th>Category</th>
                      <th>Difficulty</th>
                      <th>Mode</th>
                      <th>Phase</th>
                      <th>Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeMatches.map((m) => (
                      <tr key={m.matchId}>
                        <td className="font-mono text-xs">{m.matchId.slice(-8)}</td>
                        <td>{m.problemId}</td>
                        <td className="uppercase">{m.category}</td>
                        <td className={`diff-${m.difficulty}`}>{m.difficulty}</td>
                        <td className="capitalize">{m.mode}</td>
                        <td className="capitalize">{m.phase}</td>
                        <td className="text-xs">{new Date(m.startTime).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === 'problems' && (
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1 cf-panel p-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-sm">Problems</h2>
                <button onClick={() => setShowForm(true)} className="cf-btn text-xs px-2 py-1">+ New</button>
              </div>
              <div className="space-y-1 max-h-[70vh] overflow-y-auto">
                {problems.map((p) => (
                  <div
                    key={p.problemId}
                    className={`p-2 border cursor-pointer text-sm ${
                      selected?.problemId === p.problemId
                        ? 'border-[var(--cf-blue)] bg-[var(--cf-blue-light)]'
                        : 'border-[var(--cf-border)] hover:bg-[#f8f8f8]'
                    }`}
                    onClick={() => {
                      setSelected(p);
                      loadTestCases(p.problemId);
                    }}
                  >
                    <div className="font-bold">{p.title}</div>
                    <div className="text-xs text-[var(--cf-muted)]">
                      {p.problemId} · {p.category} · {p.difficulty}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-2 cf-panel p-4">
              {selected ? (
                <>
                  <div className="flex justify-between mb-3">
                    <div>
                      <h2 className="text-lg font-bold">{selected.title}</h2>
                      <p className="text-xs text-[var(--cf-muted)]">{selected.problemId}</p>
                    </div>
                    <button onClick={() => handleDelete(selected.problemId)} className="text-red-600 text-xs underline">
                      Delete
                    </button>
                  </div>
                  <p className="text-sm mb-4 whitespace-pre-wrap">{selected.statement}</p>
                  <div className="flex justify-between mb-2">
                    <h3 className="font-bold text-sm">Test Cases ({testCases.length})</h3>
                    <button onClick={() => setShowTCForm(true)} className="cf-btn-secondary text-xs px-2 py-1">
                      + Add
                    </button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {testCases.map((tc) => (
                      <div key={tc.id} className="border border-[var(--cf-border)] p-2 font-mono text-xs">
                        <div className="flex justify-between mb-1">
                          <span className="text-[var(--cf-muted)]">
                            {tc.sizeBucket} · w={tc.weight} · {tc.isHidden ? 'hidden' : 'visible'}
                          </span>
                          <button onClick={() => handleDeleteTC(tc.id)} className="text-red-600">Delete</button>
                        </div>
                        <div>In: {tc.input.slice(0, 60)}{tc.input.length > 60 ? '...' : ''}</div>
                        <div>Out: {tc.expectedOutput.slice(0, 60)}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-center text-[var(--cf-muted)] py-16 text-sm">Select a problem</p>
              )}
            </div>
          </div>
        )}

        {showForm && (
          <Modal onClose={() => setShowForm(false)} title="Create Problem">
            <form onSubmit={handleCreate} className="space-y-3">
              <Input label="Problem ID (optional)" value={form.problemId || ''} onChange={(v) => setForm({ ...form, problemId: v })} />
              <Input label="Title" value={form.title || ''} onChange={(v) => setForm({ ...form, title: v })} required />
              <TextArea label="Statement" value={form.statement || ''} onChange={(v) => setForm({ ...form, statement: v })} required />
              <TextArea label="Input Format" value={form.inputFormat || ''} onChange={(v) => setForm({ ...form, inputFormat: v })} required />
              <TextArea label="Output Format" value={form.outputFormat || ''} onChange={(v) => setForm({ ...form, outputFormat: v })} required />
              <TextArea label="Constraints" value={form.constraints || ''} onChange={(v) => setForm({ ...form, constraints: v })} required />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Category" value={form.category || 'dsa'} onChange={(v) => setForm({ ...form, category: v })} options={['dsa', 'db']} />
                <Select label="Difficulty" value={form.difficulty || 'easy'} onChange={(v) => setForm({ ...form, difficulty: v })} options={['easy', 'medium', 'hard']} />
              </div>
              <Input label="Sample Input" value={form.samples?.[0]?.input || ''} onChange={(v) => setForm({ ...form, samples: [{ input: v, output: form.samples?.[0]?.output || '' }] })} />
              <Input label="Sample Output" value={form.samples?.[0]?.output || ''} onChange={(v) => setForm({ ...form, samples: [{ input: form.samples?.[0]?.input || '', output: v }] })} />

              <div className="border-t border-[var(--cf-border)] pt-3">
                <span className="text-xs font-bold block mb-1">Practice Mode (optional)</span>
                <p className="text-xs text-[var(--cf-muted)] mb-2">
                  Leave function name blank to skip practice mode for this problem — competitive mode
                  works either way and needs none of this.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <Input
                    label="Function Name"
                    value={form.signature?.funcName || ''}
                    onChange={(v) => setForm({ ...form, signature: { funcName: v, returnType: form.signature?.returnType || 'string' } })}
                  />
                  <Select
                    label="Return Type"
                    value={form.signature?.returnType || 'string'}
                    onChange={(v) => setForm({ ...form, signature: { funcName: form.signature?.funcName || '', returnType: v as ParamType } })}
                    options={PARAM_TYPES}
                  />
                </div>
                <InputSpecBuilder
                  spec={form.inputSpec || []}
                  onChange={(spec) => setForm({ ...form, inputSpec: spec })}
                />
              </div>

              <button type="submit" className="cf-btn w-full py-2">Create</button>
            </form>
          </Modal>
        )}

        {showTCForm && (
          <Modal onClose={() => setShowTCForm(false)} title="Add Test Case">
            <form onSubmit={handleAddTC} className="space-y-3">
              <TextArea label="Input" value={tcForm.input} onChange={(v) => setTCForm({ ...tcForm, input: v })} required />
              <TextArea label="Expected Output" value={tcForm.expectedOutput} onChange={(v) => setTCForm({ ...tcForm, expectedOutput: v })} required />
              <Select label="Size Bucket" value={tcForm.sizeBucket} onChange={(v) => setTCForm({ ...tcForm, sizeBucket: v })} options={['small', 'medium', 'large']} />
              <Input label="Weight" value={String(tcForm.weight)} onChange={(v) => setTCForm({ ...tcForm, weight: parseInt(v) || 10 })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={tcForm.isHidden} onChange={(e) => setTCForm({ ...tcForm, isHidden: e.target.checked })} />
                Hidden test case
              </label>
              <button type="submit" className="cf-btn w-full py-2">Add</button>
            </form>
          </Modal>
        )}
      </main>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="cf-panel p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between mb-4">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} className="text-[var(--cf-muted)] hover:text-black">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-bold">{label}</span>
      <input className="cf-input w-full mt-1" value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </label>
  );
}

function TextArea({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-bold">{label}</span>
      <textarea className="cf-input w-full mt-1 min-h-[80px]" value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <label className="block">
      <span className="text-xs font-bold">{label}</span>
      <select className="cf-select w-full mt-1" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

// Ordered list of "one line of stdin" entries. Order here is the order the
// practice-mode wrapper reads stdin in (see judge/wrapper.go), so drag order
// matters - use the up/down buttons rather than deleting and re-adding.
function InputSpecBuilder({ spec, onChange }: { spec: InputVar[]; onChange: (spec: InputVar[]) => void }) {
  const update = (i: number, patch: Partial<InputVar>) => {
    const next = spec.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(spec.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= spec.length) return;
    const next = spec.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () =>
    onChange([...spec, { name: '', type: 'int', passToFunc: true }]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold">Input Variables (stdin, in order)</span>
        <button type="button" onClick={add} className="cf-btn-secondary text-xs px-2 py-0.5">+ Add line</button>
      </div>
      {spec.length === 0 && (
        <p className="text-xs text-[var(--cf-muted)] mb-2">No lines yet — add one per line of stdin the problem reads.</p>
      )}
      <div className="space-y-2">
        {spec.map((v, i) => (
          <div key={i} className="border border-[var(--cf-border)] p-2 text-xs space-y-1">
            <div className="flex gap-2">
              <input
                className="cf-input flex-1"
                placeholder="name (e.g. arr)"
                value={v.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <select
                className="cf-select"
                value={v.type}
                onChange={(e) => update(i, { type: e.target.value as ParamType })}
              >
                {PARAM_TYPES.map((t:any) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={v.passToFunc}
                  onChange={(e) => update(i, { passToFunc: e.target.checked })}
                />
                Pass to function
              </label>
              {(v.type === 'int[]' || v.type === 'float[]' || v.type === 'string[]') && (
                <input
                  className="cf-input flex-1"
                  placeholder="length var (optional, e.g. n)"
                  value={v.lengthVar || ''}
                  onChange={(e) => update(i, { lengthVar: e.target.value })}
                />
              )}
              <div className="ml-auto flex gap-1">
                <button type="button" onClick={() => move(i, -1)} className="px-1">↑</button>
                <button type="button" onClick={() => move(i, 1)} className="px-1">↓</button>
                <button type="button" onClick={() => remove(i)} className="text-red-600 px-1">✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}