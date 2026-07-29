'use client';

import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';

export default function ProgressBarProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ProgressBar
        height="3px"
        color="var(--accent, #3b82f6)" // Fallback to a nice blue if var(--accent) is missing
        options={{ showSpinner: false }}
        shallowRouting
      />
    </>
  );
}
