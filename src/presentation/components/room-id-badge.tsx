'use client';

import { useCallback, useState } from 'react';
import { shortenId } from '@/presentation/lib/short-id';

/**
 * Writes text to the clipboard, falling back to a hidden-textarea + execCommand
 * when the async Clipboard API is unavailable (older browsers, or non-secure
 * contexts). Returns whether the copy is believed to have succeeded; never
 * throws, so a blocked clipboard cannot crash the view.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard?.writeText !== undefined
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path below.
  }
  try {
    if (typeof document === 'undefined') return false;
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/**
 * The table code in the room header (task 4.17): shows a shortened id with a
 * copy button that puts the FULL id on the clipboard. Presentation only — the
 * real id value is untouched; only its rendered text is truncated.
 */
export function RoomIdBadge({
  roomId,
}: {
  readonly roomId: string;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback((): void => {
    void (async () => {
      const ok = await copyText(roomId);
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    })();
  }, [roomId]);

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copy table code ${roomId}`}
      title="Copy table code"
      className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs text-vc-ink-faint transition hover:bg-white/[0.04] hover:text-vc-ink-muted active:scale-[0.98]"
    >
      <span>{shortenId(roomId)}</span>
      {copied ? (
        // Check — copied.
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="text-vc-emerald transition-opacity"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        // Two overlapping cards — the universal copy glyph.
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="opacity-70 transition-opacity group-hover:opacity-100"
        >
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
      {/* Announce the result to assistive tech without a visual layout shift. */}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Table code copied' : ''}
      </span>
    </button>
  );
}
