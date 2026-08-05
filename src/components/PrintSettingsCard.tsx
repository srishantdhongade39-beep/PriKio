'use client'

import { useState, useCallback, useRef, useEffect } from "react";
import AppHeader from "./AppHeader";
import { usePrintStore, PrintFile } from "@/store/usePrintStore";
import Lenis from "lenis";

// ── pricing ──────────────────────────────────────────────────────────────────
const PRICE = { bw: 1, color: 3, serviceFee: 2 };

interface PrintSettingsCardProps {
  files?: PrintFile[];
  onConfirm?: (settings: any) => void;
  onPreviewClick?: (fileId: string) => void;
  onBack?: () => void;
}

export default function PrintSettingsCard({
  files = [],
  onConfirm = () => {},
  onPreviewClick = () => {},
  onBack,
}: PrintSettingsCardProps) {
  const storeFiles = usePrintStore((state) => state.files);
  const updateFileSettings = usePrintStore((state) => state.updateFileSettings);
  const applySettingsToAll = usePrintStore((state) => state.applySettingsToAll);

  // Active files to use (prefer live store files if available)
  const activeFiles = storeFiles.length > 0 ? storeFiles : files;

  const [selectedFileId, setSelectedFileId] = useState<string>(() => {
    return activeFiles[0]?.id || "";
  });

  const scrollWrapperRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // Initialize Lenis smooth scroll on the main PrintSettingsCard scrollable body
  useEffect(() => {
    const wrapper = scrollWrapperRef.current;
    const content = scrollContentRef.current;
    if (!wrapper) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      wrapper,
      content: content || undefined,
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.4,
    });

    lenisRef.current = lenis;

    let rafId: number;
    const onRaf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(onRaf);
    };
    rafId = requestAnimationFrame(onRaf);

    const resizeObserver = new ResizeObserver(() => {
      lenis.resize();
    });

    if (content) resizeObserver.observe(content);
    resizeObserver.observe(wrapper);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  const activeFile = activeFiles.find((f) => f.id === selectedFileId) || activeFiles[0] || ({} as PrintFile);

  const activeColorMode   = activeFile?.colorMode || "bw";
  const activeLayout      = activeFile?.layout || "duplex";
  const activeOrientation = activeFile?.orientation || "portrait";
  const activeCopies      = activeFile?.copies || 1;

  // ── cost calculation helpers ──────────────────────────────────────────────
  const parsePagesToPrint = (pagesStr?: string, totalPages: number = 1) => {
    if (!pagesStr || pagesStr.toLowerCase().trim() === "all") return totalPages;
    try {
      const parts = pagesStr.split(",");
      let count = 0;
      for (const part of parts) {
        if (part.includes("-")) {
          const [start, end] = part.split("-").map((s) => parseInt(s.trim()));
          if (!isNaN(start) && !isNaN(end) && end >= start) {
            count += end - start + 1;
          }
        } else {
          const num = parseInt(part.trim());
          if (!isNaN(num)) count += 1;
        }
      }
      const finalCount = count > 0 ? count : totalPages;
      return Math.min(finalCount, totalPages);
    } catch {
      return totalPages;
    }
  };

  const getFileMetrics = (f: PrintFile) => {
    const pages = parsePagesToPrint(f.pagesToPrint, f.pageCount || 1);
    const pagesPerSheet = f.layout === "simplex" ? 1 : 2;
    const sheetsPerCopy = Math.ceil(pages / pagesPerSheet);
    const copies = f.copies || 1;
    const totalSheets = sheetsPerCopy * copies;
    const pricePerSheet = f.colorMode === "color" ? PRICE.color : PRICE.bw;
    const cost = totalSheets * pricePerSheet;
    return { pages, sheetsPerCopy, totalSheets, pricePerSheet, cost };
  };

  const totalFilePages = activeFiles.reduce((acc, f) => acc + getFileMetrics(f).pages, 0);
  const totalSheets    = activeFiles.reduce((acc, f) => acc + getFileMetrics(f).totalSheets, 0);
  const printCost      = activeFiles.reduce((acc, f) => acc + getFileMetrics(f).cost, 0);
  const totalCost      = printCost + PRICE.serviceFee;

  const handleUpdateActiveFile = (updates: Partial<Pick<PrintFile, 'colorMode' | 'layout' | 'orientation' | 'copies'>>) => {
    if (!activeFile?.id) return;
    updateFileSettings(activeFile.id, updates);
  };

  const handleApplyToAll = () => {
    applySettingsToAll({
      colorMode: activeColorMode,
      layout: activeLayout,
      orientation: activeOrientation,
      copies: activeCopies,
    });
  };

  const handleConfirm = useCallback(() => {
    onConfirm({
      files: activeFiles.map((f) => ({
        ...f,
        ...getFileMetrics(f),
      })),
      totalCost,
      printCost,
      serviceFee: PRICE.serviceFee,
      sheetCount: totalSheets,
      totalFilePages,
      // fallback legacy properties
      colorMode: activeColorMode,
      layout: activeLayout,
      orientation: activeOrientation,
      copies: activeCopies,
    });
  }, [activeFiles, totalCost, printCost, totalSheets, totalFilePages, activeColorMode, activeLayout, activeOrientation, activeCopies, onConfirm]);

  return (
    <>
      <style>{`
        /* ── scoped to .ps-card ── */
        .ps-card * { box-sizing: border-box; }

        /* colour-mode visual cards */
        .cm-card {
          flex: 1;
          border: 1.8px solid #e8eaef;
          border-radius: 16px;
          padding: 14px 14px 12px;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s, transform 0.15s;
          position: relative;
          background: white;
          min-width: 0;
        }
        .cm-card.active {
          border-color: #4a5fc1;
          background: #f5f6ff;
          box-shadow: 0 0 0 3px rgba(74,95,193,0.14);
        }
        .cm-card:hover:not(.active) { border-color: #bbbfdf; transform: translateY(-1px); }

        /* pill toggles (layout / orientation) */
        .pill-toggle {
          display: flex;
          gap: 12px;
        }
        .pill-btn {
          flex: 1;
          min-width: 120px;
          padding: 11px 16px;
          border-radius: 50px;
          border: 1.8px solid #e8eaef;
          background: white;
          font-size: 0.90rem;
          font-weight: 500;
          color: #555;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          transition: border-color 0.2s, background 0.2s, color 0.2s, transform 0.15s;
          font-family: inherit;
        }
        .pill-btn.active {
          border-color: #4a5fc1;
          background: #f5f6ff;
          color: #1a2340;
          font-weight: 600;
        }
        .pill-btn:hover:not(.active) { border-color: #bbbfdf; transform: translateY(-1px); }

        /* stepper */
        .stepper-controls {
          display: flex;
          align-items: center;
          background: #1a2340;
          border-radius: 40px;
          padding: 3px;
          gap: 0;
        }
        .stepper-btn {
          width: 32px;
          height: 32px;
          border: none;
          background: transparent;
          font-size: 1.1rem;
          color: #ffffff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
          font-family: inherit;
          border-radius: 50%;
          font-weight: 600;
        }
        .stepper-btn:hover { background: rgba(255,255,255,0.15); }
        .stepper-btn:active { background: rgba(255,255,255,0.25); }
        .stepper-val {
          min-width: 32px;
          text-align: center;
          font-size: 0.94rem;
          font-weight: 800;
          color: #ffffff;
        }

        /* confirm & pay button */
        .confirm-btn {
          width: 100%;
          padding: 13px 20px;
          border-radius: 50px;
          border: none;
          background: #1a2340;
          color: white;
          font-size: 0.98rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 4px 18px rgba(26,35,64,0.22);
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          font-family: inherit;
        }
        .confirm-btn:hover {
          background: #253360;
          transform: translateY(-1px);
          box-shadow: 0 6px 22px rgba(26,35,64,0.30);
        }
        .confirm-btn:active { transform: translateY(0); }
        .confirm-badge {
          background: white;
          color: #1a2340;
          border-radius: 20px;
          padding: 3px 12px;
          font-size: 0.88rem;
          font-weight: 700;
        }

        .sec-label {
          font-size: 0.76rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748b;
          margin: 0 0 8px;
        }

        /* Selected Files List */
        .selected-files-box {
          border: 1.5px solid #e2e8f0;
          border-radius: 16px;
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          padding: 8px;
          max-height: 220px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          -webkit-overflow-scrolling: touch;
          box-shadow: inset 0 2px 4px rgba(15, 23, 42, 0.02);
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.4) transparent;
        }

        .selected-files-box::-webkit-scrollbar {
          width: 5px;
        }
        .selected-files-box::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.4);
          border-radius: 10px;
        }

        .selected-file-item {
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 9px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.02);
        }
        .selected-file-item:hover {
          border-color: #cbd5e1;
          background: #ffffff;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
        }
        .selected-file-item.active-file {
          border-color: #4a5fc1;
          background: #fbfcff;
          box-shadow: 0 0 0 3px rgba(74, 95, 193, 0.12);
        }

        .preview-pill-btn {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #334155;
          border-radius: 8px;
          padding: 5px 9px;
          font-size: 0.74rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .preview-pill-btn:hover {
          background: #1a2340;
          color: #ffffff;
          border-color: #0f172a;
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.18);
        }

        .apply-all-btn {
          background: #ffffff;
          border: 1px solid #c7d2fe;
          color: #4a5fc1;
          border-radius: 8px;
          padding: 4px 9px;
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.15s;
        }
        .apply-all-btn:hover {
          background: #eef2ff;
          border-color: #a5b4fc;
        }

        @media (max-width: 768px) {
          .ps-card { border-radius: 0 !important; box-shadow: none !important; }
          .cm-card { padding: 10px 10px 8px; border-radius: 12px; }
          .cm-card-icon { height: 32px !important; margin-bottom: 4px !important; }
          .pill-btn { padding: 8px 12px; font-size: 0.85rem; }
          .pill-toggle { gap: 8px; }
          .selected-files-box { max-height: 160px; }
          .sec-label { margin: 0 0 5px !important; font-size: 0.70rem; }
          .stepper-btn { width: 28px; height: 28px; font-size: 1rem; }
          .stepper-val { min-width: 28px; font-size: 0.88rem; }
          .stepper-controls { padding: 2px; }
        }
      `}</style>

      <div className="ps-card" style={{
        background: "white",
        width: "100%",
        height: "100%",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, system-ui, sans-serif",
      }}>

        {/* ── Header ── */}
        <AppHeader title="CampusPrint" subtitle="Print Anywhere on Campus" onBack={onBack || (() => window.history.back())} />

        {/* ── Scrollable Body with Lenis ── */}
        <div 
          ref={scrollWrapperRef}
          style={{ 
            flex: 1, 
            minHeight: 0, 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center", 
            overflowY: "auto", 
            padding: "clamp(8px, 2vw, 12px) 0 0", 
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(74, 95, 193, 0.25) transparent"
          }}
        >
          <div 
            ref={scrollContentRef}
            style={{ 
              width: "100%", 
              maxWidth: "calc(460px + clamp(14px, 4vw, 20px) * 2)", 
              display: "flex", 
              flexDirection: "column", 
              gap: "clamp(20px, 4vh, 36px)",
              padding: "10px clamp(14px, 4vw, 20px) 32px",
              flex: "1 0 auto",
              justifyContent: "flex-start"
            }}
          >
            <h2 style={{ margin: "0", textAlign: "center", fontSize: "clamp(1.1rem, 4vw, 1.35rem)", fontWeight: 700, color: "#1a2340", fontFamily: "'Quicksand', sans-serif" }}>
              Print Settings
            </h2>

            {/* ── Selected files ── */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p className="sec-label" style={{ margin: 0 }}>Selected Files</p>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'linear-gradient(135deg, #4a5fc1 0%, #3747a6 100%)', color: '#ffffff', padding: '2px 8px', borderRadius: '12px', boxShadow: '0 2px 6px rgba(74, 95, 193, 0.25)' }}>{activeFiles.length}</span>
                </div>
                {activeFiles.length > 1 && (
                  <button 
                    type="button"
                    onClick={handleApplyToAll}
                    className="apply-all-btn"
                    title="Apply current file's settings to all uploaded files"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    <span>Apply to all files</span>
                  </button>
                )}
              </div>
              
              {/* Scrollable file list */}
              <div className="selected-files-box">
                {activeFiles.map((file) => {
                  const isSelected = file.id === (activeFile?.id || activeFiles[0]?.id);
                  const metrics = getFileMetrics(file);
                  const hasCustomPages = file.pagesToPrint && file.pagesToPrint !== "All";

                  return (
                    <div 
                      key={file.id} 
                      className={`selected-file-item ${isSelected ? 'active-file' : ''}`}
                      onClick={() => setSelectedFileId(file.id)}
                    >
                      <div style={{ 
                        width: "36px", 
                        height: "36px", 
                        background: isSelected 
                          ? "linear-gradient(135deg, #4a5fc1 0%, #3747a6 100%)"
                          : "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)", 
                        border: "1px solid rgba(74, 95, 193, 0.15)",
                        borderRadius: "10px", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        flexShrink: 0,
                        transition: "background 0.2s"
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isSelected ? "#ffffff" : "#4a5fc1"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginBottom: "2px" }}>
                          <p style={{ margin: 0, fontSize: "0.86rem", fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {file.fileName}
                          </p>
                          {isSelected && (
                            <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#4a5fc1", background: "#eef2ff", padding: "1px 6px", borderRadius: "4px", flexShrink: 0 }}>
                              Configuring
                            </span>
                          )}
                        </div>

                        {/* Settings Tag Pill */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginTop: '2px' }}>
                          <span style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: file.colorMode === 'color' ? '#eef2ff' : '#f1f5f9', 
                            color: file.colorMode === 'color' ? '#4a5fc1' : '#475569', 
                            border: file.colorMode === 'color' ? '1px solid #dbeafe' : '1px solid #e2e8f0',
                            padding: '1.5px 6px', 
                            borderRadius: '4px', 
                            fontWeight: 600, 
                            fontSize: '0.70rem' 
                          }}>
                            {file.colorMode === 'color' ? (
                              <>
                                <svg width="10" height="10" viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
                                  <circle cx="7" cy="11" r="5" fill="#3b82f6" opacity="0.9"/>
                                  <circle cx="13" cy="11" r="5" fill="#f59e0b" opacity="0.9"/>
                                  <circle cx="10" cy="6" r="5" fill="#ec4899" opacity="0.85"/>
                                </svg>
                                <span>Color</span>
                              </>
                            ) : (
                              <>
                                <svg width="10" height="10" viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
                                  <circle cx="8" cy="11" r="5.5" fill="#94a3b8"/>
                                  <circle cx="12" cy="8" r="5.5" fill="#475569"/>
                                </svg>
                                <span>B/W</span>
                              </>
                            )}
                          </span>

                          <span style={{ background: '#f1f5f9', color: '#475569', padding: '1px 5px', borderRadius: '4px', fontWeight: 600, fontSize: '0.70rem' }}>
                            {file.layout === 'duplex' ? 'Double-sided' : 'Single-sided'}
                          </span>

                          {(file.copies || 1) > 1 && (
                            <span style={{ background: '#eef2ff', color: '#4a5fc1', padding: '1px 5px', borderRadius: '4px', fontWeight: 600, fontSize: '0.70rem' }}>
                              {file.copies} copies
                            </span>
                          )}

                          {hasCustomPages ? (
                            <span style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '1px 5px', borderRadius: '4px', fontWeight: 600, fontSize: '0.70rem' }}>
                              {metrics.pages}/{file.pageCount} pgs
                            </span>
                          ) : (
                            <span style={{ fontSize: "0.70rem", color: "#64748b", fontWeight: 500 }}>
                              {file.pageCount} pgs
                            </span>
                          )}

                          <span style={{ fontSize: "0.70rem", color: "#059669", fontWeight: 600, marginLeft: "auto" }}>
                            {metrics.totalSheets} {metrics.totalSheets === 1 ? 'sheet' : 'sheets'} · ₹{metrics.cost.toFixed(0)}
                          </span>
                        </div>
                      </div>

                      {/* Preview Button */}
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreviewClick(file.id);
                        }} 
                        title="Preview & Select Pages"
                        className="preview-pill-btn"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        <span>Pages</span>
                      </button>
                    </div>
                  );
                })}
              </div>
              
              {activeFiles.length > 1 && (
                <p style={{ fontSize: "0.72rem", color: "#64748b", margin: "6px 0 0 2px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4a5fc1", display: "inline-block" }}></span>
                  Tap any file above to customize its individual print settings below.
                </p>
              )}
            </div>



            {/* ── Color Mode ── */}
            <div>
              <p className="sec-label">Color Mode</p>
              <div style={{ display: "flex", gap: "12px" }}>

                {/* B&W card */}
                <div 
                  className={`cm-card ${activeColorMode === "bw" ? "active" : ""}`} 
                  onClick={() => handleUpdateActiveFile({ colorMode: "bw" })}
                >
                  <div style={{ position: "absolute", top: "12px", right: "12px", width: "18px", height: "18px", borderRadius: "50%", border: `2px solid ${activeColorMode === "bw" ? "#4a5fc1" : "#ddd"}`, background: activeColorMode === "bw" ? "#4a5fc1" : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {activeColorMode === "bw" && <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="2,5 4,7 8,3" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div className="cm-card-icon" style={{ display: "flex", justifyContent: "center", marginBottom: "6px", height: "42px", alignItems: "flex-end" }}>
                    <svg width="50" height="42" viewBox="0 0 60 52">
                      <ellipse cx="30" cy="38" rx="22" ry="10" fill="#e0e0e0"/>
                      <ellipse cx="22" cy="30" rx="14" ry="14" fill="#9e9e9e"/>
                      <ellipse cx="36" cy="28" rx="12" ry="12" fill="#424242"/>
                      <ellipse cx="28" cy="22" rx="10" ry="10" fill="#212121"/>
                    </svg>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.90rem", fontWeight: 700, color: "#1a2340" }}>B/W</p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.76rem", color: "#888" }}>₹{PRICE.bw}/page</p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.68rem", color: "#4a5fc1", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Economy</p>
                </div>

                {/* Color card */}
                <div 
                  className={`cm-card ${activeColorMode === "color" ? "active" : ""}`} 
                  onClick={() => handleUpdateActiveFile({ colorMode: "color" })}
                >
                  <div style={{ position: "absolute", top: "12px", right: "12px", width: "18px", height: "18px", borderRadius: "50%", border: `2px solid ${activeColorMode === "color" ? "#4a5fc1" : "#ddd"}`, background: activeColorMode === "color" ? "#4a5fc1" : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {activeColorMode === "color" && <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="2,5 4,7 8,3" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div className="cm-card-icon" style={{ display: "flex", justifyContent: "center", marginBottom: "6px", height: "42px", alignItems: "flex-end" }}>
                    <svg width="50" height="42" viewBox="0 0 60 52">
                      <ellipse cx="30" cy="40" rx="22" ry="8" fill="#e8d5f0" opacity="0.5"/>
                      <ellipse cx="20" cy="30" rx="14" ry="14" fill="#3b82f6" opacity="0.85"/>
                      <ellipse cx="38" cy="30" rx="14" ry="14" fill="#f59e0b" opacity="0.85"/>
                      <ellipse cx="29" cy="22" rx="14" ry="14" fill="#ec4899" opacity="0.75"/>
                      <ellipse cx="29" cy="28" rx="8" ry="8" fill="#7c3aed" opacity="0.5"/>
                    </svg>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.90rem", fontWeight: 700, color: "#1a2340" }}>Color</p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.76rem", color: "#888" }}>₹{PRICE.color}/page</p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.68rem", color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Standard</p>
                </div>
              </div>
            </div>

            {/* ── Layout (Duplex) ── */}
            <div>
              <p className="sec-label">Duplex</p>
              <div className="pill-toggle">
                <button 
                  type="button"
                  className={`pill-btn ${activeLayout === "simplex" ? "active" : ""}`} 
                  onClick={() => handleUpdateActiveFile({ layout: "simplex" })}
                >
                  <span>Single-sided</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>
                </button>
                <button 
                  type="button"
                  className={`pill-btn ${activeLayout === "duplex" ? "active" : ""}`} 
                  onClick={() => handleUpdateActiveFile({ layout: "duplex" })}
                >
                  <span>Double-sided</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="14" height="18" rx="2"/><rect x="8" y="5" width="14" height="18" rx="2" opacity="0.4"/></svg>
                </button>
              </div>
            </div>

            {/* ── Orientation ── */}
            <div>
              <p className="sec-label">Orientation</p>
              <div className="pill-toggle">
                <button 
                  type="button"
                  className={`pill-btn ${activeOrientation === "portrait" ? "active" : ""}`} 
                  onClick={() => handleUpdateActiveFile({ orientation: "portrait" })}
                >
                  <span>Portrait</span>
                  <svg width="16" height="18" viewBox="0 0 16 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="1" width="14" height="18" rx="2"/></svg>
                </button>
                <button 
                  type="button"
                  className={`pill-btn ${activeOrientation === "landscape" ? "active" : ""}`} 
                  onClick={() => handleUpdateActiveFile({ orientation: "landscape" })}
                >
                  <span>Landscape</span>
                  <svg width="18" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="1" width="18" height="14" rx="2"/></svg>
                </button>
              </div>
            </div>

            {/* ── Number of Copies ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p className="sec-label" style={{ margin: 0 }}>Number of Copies</p>
              <div className="stepper-controls">
                <button type="button" className="stepper-btn"
                  onClick={() => handleUpdateActiveFile({ copies: Math.max(1, activeCopies - 1) })}>−</button>
                <span className="stepper-val">{activeCopies}</span>
                <button type="button" className="stepper-btn"
                  onClick={() => handleUpdateActiveFile({ copies: Math.min(99, activeCopies + 1) })}>+</button>
              </div>
            </div>

          </div>
        </div>

        {/* ── Fixed Footer outside Scrollable Area ── */}
        <div style={{ 
          width: "100%", 
          padding: "clamp(12px, 3vw, 16px) clamp(14px, 4vw, 20px) max(clamp(16px, 4vw, 24px), env(safe-area-inset-bottom))", 
          flexShrink: 0, 
          borderTop: "1px solid rgba(0, 0, 0, 0.05)", 
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.04)",
          borderBottomLeftRadius: "16px",
          borderBottomRightRadius: "16px",
          marginTop: "auto"
        }}>
          <div style={{ margin: "0 auto", width: "100%", maxWidth: "calc(460px + clamp(14px, 4vw, 20px) * 2)" }}>
            <button className="confirm-btn" onClick={handleConfirm}>
              <span>Confirm & Pay</span>
              <span className="confirm-badge">₹ {printCost.toFixed(2)}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
