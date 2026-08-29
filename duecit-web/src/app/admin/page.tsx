'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Database, Activity, Users, Zap, FileCode,
  Plus, Trash2, Edit2, Upload, X, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Clock, LogOut, BarChart3, Search, RefreshCw, TrendingUp, Calendar,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  api, AdminStats, ActiveMatch, InputVar, ParamType, PARAM_TYPES, ProblemImportResult, AdminUserRow, UsageStats, DailyCount,
} from '@/lib/api';
import { FullPageSpinner } from '@/components/ui/Spinner';

/*  Types  */
interface TestCase {
  id: string; input: string; expectedOutput: string;
  sizeBucket: string; weight: number; isHidden: boolean;
}
type TestCaseInput = Omit<TestCase, 'id'>;

interface Problem {
  id?: string; problemId: string; title: string; statement: string;
  inputFormat: string; outputFormat: string; constraints: string;
  samples: { input: string; output: string }[];
  category: string; difficulty: string; tags: string[];
  inputSpec?: InputVar[];
  signature?: { funcName: string; params?: string[]; returnType: ParamType };
  driverCode?: Record<string, string>;
  testCases?: TestCaseInput[];
}

type Tab = 'monitor' | 'users' | 'analytics' | 'problems';

const emptyProblemForm = (): Partial<Problem> => ({
  category: 'dsa', difficulty: 'easy', tags: [], samples: [{ input: '', output: '' }],
  inputSpec: [], signature: { funcName: '', returnType: 'string' }, driverCode: {},
});
const emptyTestCase = (): TestCaseInput => ({
  input: '', expectedOutput: '', sizeBucket: 'small', weight: 10, isHidden: true,
});

/*  Shared form primitives  */
function FLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold text-secondary uppercase tracking-wider">{children}</span>;
}

function FInput({ label, value, onChange, required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FLabel>{label}</FLabel>
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder}
        className="w-full bg-[var(--bg-input)] border border-[var(--border)] hover:border-[var(--border-light)] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 rounded-xl px-3 py-2 text-sm text-primary placeholder:text-muted outline-none transition-all" />
    </div>
  );
}

function FTextArea({ label, value, onChange, required, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FLabel>{label}</FLabel>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} required={required} rows={rows}
        className="w-full bg-[var(--bg-input)] border border-[var(--border)] hover:border-[var(--border-light)] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 rounded-xl px-3 py-2 text-sm text-primary outline-none transition-all resize-y" />
    </div>
  );
}

function FSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FLabel>{label}</FLabel>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[var(--bg-input)] border border-[var(--border)] hover:border-[var(--border-light)] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 rounded-xl px-3 py-2 text-sm text-primary outline-none transition-all cursor-pointer"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748B' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
        {options.map((o) => <option key={o} value={o} style={{ background: 'var(--bg-input)' }}>{o}</option>)}
      </select>
    </div>
  );
}

/*  Dark Modal  */
function AdminModal({ open, onClose, title, children, maxWidth = 'max-w-2xl' }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string;
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4 pb-8" aria-modal role="dialog">
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className={`relative w-full ${maxWidth} max-h-[85vh] overflow-y-auto bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl`}>
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-card)] z-10">
              <h2 className="font-bold text-primary">{title}</h2>
              <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-[var(--bg-elevated)] transition-colors"><X size={15} /></button>
            </div>
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/*  TestCaseBuilder  */
function TestCaseBuilder({ cases, onChange }: { cases: TestCaseInput[]; onChange: (c: TestCaseInput[]) => void }) {
  const update = (i: number, patch: Partial<TestCaseInput>) => { const n = cases.slice(); n[i] = { ...n[i], ...patch }; onChange(n); };
  const remove = (i: number) => onChange(cases.filter((_, idx) => idx !== i));
  const add = () => onChange([...cases, emptyTestCase()]);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <FLabel>Test Cases</FLabel>
        <button type="button" onClick={add}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[var(--primary)] border border-[color-mix(in_srgb,var(--primary)_30%,transparent)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 rounded-lg transition-colors">
          <Plus size={12} /> Add test
        </button>
      </div>
      <div className="space-y-3">
        {cases.map((tc, i) => (
          <div key={i} className="border border-[var(--border)] rounded-xl p-4 space-y-3 bg-[var(--bg-input)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-secondary">Test {i + 1}</span>
              <button type="button" onClick={() => remove(i)} className="text-[var(--error)] hover:text-red-300 transition-colors"><Trash2 size={13} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FTextArea label="Input" value={tc.input} onChange={(v) => update(i, { input: v })} />
              <FTextArea label="Expected Output" value={tc.expectedOutput} onChange={(v) => update(i, { expectedOutput: v })} />
            </div>
            <div className="grid grid-cols-3 gap-3 items-end">
              <FSelect label="Size" value={tc.sizeBucket} onChange={(v) => update(i, { sizeBucket: v })} options={['small', 'medium', 'large']} />
              <FInput label="Weight" value={String(tc.weight)} onChange={(v) => update(i, { weight: parseInt(v, 10) || 10 })} />
              <label className="flex items-center gap-2 text-sm text-secondary pb-2 cursor-pointer">
                <input type="checkbox" checked={tc.isHidden} onChange={(e) => update(i, { isHidden: e.target.checked })}
                  className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg-input)] accent-[#3B82F6]" />
                Hidden
              </label>
            </div>
          </div>
        ))}
        {cases.length === 0 && <p className="text-xs text-muted text-center py-3">No test cases added yet</p>}
      </div>
    </div>
  );
}

/*  InputSpecBuilder  */
function InputSpecBuilder({ spec, onChange }: { spec: InputVar[]; onChange: (s: InputVar[]) => void }) {
  const update = (i: number, patch: Partial<InputVar>) => { const n = spec.slice(); n[i] = { ...n[i], ...patch }; onChange(n); };
  const remove = (i: number) => onChange(spec.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= spec.length) return; const n = spec.slice(); [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  const add = () => onChange([...spec, { name: '', type: 'int', passToFunc: true }]);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <FLabel>Input Variables (stdin, in order)</FLabel>
        <button type="button" onClick={add}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[var(--primary)] border border-[color-mix(in_srgb,var(--primary)_30%,transparent)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 rounded-lg transition-colors">
          <Plus size={12} /> Add line
        </button>
      </div>
      {spec.length === 0 && <p className="text-xs text-muted mb-2">No lines yet — add one per stdin line the problem reads.</p>}
      <div className="space-y-2">
        {spec.map((v, i) => (
          <div key={i} className="border border-[var(--border)] rounded-xl p-3 space-y-2 bg-[var(--bg-input)]">
            <div className="flex gap-2">
              <input className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] focus:border-[#3B82F6] rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
                placeholder="name (e.g. arr)" value={v.name} onChange={(e) => update(i, { name: e.target.value })} />
              <select className="bg-[var(--bg-input)] border border-[var(--border)] focus:border-[#3B82F6] rounded-lg px-2 py-1.5 text-xs text-primary outline-none"
                value={v.type} onChange={(e) => update(i, { type: e.target.value as ParamType })}
                style={{ background: 'var(--bg-input)' }}>
                {PARAM_TYPES.map((t) => <option key={t} value={t} style={{ background: 'var(--bg-input)' }}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-secondary cursor-pointer">
                <input type="checkbox" checked={v.passToFunc} onChange={(e) => update(i, { passToFunc: e.target.checked })} className="accent-[#3B82F6]" />
                Pass to function
              </label>
              {(v.type === 'int[]' || v.type === 'float[]' || v.type === 'string[]') && (
                <input className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-primary outline-none"
                  placeholder="length var (e.g. n)" value={v.lengthVar || ''} onChange={(e) => update(i, { lengthVar: e.target.value })} />
              )}
              <div className="ml-auto flex gap-1">
                <button type="button" onClick={() => move(i, -1)} className="p-1 text-muted hover:text-secondary"><ChevronUp size={13} /></button>
                <button type="button" onClick={() => move(i, 1)}  className="p-1 text-muted hover:text-secondary"><ChevronDown size={13} /></button>
                <button type="button" onClick={() => remove(i)}   className="p-1 text-[var(--error)] hover:text-red-300"><X size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/*  DriverCodeBuilder  */
const DRIVER_LANGUAGES = ['python', 'javascript', 'go', 'cpp', 'java', 'c'];

function DriverCodeBuilder({ driverCode, onChange }: { driverCode: Record<string, string>; onChange: (d: Record<string, string>) => void }) {
  const [openLang, setOpenLang] = useState<string | null>(null);
  const update = (lang: string, value: string) => { const n = { ...driverCode }; if (value.trim()) n[lang] = value; else delete n[lang]; onChange(n); };
  return (
    <div className="space-y-1.5">
      {DRIVER_LANGUAGES.map((lang) => {
        const has = !!driverCode[lang]?.trim();
        const isOpen = openLang === lang;
        return (
          <div key={lang} className="border border-[var(--border)] rounded-xl overflow-hidden">
            <button type="button" onClick={() => setOpenLang(isOpen ? null : lang)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold bg-[var(--bg-input)] hover:bg-[var(--bg-elevated)] transition-colors">
              <span className="flex items-center gap-2">
                {lang}
                {has && <span className="flex items-center gap-1 text-[var(--success)]"><CheckCircle2 size={11} /> configured</span>}
              </span>
              {isOpen ? <ChevronUp size={13} className="text-muted" /> : <ChevronDown size={13} className="text-muted" />}
            </button>
            {isOpen && (
              <textarea rows={8} value={driverCode[lang] || ''} onChange={(e) => update(lang, e.target.value)}
                placeholder={`Driver for ${lang} — must contain ##SOLUTION##`}
                className="w-full bg-[var(--bg-input)] border-t border-[var(--border)] px-4 py-3 text-xs font-mono text-secondary outline-none resize-y" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/*  Usage Bar Chart  */
function UsageBarChart({ title, data, color, icon }: { title: string; data: DailyCount[]; color: string; icon?: React.ReactNode }) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-bold text-primary text-sm">{title}</h3>
        <span className="ml-auto text-xs text-muted">{data.reduce((a,b)=>a+b.count,0)} total · max {max}/day</span>
      </div>
      <div className="flex items-end gap-1 h-32">
        {data.map((d, i) => {
          const h = max ? (d.count / max) * 100 : 0;
          const label = d.date.slice(5);
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="w-full flex justify-center" style={{ height: '96px' }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: i * 0.02, duration: 0.4 }}
                  className="w-full rounded-t-lg flex items-start justify-center pt-1 text-[10px] font-bold text-white"
                  style={{ background: color, alignSelf: 'flex-end', minHeight: d.count ? '12px' : '2px', opacity: d.count ? 1 : 0.2 }}
                  title={`${d.date}: ${d.count}`}
                >
                  {d.count > 0 && h > 18 ? d.count : ''}
                </motion.div>
              </div>
              <span className="text-[9px] text-muted font-mono rotate-0 truncate w-full text-center" title={d.date}>{label}</span>
            </div>
          );
        })}
      </div>
      {data.every(d=>d.count===0) && <p className="text-xs text-muted text-center mt-2">No data in this period</p>}
    </div>
  );
}

/*  Diff badge  */
const DIFF_MAP: Record<string, string> = {
  easy:   'text-[var(--success)] bg-[var(--success-dim)] border-[color-mix(in_srgb,var(--success)_20%,transparent)]',
  medium: 'text-[var(--warning)] bg-[var(--warning-dim)] border-[color-mix(in_srgb,var(--warning)_20%,transparent)]',
  hard:   'text-[var(--error)] bg-[var(--error-dim)] border-[color-mix(in_srgb,var(--error)_20%,transparent)]',
};

/*  Main AdminPage  */
export default function AdminPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('monitor');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activeMatches, setActiveMatches] = useState<ActiveMatch[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selected, setSelected] = useState<Problem | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [showTCForm, setShowTCForm] = useState(false);
  const [form, setForm] = useState<Partial<Problem>>(emptyProblemForm());
  const [formTestCases, setFormTestCases] = useState<TestCaseInput[]>([]);
  const [tcForm, setTCForm] = useState<TestCaseInput>(emptyTestCase());
  const [importMode, setImportMode] = useState<'skip' | 'overwrite'>('skip');
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<ProblemImportResult | null>(null);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersSearch, setUsersSearch] = useState('');
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [usageDays, setUsageDays] = useState(14);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);

  useEffect(() => { if (!loading && (!user || user.role !== 'admin')) router.push('/login'); }, [user, loading, router]);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadMonitor(); loadProblems(); loadUsers(); loadUsage(usageDays);
      const id = setInterval(loadMonitor, 10000);
      return () => clearInterval(id);
    }
  }, [user]);

  async function loadMonitor() {
    try { const [s, m] = await Promise.all([api.adminStats(), api.adminActiveMatches()]); setStats(s); setActiveMatches(m || []); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load stats'); }
  }

  async function loadUsers() {
    setUsersLoading(true);
    try { const list = await api.adminUsers(200); setUsers(list || []); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load users'); } finally { setUsersLoading(false); }
  }
  async function loadUsage(days: number) {
    setUsageLoading(true);
    try { const u = await api.adminUsageStats(days); setUsageStats(u); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load usage'); } finally { setUsageLoading(false); }
  }

  const handleLogout = () => {
    logout();
    router.push('/login');
  };
  async function loadProblems() {
    try { const list = await api.listProblems() as Problem[]; setProblems(list || []); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load problems'); }
  }
  async function loadTestCases(problemId: string) {
    try { const list = await api.getTestCases(problemId) as TestCase[]; setTestCases(list || []); }
    catch { setTestCases([]); }
  }

  const buildProblemPayload = () => {
    const inputSpec = form.inputSpec || [];
    const hasSignature = !!form.signature?.funcName;
    return {
      ...form,
      problemId: editingProblemId ? undefined : form.problemId || undefined,
      tags: form.tags || [],
      samples: form.samples?.length ? form.samples : [{ input: '', output: '' }],
      inputSpec: inputSpec.length ? inputSpec : undefined,
      signature: hasSignature ? { funcName: form.signature!.funcName, returnType: form.signature!.returnType, params: inputSpec.filter((v) => v.passToFunc).map((v) => v.name) } : undefined,
      testCases: undefined,
    };
  };

  const beginCreate = () => { setEditingProblemId(null); setForm(emptyProblemForm()); setFormTestCases([]); setShowForm(true); };
  const beginEdit = (p: Problem) => {
    setEditingProblemId(p.problemId);
    setForm({ problemId: p.problemId, title: p.title, statement: p.statement, inputFormat: p.inputFormat, outputFormat: p.outputFormat, constraints: p.constraints, category: p.category, difficulty: p.difficulty, tags: p.tags || [], samples: p.samples?.length ? p.samples : [{ input: '', output: '' }], inputSpec: p.inputSpec || [], signature: { funcName: p.signature?.funcName || '', returnType: p.signature?.returnType || 'string' }, driverCode: p.driverCode || {} });
    setFormTestCases([]); setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = buildProblemPayload();
      let saved: Problem | null = null;
      if (editingProblemId) { saved = (await api.updateProblem(editingProblemId, payload)) as Problem; }
      else {
        saved = (await api.createProblem(payload)) as Problem;
        for (const tc of formTestCases) { if (!tc.input.trim() && !tc.expectedOutput.trim()) continue; await api.addTestCase(saved.problemId, tc); }
      }
      setShowForm(false); setEditingProblemId(null); setForm(emptyProblemForm()); setFormTestCases([]);
      await loadProblems(); await loadMonitor();
      if (saved) { setSelected(saved); loadTestCases(saved.problemId); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed'); }
  };

  const handleImportFile = async (file: File | null) => { if (!file) return; setImportText(await file.text()); };
  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setImportResult(null);
    try {
      const parsed = JSON.parse(importText) as unknown;
      const toImport = Array.isArray(parsed) ? parsed : (typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { problems?: unknown }).problems)) ? (parsed as { problems: unknown[] }).problems : null;
      if (!toImport) throw new Error('Import JSON must be an array or object with a problems array');
      const result = await api.importProblems(importMode, toImport as Record<string, unknown>[]);
      setImportResult(result); await loadProblems(); await loadMonitor();
    } catch (err) { setError(err instanceof Error ? err.message : 'Import failed'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this problem?')) return;
    await api.deleteProblem(id);
    if (selected?.problemId === id) setSelected(null);
    loadProblems(); loadMonitor();
  };

  const handleAddTC = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selected) return;
    try { await api.addTestCase(selected.problemId, tcForm); setShowTCForm(false); setTCForm(emptyTestCase()); loadTestCases(selected.problemId); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to add test case'); }
  };

  const handleDeleteTC = async (tcId: string) => {
    if (!selected) return;
    await api.deleteTestCase(selected.problemId, tcId);
    loadTestCases(selected.problemId);
  };

  if (loading || !user) return <FullPageSpinner />;

  const filteredUsers = users.filter(u => {
    if (!usersSearch.trim()) return true;
    const q = usersSearch.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const formatDate = (iso: string) => {
    try { const d = new Date(iso); return d.toLocaleString(); } catch { return iso; }
  };
  const formatLastSeen = (u: AdminUserRow) => {
    if (u.lastSeenAt) return formatDate(u.lastSeenAt);
    return formatDate(u.updatedAt) + ' (via update)';
  };

  const SIDEBAR: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'monitor'  , label: 'Monitor',  icon: <Activity size={16} /> },
    { id: 'users'    , label: 'Users',    icon: <Users size={16} /> },
    { id: 'analytics', label: 'Analytics',icon: <BarChart3 size={16} /> },
    { id: 'problems' , label: 'Problems',  icon: <Database size={16} /> },
  ];

  const getTabTitle = () => {
    switch(tab){
      case 'monitor': return 'Monitor';
      case 'users': return 'Registered Users';
      case 'analytics': return 'Platform Usage';
      case 'problems': return 'Problem Management';
    }
  };

  return (
    <div className="min-h-screen surface flex">
      {/* ── Sidebar ── */}
      <div className="w-56 shrink-0 border-r border-[var(--border)] flex flex-col bg-[var(--bg-input)]">
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
          <div className="w-7 h-7 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-lg flex items-center justify-center shrink-0">
            <LayoutDashboard size={13} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-primary leading-none">DuecIt</p>
            <p className="text-xs text-muted mt-0.5">Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {SIDEBAR.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === item.id
                  ? 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[color-mix(in_srgb,var(--primary)_20%,transparent)]'
                  : 'text-secondary hover:text-primary hover:bg-[var(--bg-elevated)]'
              }`}>
              {item.icon}{item.label}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-[var(--border)]">
          <p className="text-xs text-muted">Signed in as</p>
          <p className="text-sm font-semibold text-secondary truncate">{user.username}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold text-secondary transition-colors hover:border-[var(--error)] hover:bg-[var(--error-dim)] hover:text-[var(--error)]"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 min-w-0 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">

          {/* Page header */}
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-primary">{getTabTitle()}</h1>
              <p className="text-xs text-muted mt-1">Admins cannot enter matchmaking</p>
            </div>
            {(tab==='users' || tab==='analytics') && (
              <button onClick={()=>{ loadUsers(); loadUsage(usageDays); loadMonitor(); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-xs text-secondary hover:text-primary transition-colors"><RefreshCw size={13}/> Refresh</button>
            )}
          </div>

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-center gap-2.5 px-4 py-3 bg-[var(--error-dim)] border border-[color-mix(in_srgb,var(--error)_20%,transparent)] rounded-xl text-sm text-[var(--error)]">
              <AlertTriangle size={14} /> {error}
              <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
            </motion.div>
          )}

          {/* ── Monitor tab ── */}
          {tab === 'monitor' && stats && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              {/* Stat cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Total Users',    value: stats.totalUsers,    icon: <Users size={18} />,    color: 'text-[var(--primary)]', glow: 'rgba(59,130,246,0.08)'  },
                  { label: 'Active Matches', value: stats.activeMatches, icon: <Zap size={18} />,      color: 'text-[var(--success)]', glow: 'rgba(34,197,94,0.08)'   },
                  { label: 'Problems',       value: stats.totalProblems, icon: <FileCode size={18} />, color: 'text-[var(--purple)]', glow: 'rgba(139,92,246,0.08)'  },
                ].map((s) => (
                  <div key={s.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--border-light)] transition-colors"
                    style={{ background: `linear-gradient(135deg, #111827, ${s.glow})` }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-muted uppercase tracking-wider">{s.label}</p>
                      <span className={s.color}>{s.icon}</span>
                    </div>
                    <p className={`text-3xl font-bold font-mono ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Active matches table */}
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
                  <Activity size={15} className="text-[var(--success)]" />
                  <h2 className="font-bold text-primary">Active Matches</h2>
                  {activeMatches.length > 0 && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-[var(--success)] font-semibold">
                      <span className="w-1.5 h-1.5 bg-[#22C55E] rounded-full animate-pulse" />{activeMatches.length} live
                    </span>
                  )}
                </div>
                {activeMatches.length === 0 ? (
                  <div className="py-12 text-center">
                    <Clock size={24} className="text-[#374151] mx-auto mb-2" />
                    <p className="text-sm text-muted">No active matches</p>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-7 px-5 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider border-b border-[var(--border)] bg-[var(--bg-input)]">
                      <div>Match ID</div><div>Problem</div><div>Category</div>
                      <div>Difficulty</div><div>Mode</div><div>Phase</div><div>Started</div>
                    </div>
                    {activeMatches.map((m) => (
                      <div key={m.matchId} className="grid grid-cols-7 px-5 py-3 border-b border-[var(--border)] last:border-0 hover:bg-[color-mix(in_srgb,var(--text)_2%,transparent)] transition-colors text-sm">
                        <div className="font-mono text-xs text-muted">{m.matchId.slice(-8)}</div>
                        <div className="text-secondary truncate">{m.problemId}</div>
                        <div className="text-secondary uppercase text-xs">{m.category}</div>
                        <div><span className={`px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${DIFF_MAP[m.difficulty] || 'text-secondary'}`}>{m.difficulty}</span></div>
                        <div className="text-secondary capitalize text-xs">{m.mode}</div>
                        <div className="text-secondary capitalize text-xs">{m.phase}</div>
                        <div className="text-xs text-muted font-mono">{new Date(m.startTime).toLocaleTimeString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Users tab ── */}
          {tab === 'users' && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3 flex-wrap">
                  <Users size={15} className="text-[var(--primary)]" />
                  <h2 className="font-bold text-primary text-sm">All Registered Users <span className="text-muted font-normal">({filteredUsers.length}/{users.length})</span></h2>
                  {usersLoading && <span className="text-xs text-muted ml-2">Loading…</span>}
                  <div className="ml-auto flex items-center gap-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                      <input value={usersSearch} onChange={e=>setUsersSearch(e.target.value)} placeholder="Search username or email…"
                        className="pl-8 pr-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-xs text-primary placeholder:text-muted outline-none focus:border-[#3B82F6] w-56" />
                    </div>
                    <button onClick={loadUsers} className="p-1.5 rounded-lg border border-[var(--border)] text-muted hover:text-primary"><RefreshCw size={13}/></button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--bg-input)] border-b border-[var(--border)] text-xs font-semibold text-muted uppercase tracking-wider">
                        <th className="text-left px-4 py-2.5">Username</th>
                        <th className="text-left px-4 py-2.5">Email</th>
                        <th className="text-left px-4 py-2.5">Role</th>
                        <th className="text-left px-4 py-2.5">Rating DSA/DB</th>
                        <th className="text-left px-4 py-2.5"><span className="flex items-center gap-1"><Calendar size={11}/>Registered</span></th>
                        <th className="text-left px-4 py-2.5">Last Online</th>
                        <th className="text-left px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredUsers.map(u => (
                        <tr key={u.id} className="hover:bg-[color-mix(in_srgb,var(--text)_2%,transparent)] transition-colors">
                          <td className="px-4 py-3 font-semibold text-primary">{u.username}</td>
                          <td className="px-4 py-3 text-secondary text-xs">{u.email}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${u.role==='admin' ? 'text-[var(--purple)] bg-[var(--purple)]/10 border-[var(--purple)]/20' : 'text-secondary bg-[var(--bg-elevated)] border-[var(--border)]'}`}>{u.role}</span></td>
                          <td className="px-4 py-3 font-mono text-xs text-secondary">{u.ratingDSA} / {u.ratingDB}</td>
                          <td className="px-4 py-3 text-xs text-muted font-mono" title={u.createdAt}>{formatDate(u.createdAt)}</td>
                          <td className="px-4 py-3 text-xs text-muted font-mono" title={u.lastSeenAt || u.updatedAt}>{formatLastSeen(u)}</td>
                          <td className="px-4 py-3">{u.isOnline ? <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--success)]"><span className="w-2 h-2 bg-[var(--success)] rounded-full animate-pulse"/> Online</span> : <span className="text-xs text-muted">Offline</span>}</td>
                        </tr>
                      ))}
                      {filteredUsers.length===0 && (
                        <tr><td colSpan={7} className="text-center py-10 text-sm text-muted">{usersLoading ? 'Loading users…' : 'No users found'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 bg-[var(--bg-input)] border-t border-[var(--border)] text-xs text-muted">
                  Showing {filteredUsers.length} user(s). Registration date is <code className="bg-[var(--bg-elevated)] px-1 rounded">createdAt</code>, last online is <code className="bg-[var(--bg-elevated)] px-1 rounded">lastSeenAt</code> updated on every authenticated request (online if seen &lt;5 min ago).
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Analytics tab ── */}
          {tab === 'analytics' && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-secondary">
                  <TrendingUp size={16} className="text-[var(--primary)]"/> Platform Usage
                  {usageLoading && <span className="text-xs text-muted">loading…</span>}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {[7,14,30].map(d=>(
                    <button key={d} onClick={()=>{ setUsageDays(d); loadUsage(d); }} className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${usageDays===d ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-[var(--bg-card)] text-secondary border-[var(--border)] hover:border-[var(--primary)]'}`}>{d}d</button>
                  ))}
                  <button onClick={()=>loadUsage(usageDays)} className="p-1.5 rounded-lg border border-[var(--border)] text-muted hover:text-primary"><RefreshCw size={13}/></button>
                </div>
              </div>

              {usageStats ? (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <UsageBarChart title="New Registrations / day" data={usageStats.registrationsDaily} color="#3B82F6" icon={<Users size={14} className="text-[#3B82F6]"/>}/>
                    <UsageBarChart title="Matches Created / day" data={usageStats.matchesDaily} color="#22C55E" icon={<Zap size={14} className="text-[#22C55E]"/>}/>
                    <UsageBarChart title="Submissions / day" data={usageStats.submissionsDaily} color="#8B5CF6" icon={<FileCode size={14} className="text-[#8B5CF6]"/>}/>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
                      <h3 className="font-bold text-primary text-sm mb-3 flex items-center gap-2"><Users size={14}/> Users by Role</h3>
                      <div className="space-y-2">
                        {Object.entries(usageStats.usersByRole).length===0 ? <p className="text-xs text-muted">No data</p> : Object.entries(usageStats.usersByRole).map(([role,count])=>{
                          const total = Object.values(usageStats.usersByRole).reduce((a,b)=>a+b,0) || 1;
                          const pct = Math.round((count/total)*100);
                          return (
                            <div key={role} className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-secondary capitalize w-16">{role}</span>
                              <div className="flex-1 h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: role==='admin' ? '#8B5CF6' : '#3B82F6' }} />
                              </div>
                              <span className="text-xs font-mono text-muted w-12 text-right">{count} ({pct}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
                      <h3 className="font-bold text-primary text-sm mb-3 flex items-center gap-2"><Activity size={14}/> Matches by Status</h3>
                      <div className="space-y-2">
                        {Object.entries(usageStats.matchesByStatus).length===0 ? <p className="text-xs text-muted">No matches yet</p> : Object.entries(usageStats.matchesByStatus).map(([status,count])=>{
                          const total = Object.values(usageStats.matchesByStatus).reduce((a,b)=>a+b,0) || 1;
                          const pct = Math.round((count/total)*100);
                          const col = status==='active' ? '#22C55E' : status==='finished' ? '#3B82F6' : '#64748B';
                          return (
                            <div key={status} className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-secondary capitalize w-16">{status}</span>
                              <div className="flex-1 h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
                              </div>
                              <span className="text-xs font-mono text-muted w-12 text-right">{count} ({pct}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
                      <h3 className="font-bold text-primary text-sm mb-3 flex items-center gap-2"><Database size={14}/> Problems by Difficulty</h3>
                      <div className="space-y-2">
                        {Object.entries(usageStats.problemsByDifficulty).length===0 ? <p className="text-xs text-muted">No problems</p> : Object.entries(usageStats.problemsByDifficulty).map(([diff,count])=>{
                          const total = Object.values(usageStats.problemsByDifficulty).reduce((a,b)=>a+b,0) || 1;
                          const pct = Math.round((count/total)*100);
                          const col = diff==='easy' ? '#22C55E' : diff==='medium' ? '#F59E0B' : '#EF4444';
                          return (
                            <div key={diff} className="flex items-center gap-3">
                              <span className="text-xs font-semibold capitalize w-16" style={{ color: col }}>{diff}</span>
                              <div className="flex-1 h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
                              </div>
                              <span className="text-xs font-mono text-muted w-12 text-right">{count} ({pct}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
                    <h3 className="font-bold text-primary text-sm mb-2">How to read these graphs</h3>
                    <p className="text-xs text-muted leading-relaxed">
                      Each bar is one day (YYYY-MM-DD). Registrations and matches are aggregated by <code className="bg-[var(--bg-elevated)] px-1 rounded">createdAt</code>.
                      Submissions by <code className="bg-[var(--bg-elevated)] px-1 rounded">submittedAt</code>. Use the 7/14/30d toggle to change window. Data is live from MongoDB aggregation; refresh to update.
                      For production you would wire this to a real analytics pipeline — this view already uses the same collections as the rest of the platform.
                    </p>
                  </div>
                </>
              ) : (
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-10 text-center">
                  <BarChart3 size={24} className="text-[#374151] mx-auto mb-2"/>
                  <p className="text-sm text-muted">{usageLoading ? 'Loading usage stats…' : 'No usage data available'}</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Problems tab ── */}
          {tab === 'problems' && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>

              {/* Bulk import */}
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 mb-5">
                <form onSubmit={handleBulkImport}>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Upload size={15} className="text-[var(--primary)]" />
                      <h2 className="font-bold text-primary text-sm">Bulk Import JSON</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={importMode} onChange={(e) => setImportMode(e.target.value as 'skip' | 'overwrite')}
                        className="bg-[var(--bg-input)] border border-[var(--border)] text-xs text-secondary rounded-lg px-2 py-1.5 outline-none">
                        <option value="skip">Append only</option>
                        <option value="overwrite">Overwrite matching IDs</option>
                      </select>
                      <label className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated)] border border-[var(--border)] text-xs text-secondary rounded-lg cursor-pointer transition-colors">
                        <Upload size={12} /> Browse
                        <input type="file" accept=".json" className="hidden" onChange={(e) => handleImportFile(e.target.files?.[0] || null)} />
                      </label>
                      <button type="submit" className="px-3 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold rounded-lg transition-colors">Import</button>
                    </div>
                  </div>
                  <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={4}
                    placeholder='[{"problemId":"P101","title":"Two Sum","testCases":[...]}]'
                    className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-4 py-3 text-xs font-mono text-secondary outline-none focus:border-[#3B82F6] resize-y" />
                  {importResult && (
                    <div className="mt-3 p-3 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl">
                      <p className="text-xs font-semibold text-secondary mb-2">
                        Created {importResult.created} · Overwritten {importResult.overwritten} · Skipped {importResult.skipped} · Failed {importResult.failed}
                      </p>
                      <div className="max-h-24 overflow-y-auto space-y-0.5">
                        {importResult.items.map((item, idx) => (
                          <p key={`${item.problemId}-${idx}`} className={`text-xs font-mono ${item.status === 'failed' ? 'text-[var(--error)]' : 'text-muted'}`}>
                            {item.problemId || '(missing id)'} · {item.status} · {item.testCases} tests{item.error ? ` · ${item.error}` : ''}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </form>
              </div>

              {/* Problem list + detail */}
              <div className="grid grid-cols-3 gap-4">
                {/* Left: problem list */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                    <h2 className="font-bold text-primary text-sm">Problems <span className="text-muted font-normal">({problems.length})</span></h2>
                    <button onClick={beginCreate}
                      className="flex items-center gap-1 px-2.5 py-1 bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 text-[var(--primary)] border border-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-xs font-semibold rounded-lg transition-colors">
                      <Plus size={12} /> New
                    </button>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto divide-y divide-[var(--border)]">
                    {problems.map((p) => (
                      <button key={p.problemId} onClick={() => { setSelected(p); loadTestCases(p.problemId); }}
                        className={`w-full text-left px-4 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--text)_3%,transparent)] ${selected?.problemId === p.problemId ? 'bg-[var(--primary)]/8 border-l-2 border-[#3B82F6]' : 'border-l-2 border-transparent'}`}>
                        <p className="text-sm font-semibold text-primary truncate">{p.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted font-mono">{p.problemId}</span>
                          <span className={`text-xs font-semibold capitalize px-1.5 py-0.5 rounded border ${DIFF_MAP[p.difficulty] || 'text-secondary'}`}>{p.difficulty}</span>
                        </div>
                      </button>
                    ))}
                    {problems.length === 0 && <p className="text-xs text-muted text-center py-8">No problems yet</p>}
                  </div>
                </div>

                {/* Right: detail */}
                <div className="col-span-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  {!selected ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <Database size={28} className="text-[#374151] mx-auto mb-2" />
                        <p className="text-sm text-muted">Select a problem to view details</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Problem header */}
                      <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-bold text-primary">{selected.title}</h2>
                          <p className="text-xs text-muted font-mono mt-0.5">{selected.problemId}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => beginEdit(selected)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-secondary hover:text-primary border border-[var(--border)] hover:border-[var(--border-light)] rounded-lg transition-colors">
                            <Edit2 size={11} /> Edit
                          </button>
                          <button onClick={() => handleDelete(selected.problemId)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--error)] hover:bg-[var(--error-dim)] border border-[color-mix(in_srgb,var(--error)_20%,transparent)] rounded-lg transition-colors">
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      </div>

                      {/* Statement preview */}
                      <div className="px-5 py-4 border-b border-[var(--border)]">
                        <p className="text-xs text-secondary line-clamp-3 leading-relaxed">{selected.statement}</p>
                      </div>

                      {/* Test cases */}
                      <div className="px-5 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-sm text-primary">Test Cases <span className="text-muted font-normal">({testCases.length})</span></h3>
                          <button onClick={() => setShowTCForm(true)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated)] border border-[var(--border)] text-xs text-secondary rounded-lg transition-colors">
                            <Plus size={12} /> Add
                          </button>
                        </div>
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                          {testCases.map((tc) => (
                            <div key={tc.id} className="flex items-start justify-between gap-3 p-3 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs text-muted">{tc.sizeBucket}</span>
                                  <span className="text-xs text-muted">w={tc.weight}</span>
                                  {tc.isHidden && <span className="text-xs text-[var(--purple)] font-semibold">hidden</span>}
                                </div>
                                <p className="text-xs font-mono text-secondary truncate">In: {tc.input.slice(0, 50)}{tc.input.length > 50 ? '…' : ''}</p>
                                <p className="text-xs font-mono text-muted truncate">Out: {tc.expectedOutput.slice(0, 50)}</p>
                              </div>
                              <button onClick={() => handleDeleteTC(tc.id)} className="text-[var(--error)] hover:text-red-300 shrink-0 mt-0.5"><Trash2 size={13} /></button>
                            </div>
                          ))}
                          {testCases.length === 0 && <p className="text-xs text-muted text-center py-4">No test cases</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Problem form modal ── */}
      <AdminModal open={showForm} onClose={() => { setShowForm(false); setEditingProblemId(null); }}
        title={editingProblemId ? 'Edit Problem' : 'Create Problem'} maxWidth="max-w-3xl">
        <form onSubmit={handleSave} className="space-y-4">
          {!editingProblemId && <FInput label="Problem ID (optional)" value={form.problemId || ''} onChange={(v) => setForm({ ...form, problemId: v })} placeholder="e.g. P101" />}
          <FInput label="Title" value={form.title || ''} onChange={(v) => setForm({ ...form, title: v })} required />
          <FTextArea label="Statement" value={form.statement || ''} onChange={(v) => setForm({ ...form, statement: v })} required rows={4} />
          <div className="grid grid-cols-2 gap-4">
            <FTextArea label="Input Format" value={form.inputFormat || ''} onChange={(v) => setForm({ ...form, inputFormat: v })} required />
            <FTextArea label="Output Format" value={form.outputFormat || ''} onChange={(v) => setForm({ ...form, outputFormat: v })} required />
          </div>
          <FTextArea label="Constraints" value={form.constraints || ''} onChange={(v) => setForm({ ...form, constraints: v })} required />
          <div className="grid grid-cols-2 gap-4">
            <FSelect label="Category" value={form.category || 'dsa'} onChange={(v) => setForm({ ...form, category: v })} options={['dsa', 'db']} />
            <FSelect label="Difficulty" value={form.difficulty || 'easy'} onChange={(v) => setForm({ ...form, difficulty: v })} options={['easy', 'medium', 'hard']} />
          </div>
          <FInput label="Tags (comma-separated)" value={(form.tags || []).join(', ')} onChange={(v) => setForm({ ...form, tags: v.split(',').map((t) => t.trim()).filter(Boolean) })} />
          <div className="grid grid-cols-2 gap-4">
            <FTextArea label="Sample Input" value={form.samples?.[0]?.input || ''} onChange={(v) => setForm({ ...form, samples: [{ input: v, output: form.samples?.[0]?.output || '' }] })} />
            <FTextArea label="Sample Output" value={form.samples?.[0]?.output || ''} onChange={(v) => setForm({ ...form, samples: [{ input: form.samples?.[0]?.input || '', output: v }] })} />
          </div>

          {!editingProblemId && (
            <div className="border-t border-[var(--border)] pt-4">
              <TestCaseBuilder cases={formTestCases} onChange={setFormTestCases} />
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-primary mb-1">Practice Mode (optional)</p>
              <p className="text-xs text-muted mb-3">Leave function name blank to skip. Competitive mode works regardless.</p>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <FInput label="Function Name" value={form.signature?.funcName || ''} onChange={(v) => setForm({ ...form, signature: { funcName: v, returnType: form.signature?.returnType || 'string' } })} />
                <FSelect label="Return Type" value={form.signature?.returnType || 'string'} onChange={(v) => setForm({ ...form, signature: { funcName: form.signature?.funcName || '', returnType: v as ParamType } })} options={PARAM_TYPES} />
              </div>
              <InputSpecBuilder spec={form.inputSpec || []} onChange={(spec) => setForm({ ...form, inputSpec: spec })} />
            </div>

            <div>
              <p className="text-xs font-semibold text-primary mb-1">Hand-Written Driver Code (optional)</p>
              <p className="text-xs text-muted mb-3">
                Overrides auto-generation. Must include <code className="text-[var(--primary)] bg-[var(--bg-elevated)] px-1 rounded">{'##SOLUTION##'}</code> token.
              </p>
              <DriverCodeBuilder driverCode={form.driverCode || {}} onChange={(driverCode) => setForm({ ...form, driverCode })} />
            </div>
          </div>

          <button type="submit"
            className="w-full py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold rounded-xl transition-all hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(59,130,246,0.3)]">
            {editingProblemId ? 'Save Changes' : 'Create Problem'}
          </button>
        </form>
      </AdminModal>

      {/* ── Add test case modal ── */}
      <AdminModal open={showTCForm} onClose={() => setShowTCForm(false)} title="Add Test Case" maxWidth="max-w-lg">
        <form onSubmit={handleAddTC} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FTextArea label="Input" value={tcForm.input} onChange={(v) => setTCForm({ ...tcForm, input: v })} required />
            <FTextArea label="Expected Output" value={tcForm.expectedOutput} onChange={(v) => setTCForm({ ...tcForm, expectedOutput: v })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FSelect label="Size Bucket" value={tcForm.sizeBucket} onChange={(v) => setTCForm({ ...tcForm, sizeBucket: v })} options={['small', 'medium', 'large', 'edge', 'stress', 'tle', 'memory']} />
            <FInput label="Weight" value={String(tcForm.weight)} onChange={(v) => setTCForm({ ...tcForm, weight: parseInt(v) || 10 })} />
          </div>
          <p className="text-xs text-muted">
            Use edge/stress/tle/memory buckets for hidden cases that target boundary logic, slow algorithms, or heavy input.
          </p>
          <label className="flex items-center gap-2.5 text-sm text-secondary cursor-pointer">
            <input type="checkbox" checked={tcForm.isHidden} onChange={(e) => setTCForm({ ...tcForm, isHidden: e.target.checked })}
              className="w-4 h-4 rounded accent-[#3B82F6]" />
            Hidden test case
          </label>
          <button type="submit" className="w-full py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold rounded-xl transition-all">
            Add Test Case
          </button>
        </form>
      </AdminModal>
    </div>
  );
}
