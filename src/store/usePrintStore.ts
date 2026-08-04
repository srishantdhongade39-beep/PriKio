import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useEffect, useState } from 'react'

export const PRINT_SESSION_TTL_MS = 5 * 60 * 1000 // 5 minutes TTL

export interface PrintFile {
  id: string;
  url: string;
  fileName: string;
  fileSizeMb: string;
  pageCount: number;
  pagesToPrint: string;
  originalFile?: File | Blob;
  job_id?: string;
  otp?: string;
  storagePath?: string;
  isConverting?: boolean;
  conversionError?: string;
}

interface PrintState {
  files: PrintFile[];
  globalJobId?: string;
  globalOtp?: string;
  printSettings?: any;
  lastUpdated?: number;
  _hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  setFiles: (files: PrintFile[]) => void;
  updateFile: (id: string, updates: Partial<PrintFile>) => void;
  setJobData: (jobId: string, otp: string) => void;
  setPrintSettings: (settings: any) => void;
  updatePageRange: (id: string, range: string) => void;
  touchSession: () => void;
  clearFiles: () => void;
}

export const usePrintStore = create<PrintState>()(
  persist(
    (set, get) => ({
      files: [],
      globalJobId: undefined,
      globalOtp: undefined,
      printSettings: undefined,
      lastUpdated: undefined,
      _hasHydrated: false,
      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
      setFiles: (files) => set({ files, lastUpdated: Date.now() }),
      updateFile: (id, updates) => set((state) => ({
        files: state.files.map(f => f.id === id ? { ...f, ...updates } : f),
        lastUpdated: Date.now()
      })),
      setJobData: (jobId, otp) => set({ globalJobId: jobId, globalOtp: otp, lastUpdated: Date.now() }),
      setPrintSettings: (printSettings) => set({ printSettings, lastUpdated: Date.now() }),
      updatePageRange: (id, range) => set((state) => ({
        files: state.files.map(f => f.id === id ? { ...f, pagesToPrint: range } : f),
        lastUpdated: Date.now()
      })),
      touchSession: () => set({ lastUpdated: Date.now() }),
      clearFiles: () => set({ 
        files: [], 
        globalJobId: undefined, 
        globalOtp: undefined, 
        printSettings: undefined,
        lastUpdated: undefined 
      })
    }),
    {
      name: 'campusprint-print-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        files: state.files.map(({ originalFile, ...rest }) => rest),
        globalJobId: state.globalJobId,
        globalOtp: state.globalOtp,
        printSettings: state.printSettings,
        lastUpdated: state.lastUpdated
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Check 5-minute TTL expiration on rehydration
        if (state.lastUpdated && Date.now() - state.lastUpdated > PRINT_SESSION_TTL_MS) {
          state.clearFiles();
        } else if (state.files.length > 0) {
          // Touch timestamp if session is still active
          state.touchSession();
        }
        state.setHasHydrated(true);
      }
    }
  )
)

/**
 * Hook to safely wait for usePrintStore hydration on client before evaluating guards
 */
export function useHydratedPrintStore() {
  const [hydrated, setHydrated] = useState(false)
  const storeHydrated = usePrintStore((state) => state._hasHydrated)

  useEffect(() => {
    if (storeHydrated || usePrintStore.persist?.hasHydrated?.()) {
      setHydrated(true)
    } else {
      const unsub = usePrintStore.persist?.onFinishHydration?.(() => {
        setHydrated(true)
      })
      return () => unsub?.()
    }
  }, [storeHydrated])

  return hydrated
}
