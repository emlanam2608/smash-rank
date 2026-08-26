'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { SessionProvider } from '@/context/SessionContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SessionProvider>
        <ServiceWorkerRegister />
        {children}
      </SessionProvider>
    </AuthProvider>
  );
}
