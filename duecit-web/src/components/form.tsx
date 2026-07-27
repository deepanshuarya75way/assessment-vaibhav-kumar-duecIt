'use client';
 
import { useState } from 'react';
 
type IconName = 'user' | 'mail' | 'lock';
 
function Icon({ name }: { name: IconName }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (name === 'user') {
    return (
      <svg {...common}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  }
  if (name === 'mail') {
    return (
      <svg {...common}>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m2 7 10 6 10-6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
 
interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
}
 
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  hint,
  icon = 'user',
  type = 'text',
}: FieldProps & { icon?: IconName; type?: string }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]">
          <Icon name={icon} />
        </span>
        <input
          type={type}
          className="cf-input w-full"
          style={{ paddingLeft: 34 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
        />
      </span>
      {hint && <span className="mt-1.5 block text-[12px] text-[var(--text-faint)]">{hint}</span>}
    </label>
  );
}
 
export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  hint,
  minLength,
}: FieldProps & { minLength?: number }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]">
          <Icon name="lock" />
        </span>
        <input
          type={visible ? 'text' : 'password'}
          className="cf-input w-full"
          style={{ paddingLeft: 34, paddingRight: 38 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
            {!visible && <path d="m3 3 18 18" />}
          </svg>
        </button>
      </span>
      {hint && <span className="mt-1.5 block text-[12px] text-[var(--text-faint)]">{hint}</span>}
    </label>
  );
}
 
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      className="animate-fade-in mb-4 rounded-lg border px-3 py-2 text-[13px]"
      style={{
        borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)',
        background: 'var(--danger-soft)',
        color: 'var(--danger)',
      }}
    >
      {message}
    </p>
  );
}
 
export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      className="animate-fade-in mb-4 rounded-lg border px-3 py-2 text-[13px]"
      style={{
        borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)',
        background: 'var(--success-soft)',
        color: 'var(--success)',
      }}
    >
      {message}
    </p>
  );
}
 
export function OAuthButtons({
  providers,
  googleLabel,
  githubLabel,
  href,
}: {
  providers: { google: boolean; github: boolean };
  googleLabel: string;
  githubLabel: string;
  href: (provider: string) => string;
}) {
  if (!providers.google && !providers.github) return null;
  return (
    <div className="mb-6">
      <div className="flex flex-col gap-2">
        {providers.google && (
          <a href={href('google')} className="cf-btn-secondary w-full py-2.5 no-underline">
            {googleLabel}
          </a>
        )}
        {providers.github && (
          <a href={href('github')} className="cf-btn-secondary w-full py-2.5 no-underline">
            {githubLabel}
          </a>
        )}
      </div>
      <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
        <span className="h-px flex-1 bg-[var(--border)]" />
        or
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>
    </div>
  );
}