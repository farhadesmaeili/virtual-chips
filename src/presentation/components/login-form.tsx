'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

const fieldClass =
  'rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-vc-ink placeholder:text-vc-ink-faint outline-none transition focus:border-vc-emerald/60 focus:bg-black/30';

export function LoginForm(): React.ReactElement {
  const reduce = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    setSubmitting(false);
    // Generic message — never reveal which field was wrong (no enumeration).
    if (result?.error !== undefined && result.error !== null) {
      setError('Those credentials did not match. Try again.');
    }
  }

  return (
    <motion.form
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onSubmit={(e) => void onSubmit(e)}
      className="flex w-full flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-xs font-medium uppercase tracking-[0.08em] text-vc-ink-muted"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="alice@example.com"
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-xs font-medium uppercase tracking-[0.08em] text-vc-ink-muted"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className={`${fieldClass} font-mono`}
        />
      </div>

      {error !== null && (
        <p className="rounded-xl border border-vc-danger/30 bg-vc-danger/10 px-4 py-2.5 text-sm text-vc-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 rounded-xl bg-vc-emerald px-4 py-3 font-semibold text-vc-felt-edge shadow-[0_8px_20px_-6px_rgb(52_211_153/0.5)] transition hover:bg-vc-emerald/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Sitting down…' : 'Sit down'}
      </button>

      <p className="text-center text-xs text-vc-ink-faint">
        Dev table: <span className="font-mono text-vc-ink-muted">alice</span> ·{' '}
        <span className="font-mono text-vc-ink-muted">password123</span>
      </p>
    </motion.form>
  );
}
