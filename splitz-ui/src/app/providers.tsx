'use client';

import { ReactNode } from 'react';
import { SplitProvider } from '@/context/SplitContext';

export default function Providers({ children }: { children: ReactNode }) {
  return <SplitProvider>{children}</SplitProvider>;
}
