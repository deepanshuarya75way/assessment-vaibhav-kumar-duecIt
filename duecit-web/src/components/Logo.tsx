import Link from 'next/link';
 
export default function Logo({ href = '/', size = 'md' }: { href?: string; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-7 w-7 text-[13px]' : 'h-8 w-8 text-[15px]';
  return (
    <Link href={href} className="group flex items-center gap-2.5 no-underline">
      <span
        className={`${box} flex items-center justify-center rounded-lg font-bold text-white transition-transform duration-200 group-hover:scale-105`}
        style={{ background: 'linear-gradient(135deg, var(--accent), var(--violet))' }}
      >
        ⌘
      </span>
      <span className="text-[15px] font-bold tracking-tight text-[var(--text)]">DuecIt</span>
    </Link>
  );
}