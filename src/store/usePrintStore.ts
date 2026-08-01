import { create } from 'zustand'

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
  setFiles: (files: PrintFile[]) => void;
  updateFile: (id: string, updates: Partial<PrintFile>) => void;
  setJobData: (jobId: string, otp: string) => void;
  updatePageRange: (id: string, range: string) => void;
  clearFiles: () => void;
}

export const usePrintStore = create<PrintState>((set) => ({
  files: [],
  setFiles: (files) => set({ files }),
  updateFile: (id, updates) => set((state) => ({
    files: state.files.map(f => f.id === id ? { ...f, ...updates } : f)
  })),
  setJobData: (jobId, otp) => set({ globalJobId: jobId, globalOtp: otp }),
  updatePageRange: (id, range) => set((state) => ({
    files: state.files.map(f => f.id === id ? { ...f, pagesToPrint: range } : f)
  })),
  clearFiles: () => set({ files: [], globalJobId: undefined, globalOtp: undefined })
}))
