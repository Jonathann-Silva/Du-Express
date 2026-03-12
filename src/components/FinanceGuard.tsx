'use client';

import React from 'react';

/**
 * FinanceGuard anteriormente protegia as páginas financeiras com uma senha mestra.
 * A proteção por senha foi removida para facilitar o acesso direto aos dados financeiros.
 */
export function FinanceGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
