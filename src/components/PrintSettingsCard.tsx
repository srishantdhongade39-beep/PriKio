import { useState, useCallback } from "react";
import AppHeader from "./AppHeader";

// ── pricing ──────────────────────────────────────────────────────────────────
const PRICE = { bw: 1, color: 3, serviceFee: 2 };

interface PrintSettingsCardProps {
  files?: Array<{
    id: string;
    fileName: string;
    pageCount: number;
    fileSizeMb: string;
  }>;
  onConfirm?: (settings: any) => void;
  onPreviewClick?: (fileId: string) => void;
  onBack?: () => void;
}

export default function PrintSettingsCard({
  files = [],
  onConfirm  = () => {},
  onPreviewClick = () => {},
  onBack,
}: PrintSettingsCardProps) {
  const [colorMode,    setColorMode]    = useState("bw");      // "bw" | "color"
  const [layout,       setLayout]       = useState("simplex"); // "simplex" | "duplex"
  const [orientation,  setOrientation]  = useState("portrait");// "portrait" | "landscape"
  const [copies,       setCopies]       = useState(1);

  // ── cost calculation ──────────────────────────────────────────────────────
  const parsePagesToPrint = (pagesStr: string, totalPages: number) => {
    if (!pagesStr || pagesStr.toLowerCase().trim() === 'all') return totalPages;
    try {
      const parts = pagesStr.split(',');
      let count = 0;
      for (const part of parts) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(s => parseInt(s.trim()));
          if (!isNaN(start) && !isNaN(end) && end >= start) {
            count += (end - start + 1);
          }
        } else {
          const num = parseInt(part.trim());
          if (!isNaN(num)) count += 1;
        }
      }
      // Ensure we don't return more pages than the document actually has!
      const finalCount = count > 0 ? count : totalPages;
      return Math.min(finalCount, totalPages);
    } catch {
      return totalPages;
    }
  };

  const totalFilePages = files.reduce((acc, f) => {
    // files might have pagesToPrint from Step 1, or default to "All"
    const pagesToPrint = (f as any).pagesToPrint || "All";
    return acc + parsePagesToPrint(pagesToPrint, f.pageCount);
  }, 0);

  const pagesPerSheet  = layout === "duplex" ? 2 : 1;
  const sheetsNeeded   = Math.ceil(totalFilePages / pagesPerSheet);
  const pricePerSheet  = colorMode === "bw" ? PRICE.bw : PRICE.color;
  const printCost      = sheetsNeeded * copies * pricePerSheet;
  const totalCost      = printCost + PRICE.serviceFee;
  const sheetLabel     = `${sheetsNeeded * copies} Sheet${sheetsNeeded * copies !== 1 ? "s" : ""}${layout === "duplex" ? " (Double Sided)" : ""}`;

  const handleConfirm = useCallback(() => {
    onConfirm({ colorMode, layout, copies, orientation, totalCost, sheetCount: sheetsNeeded * copies });
  }, [colorMode, layout, copies, orientation, totalCost, sheetsNeeded]);

  return (
    <>
      <style>{`
        /* ── scoped to .ps-card ── */
        .ps-card * { box-sizing: border-box; }

        /* colour-mode visual cards */
        .cm-card {
          flex: 1;
          border: 2px solid #e8eaef;
          border-radius: 14px;
          padding: 14px 12px 10px;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          position: relative;
          background: white;
          min-width: 0;
        }
        .cm-card.active {
          border-color: #4a5fc1;
          background: #f5f6ff;
          box-shadow: 0 0 0 3px rgba(74,95,193,0.12);
        }
        .cm-card:hover:not(.active) { border-color: #bbbfdf; }

        /* pill toggles (layout / orientation) */
        .pill-toggle {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .pill-btn {
          flex: 1;
          min-width: 110px;
          padding: 11px 14px;
          border-radius: 50px;
          border: 2px solid #e8eaef;
          background: white;
          font-size: 0.88rem;
          font-weight: 500;
          color: #555;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          transition: border-color 0.2s, background 0.2s, color 0.2s;
          font-family: inherit;
        }
        .pill-btn.active {
          border-color: #4a5fc1;
          background: #f5f6ff;
          color: #1a2340;
          font-weight: 600;
        }
        .pill-btn:hover:not(.active) { border-color: #bbbfdf; }

        /* stepper */
        .stepper {
          display: flex;
          align-items: center;
          gap: 0;
          background: #1a2340;
          border-radius: 50px;
          overflow: hidden;
        }
        .stepper-btn {
          width: 36px;
          height: 36px;
          background: none;
          border: none;
          color: white;
          font-size: 1.2rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }
        .stepper-btn:hover { background: rgba(255,255,255,0.12); }
        .stepper-val {
          min-width: 32px;
          text-align: center;
          color: white;
          font-size: 0.95rem;
          font-weight: 600;
          font-family: inherit;
        }

        /* preview banner */
        .preview-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #eef9f1;
          border: 1px solid #c3e8ce;
          border-radius: 10px;
          padding: 10px 14px;
          cursor: pointer;
          transition: background 0.15s;
          margin-bottom: 4px;
        }
        .preview-banner:hover { background: #ddf3e4; }

        /* confirm button */
        .confirm-btn {
          width: 100%;
          padding: 15px;
          background: #1a2340;
          color: white;
          border: none;
          border-radius: 50px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-family: inherit;
          letter-spacing: 0.02em;
          transition: opacity 0.2s, transform 0.15s;
        }
        .confirm-btn:hover  { opacity: 0.88; transform: scale(1.01); }
        .confirm-btn:active { transform: scale(0.98); }
        .confirm-badge {
          background: rgba(255,255,255,0.18);
          border-radius: 20px;
          padding: 3px 12px;
          font-size: 0.88rem;
          font-weight: 700;
        }

        /* section label */
        .sec-label {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #aaa;
          text-transform: uppercase;
          margin: 0 0 10px;
        }

        @media (max-width: 768px) {
          .ps-card { border-radius: 0 !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="ps-card" style={{
        background: "white",
        width: "100%",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, system-ui, sans-serif",
      }}>

        {/* ── Header ── */}
        <AppHeader title="CampusPrint" subtitle="Print Anywhere on Campus" onBack={onBack || (() => window.history.back())} />

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ width: "100%", maxWidth: "440px", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0 0", textAlign: "center", fontSize: "1.4rem", fontWeight: 700, color: "#1a2340", fontFamily: "'Quicksand', sans-serif" }}>Print Settings</h2>

          {/* ── Selected files ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
              <p className="sec-label" style={{ margin: 0 }}>Selected Files</p>
              <span style={{ fontSize: '0.72rem', color: '#1a6b3a', fontWeight: 600 }}>Please preview before printing</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {files.map(file => (
                <div key={file.id} style={{ background: "#f8f9ff", borderRadius: "12px", padding: "12px 14px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "36px", height: "36px", background: "#e8eaf6", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a5fc1" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 600, color: "#1a2340", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.fileName}</p>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#aaa", marginTop: "2px" }}>
                      {(file as any).pagesToPrint && (file as any).pagesToPrint !== "All"
                        ? `${parsePagesToPrint((file as any).pagesToPrint, file.pageCount)} Selected (${file.pageCount} Total Pages)`
                        : `${file.pageCount} Pages`} · {parseFloat(file.fileSizeMb || '0').toFixed(2)} MB
                    </p>
                  </div>
                  {/* eye icon — preview */}
                  <button 
                    onClick={() => onPreviewClick(file.id)} 
                    style={{ 
                      background: "rgba(26,35,64,0.05)", 
                      border: "1px solid rgba(26,35,64,0.1)", 
                      borderRadius: "8px",
                      cursor: "pointer", 
                      color: "#1a2340", 
                      padding: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(26,35,64,0.1)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "rgba(26,35,64,0.05)"}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div>
              ))}
            </div>
            <p style={{ fontSize: "0.72rem", color: "#bbb", margin: "8px 0 0 2px" }}>
              Accepted formats: PDF, DOCX, JPG, PNG. Max 100MB per file.
            </p>
          </div>

          {/* ── Color Mode ── */}
          <div>
            <p className="sec-label">Color Mode</p>
            <div style={{ display: "flex", gap: "10px" }}>

              {/* B&W card */}
              <div className={`cm-card ${colorMode === "bw" ? "active" : ""}`} onClick={() => setColorMode("bw")}>
                {/* selection dot */}
                <div style={{ position: "absolute", top: "10px", right: "10px", width: "18px", height: "18px", borderRadius: "50%", border: `2px solid ${colorMode === "bw" ? "#4a5fc1" : "#ddd"}`, background: colorMode === "bw" ? "#4a5fc1" : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {colorMode === "bw" && <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="2,5 4,7 8,3" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                {/* Ink blob illustration – B&W */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px", height: "52px", alignItems: "flex-end" }}>
                  <svg width="60" height="52" viewBox="0 0 60 52">
                    <ellipse cx="30" cy="38" rx="22" ry="10" fill="#e0e0e0"/>
                    <ellipse cx="22" cy="30" rx="14" ry="14" fill="#9e9e9e"/>
                    <ellipse cx="36" cy="28" rx="12" ry="12" fill="#424242"/>
                    <ellipse cx="28" cy="22" rx="10" ry="10" fill="#212121"/>
                  </svg>
                </div>
                <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: "#1a2340" }}>B/W</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#888" }}>₹{PRICE.bw}/page</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.68rem", color: "#4a5fc1", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Economy</p>
              </div>

              {/* Color card */}
              <div className={`cm-card ${colorMode === "color" ? "active" : ""}`} onClick={() => setColorMode("color")}>
                <div style={{ position: "absolute", top: "10px", right: "10px", width: "18px", height: "18px", borderRadius: "50%", border: `2px solid ${colorMode === "color" ? "#4a5fc1" : "#ddd"}`, background: colorMode === "color" ? "#4a5fc1" : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {colorMode === "color" && <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="2,5 4,7 8,3" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                {/* Ink blob illustration – Color */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px", height: "52px", alignItems: "flex-end" }}>
                  <svg width="60" height="52" viewBox="0 0 60 52">
                    <ellipse cx="30" cy="40" rx="22" ry="8" fill="#e8d5f0" opacity="0.5"/>
                    <ellipse cx="20" cy="30" rx="14" ry="14" fill="#3b82f6" opacity="0.85"/>
                    <ellipse cx="38" cy="30" rx="14" ry="14" fill="#f59e0b" opacity="0.85"/>
                    <ellipse cx="29" cy="22" rx="14" ry="14" fill="#ec4899" opacity="0.75"/>
                    <ellipse cx="29" cy="28" rx="8" ry="8" fill="#7c3aed" opacity="0.5"/>
                  </svg>
                </div>
                <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: "#1a2340" }}>Color</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#888" }}>₹{PRICE.color}/page</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.68rem", color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Standard</p>
              </div>
            </div>
          </div>

          {/* ── Layout (Duplex) ── */}
          <div>
            <p className="sec-label">Duplex</p>
            <div className="pill-toggle">
              <button className={`pill-btn ${layout === "simplex" ? "active" : ""}`} onClick={() => setLayout("simplex")}>
                <span>Single-sided</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>
              </button>
              <button className={`pill-btn ${layout === "duplex" ? "active" : ""}`} onClick={() => setLayout("duplex")}>
                <span>Double-sided</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="14" height="18" rx="2"/><rect x="8" y="5" width="14" height="18" rx="2" opacity="0.4"/></svg>
              </button>
            </div>
          </div>

          {/* ── Orientation ── */}
          <div>
            <p className="sec-label">Orientation</p>
            <div className="pill-toggle">
              <button className={`pill-btn ${orientation === "portrait" ? "active" : ""}`} onClick={() => setOrientation("portrait")}>
                <span>Portrait</span>
                <svg width="16" height="18" viewBox="0 0 16 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="1" width="14" height="18" rx="2"/></svg>
              </button>
              <button className={`pill-btn ${orientation === "landscape" ? "active" : ""}`} onClick={() => setOrientation("landscape")}>
                <span>Landscape</span>
                <svg width="18" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="1" width="18" height="14" rx="2"/></svg>
              </button>
            </div>
          </div>

          {/* ── Number of Copies ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p className="sec-label" style={{ margin: 0 }}>Number of Copies</p>
              <p style={{ margin: "4px 0 0", fontSize: "0.88rem", color: "#888" }}>
                {copies} {copies === 1 ? 'copy' : 'copies'} × {sheetsNeeded} {sheetsNeeded === 1 ? 'sheet' : 'sheets'}
              </p>
            </div>
            <div className="stepper">
              <button className="stepper-btn" onClick={() => setCopies(c => Math.max(1, c - 1))}>−</button>
              <span className="stepper-val">{copies}</span>
              <button className="stepper-btn" onClick={() => setCopies(c => Math.min(99, c + 1))}>+</button>
            </div>
          </div>

          </div>

          {/* ── Cost summary + CTA ── */}
          <div style={{ width: "100%", maxWidth: "440px", padding: "0 1.5rem 1.5rem", marginTop: "auto" }}>
            <div style={{ paddingTop: "1.25rem", borderTop: "1px solid #f0f1f7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", fontSize: "0.95rem", color: "#555" }}>
                <span>{sheetsNeeded * copies} Sheet{sheetsNeeded * copies !== 1 ? 's' : ''}</span>
                <span>₹ {printCost.toFixed(2)}</span>
              </div>

              <button className="confirm-btn" onClick={handleConfirm}>
                <span>Confirm & Pay</span>
                <span className="confirm-badge">₹ {totalCost.toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
