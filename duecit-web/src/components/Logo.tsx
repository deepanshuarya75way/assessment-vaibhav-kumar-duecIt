import Link from 'next/link';
import { Terminal } from 'lucide-react';

export default function Logo({ href = '/', size = 'md' }: { href?: string; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const icon = size === 'sm' ? 14 : 15;

  return (
    <Link href={href} className="group flex items-center gap-2.5 no-underline">
      <span className={`${box} flex items-center justify-center border border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] transition-colors group-hover:bg-transparent group-hover:text-[var(--accent)]`}>
        <Terminal size={icon} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="font-semibold tracking-tight text-[var(--text)]">DuecIt<span className="text-[var(--accent)]">.</span></span>
    </Link>
  );
}
