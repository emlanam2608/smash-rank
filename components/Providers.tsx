'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ServiceWorkerRegister />
      {children}
    </AuthProvider>
  );
}
