'use client';

import { useEffect, useState, ReactNode } from 'react';

interface AntiCaptureProps {
  children: ReactNode;
  username: string;
  matchId: string;
}

export default function AntiCapture({ children, username, matchId }: AntiCaptureProps) {
  const [blurred, setBlurred] = useState(false);
  const [warning, setWarning] = useState('');

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        setBlurred(true);
        setWarning('Tab switch detected — problem hidden');
      }
    };

    const onBlur = () => setBlurred(true);

    const onKeyDown = (e: KeyboardEvent) => {
      // PrintScreen, Cmd+Shift+3/4/5 (mac screenshots)
      if (
        e.key === 'PrintScreen' ||
        (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key))
      ) {
        e.preventDefault();
        setBlurred(true);
        setWarning('Screenshot attempt detected');
        setTimeout(() => setWarning(''), 3000);
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('contextmenu', onContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  useEffect(() => {
    if (!blurred) return;
    const t = setTimeout(() => {
      if (!document.hidden) setBlurred(false);
    }, 1500);
    return () => clearTimeout(t);
  }, [blurred]);

  const watermark = `${username} · ${matchId.slice(-8)}`;

  return (
    <div className="relative h-full">
      {warning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 text-red-200 px-4 py-2 rounded-lg text-sm border border-red-700">
          {warning}
        </div>
      )}
      <div
        className={`h-full transition-all duration-300 ${blurred ? 'blur-xl brightness-50 pointer-events-none' : ''}`}
        style={{ WebkitUserSelect: 'none', userSelect: 'none' } as React.CSSProperties}
      >
        {children}
      </div>
      {/* Persistent watermark overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-40 overflow-hidden opacity-[0.04]"
        aria-hidden
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute text-sm font-mono whitespace-nowrap text-white rotate-[-30deg]"
            style={{ top: `${(i % 5) * 20}%`, left: `${(i % 4) * 25}%` }}
          >
            {watermark}
          </div>
        ))}
      </div>
    </div>
  );
}
