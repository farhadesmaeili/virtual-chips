'use client';

import { useSession } from 'next-auth/react';
import { Chip } from './chip';
import { Lobby } from './lobby';
import { LoginForm } from './login-form';

export function HomeScreen(): React.ReactElement {
  const { status } = useSession();

  return (
    <main className="relative z-10 flex min-h-[100dvh] items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Brand lockup — the chip is the signature mark. */}
        <div className="mb-7 flex flex-col items-center text-center">
          <Chip size={64} color="var(--vc-chip-25)" className="mb-4" />
          <h1 className="font-display text-3xl font-bold tracking-tightish text-vc-ink">
            Virtual Chips
          </h1>
          <p className="mt-1.5 text-sm text-vc-ink-muted">
            Bring the table to the group chat.
          </p>
        </div>

        <div className="vc-tray p-6 sm:p-7">
          {status === 'loading' ? (
            <p className="py-6 text-center text-vc-ink-muted">
              Setting the table…
            </p>
          ) : status === 'authenticated' ? (
            <Lobby />
          ) : (
            <LoginForm />
          )}
        </div>

        <p className="mt-5 text-center text-xs text-vc-ink-faint">
          Virtual betting only — bring your own game.
        </p>
      </div>
    </main>
  );
}
