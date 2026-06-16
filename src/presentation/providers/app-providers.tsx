'use client';

import { SessionProvider, useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { getSocket } from '@/presentation/lib/socket';
import type { SessionReady } from '@/presentation/lib/socket-events';
import { useConnectionStore } from '@/presentation/stores/connection-store';

/** Connects the shared socket once the user is authenticated and mirrors the
 * connection state into the store. Renders nothing. */
function SocketManager(): null {
  const { status } = useSession();
  const setStatus = useConnectionStore((s) => s.setStatus);
  const setUser = useConnectionStore((s) => s.setUser);
  const reset = useConnectionStore((s) => s.reset);

  useEffect(() => {
    const socket = getSocket();

    if (status !== 'authenticated') {
      reset();
      socket.disconnect();
      return;
    }

    const onReady = (payload: SessionReady): void => {
      setStatus('connected');
      setUser(payload.user);
    };
    const onDisconnect = (): void => setStatus('disconnected');

    socket.on('session:ready', onReady);
    socket.on('disconnect', onDisconnect);
    setStatus('connecting');
    socket.connect();

    return () => {
      socket.off('session:ready', onReady);
      socket.off('disconnect', onDisconnect);
    };
  }, [status, setStatus, setUser, reset]);

  return null;
}

export function AppProviders({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <SessionProvider>
      <SocketManager />
      {children}
    </SessionProvider>
  );
}
