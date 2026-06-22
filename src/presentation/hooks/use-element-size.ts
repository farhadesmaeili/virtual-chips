'use client';

import { useEffect, useRef, useState } from 'react';

export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * Tracks an element's pixel size via `ResizeObserver`, `null` until first
 * measured. Used to convert percentage endpoints into pixel transforms so chips
 * travel via `transform` (no layout props) and stay correct across resizes.
 */
export function useElementSize<T extends HTMLElement>(): [
  React.RefObject<T>,
  Size | null,
] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const measure = (): void =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}
