'use client'

import { useState } from "react";
import AppHeader from "./AppHeader";
import SmoothScrollBox from "./SmoothScrollBox";
import { PrintFile } from "@/store/usePrintStore";

export interface OrderReviewProps {
  files?: Array<PrintFile & { cost?: number; sheets?: number; sheetsPerCopy?: number }>;
  copies?: number;
  colorMode?: "bw" | "color";
  layout?: "simplex" | "duplex";
  orientation?: "portrait" | "landscape";
  printCost?: number;
  serviceFee?: number;
  phone?: string;
  onEdit?: () => void;
  onProceed?: () => void;
}

const PRICE = { bw: 1, color: 3, serviceFee: 2 };

export default function OrderReview({
  files = [],
  copies = 1,
  colorMode = "bw",
  layout = "duplex",
  orientation = "portrait",
  printCost: defaultPrintCost,
  serviceFee = 2,
  phone = "+91 98408 24210",
  onEdit = () => window.history.back(),
  onProceed = () => {},
}: OrderReviewProps) {
  const parsePagesToPrint = (pagesStr?: string, totalPages: number = 1) => {
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
      const finalCount = count > 0 ? count : totalPages;
      return Math.min(finalCount, totalPages);
    } catch {
      return totalPages;
    }
  };

  const getFileMetrics = (f: PrintFile) => {
    const pages = parsePagesToPrint(f.pagesToPrint, f.pageCount || 1);
    const fileLayout = f.layout || layout || 'duplex';
    const pagesPerSheet = fileLayout === 'simplex' ? 1 : 2;
    const sheetsPerCopy = Math.ceil(pages / pagesPerSheet);
    const fileCopies = f.copies || copies || 1;
    const totalSheets = sheetsPerCopy * fileCopies;
    const fileColorMode = f.colorMode || colorMode || 'bw';
    const pricePerSheet = fileColorMode === 'color' ? PRICE.color : PRICE.bw;
    const cost = totalSheets * pricePerSheet;
    return { pages, sheetsPerCopy, totalSheets, pricePerSheet, cost, fileColorMode, fileLayout, fileCopies };
  };

  const totalFilePages = files.reduce((acc, f) => acc + getFileMetrics(f).pages, 0);
  const calculatedSheets = files.reduce((acc, f) => acc + getFileMetrics(f).totalSheets, 0);
  const calculatedCost = files.reduce((acc, f) => acc + getFileMetrics(f).cost, 0);
  
  const finalPrintCost = defaultPrintCost !== undefined ? defaultPrintCost : calculatedCost;
  const grandTotal = finalPrintCost + serviceFee;

  // Check if all files have the same settings
  const hasMultipleDifferentSettings = files.length > 1 && files.some((f, _, arr) => 
    (f.colorMode || colorMode) !== (arr[0].colorMode || colorMode) ||
    (f.layout || layout) !== (arr[0].layout || layout) ||
    (f.copies || copies) !== (arr[0].copies || copies)
  );

  return (
    <>
      <style>{`
        .or-card * { box-sizing: border-box; }

        /* Section Headings */
        .or-sec-heading {
          font-size: 0.74rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748b;
          margin: 0;
        }

        /* Edit Button */
        .or-edit-pill-btn {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          color: #4a5fc1;
          font-size: 0.76rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          font-family: inherit;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .or-edit-pill-btn:hover {
          background: #f5f7ff;
          border-color: #c7d2fe;
          transform: translateY(-1px);
        }

        /* Uploaded Files Scroll Box - generously sized to utilize space */
        .or-files-box {
          border: 1.5px solid #e2e8f0;
          border-radius: 16px;
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          padding: 10px;
          max-height: min(34vh, 250px);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          -webkit-overflow-scrolling: touch;
          box-shadow: inset 0 2px 4px rgba(15, 23, 42, 0.02), 0 1px 2px rgba(15, 23, 42, 0.03);
        }

        /* File Card Item */
        .or-file-item {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.02);
          transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s, border-color 0.15s;
        }
        .or-file-item:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.06);
          transform: translateY(-1px);
        }

        .or-file-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
          border: 1px solid rgba(79, 70, 229, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        /* Settings Chips container */
        .or-chips-container {
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 14px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
        }

        .or-icon-pill {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 4px 10px;
          font-size: 0.76rem;
          font-weight: 600;
          color: #334155;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* Bill Card */
        .or-bill-card {
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 16px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
        }

        .or-bill-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 8px;
          border-bottom: 1px dashed #e2e8f0;
        }

        .or-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.84rem;
        }
        .or-row-label { color: #64748b; font-weight: 500; }
        .or-row-val   { color: #0f172a; font-weight: 600; }

        .or-grand {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 10px;
          border-top: 1.5px solid #e2e8f0;
          font-size: 0.96rem;
          font-weight: 700;
          color: #0f172a;
        }

        /* Bottom sticky Proceed Action */
        .or-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 12px 18px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 20px;
          box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.08);
        }

        .or-proceed {
          background: #1a2340;
          color: #ffffff;
          border: none;
          border-radius: 50px;
          padding: 11px 22px;
          font-size: 0.94rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: inherit;
        }
        .or-proceed:hover {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(26, 35, 64, 0.25);
        }
        .or-proceed:active {
          transform: scale(0.98);
        }
        .or-footer-left { font-size: 0.78rem; color: #64748b; line-height: 1.35; }
        .or-footer-left strong { display: block; font-size: 1.15rem; color: #0f172a; font-weight: 800; }

        @media (max-width: 768px) {
          .or-card { border-radius: 0 !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="or-card" style={{
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
        <AppHeader title="CampusPrint" subtitle="Print Anywhere on Campus" onBack={onEdit} />

        {/* ── Scrollable / Single-frame Content Body ── */}
        <div style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          overflowY: "auto",
          padding: "14px 20px 18px",
          WebkitOverflowScrolling: "touch"
        }}>
          <div style={{
            width: "100%",
            maxWidth: "480px",
            display: "flex",
            flexDirection: "column",
            gap: "14px"
          }}>
            <h2 style={{
              margin: "0",
              textAlign: "center",
              fontSize: "1.35rem",
              fontWeight: 700,
              color: "#1a2340",
              fontFamily: "'Quicksand', sans-serif"
            }}>
              Review Your Order
            </h2>

            {/* ── Uploaded Files with Lenis Internal Scroll ── */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 className="or-sec-heading">Uploaded Files</h3>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', color: '#ffffff', padding: '2px 8px', borderRadius: '12px', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)' }}>{files.length}</span>
                </div>
                <button className="or-edit-pill-btn" onClick={onEdit}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  <span>Edit Settings</span>
                </button>
              </div>

              {/* Dedicated scrollable bordered box with Lenis Smooth Scroll */}
              <SmoothScrollBox className="or-files-box" maxHeight="min(34vh, 250px)">
                {files.map(file => {
                  const metrics = getFileMetrics(file);
                  const hasCustomPages = (file as any).pagesToPrint && (file as any).pagesToPrint !== "All";

                  return (
                    <div key={file.id} className="or-file-item">
                      <div className="or-file-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a5fc1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: "0 0 3px 0", fontSize: "0.86rem", fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.fileName}</p>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          <span style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: metrics.fileColorMode === 'color' ? '#eef2ff' : '#f1f5f9', 
                            color: metrics.fileColorMode === 'color' ? '#4a5fc1' : '#475569', 
                            border: metrics.fileColorMode === 'color' ? '1px solid #dbeafe' : '1px solid #e2e8f0',
                            padding: '1.5px 6px', 
                            borderRadius: '4px', 
                            fontWeight: 600, 
                            fontSize: '0.70rem' 
                          }}>
                            {metrics.fileColorMode === 'color' ? (
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
                            {metrics.fileLayout === 'duplex' ? 'Double' : 'Single'}
                          </span>

                          {metrics.fileCopies > 1 && (
                            <span style={{ background: '#eef2ff', color: '#4a5fc1', padding: '1px 5px', borderRadius: '4px', fontWeight: 600, fontSize: '0.70rem' }}>
                              {metrics.fileCopies}x
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

                          <span style={{ fontSize: "0.70rem", color: "#059669", fontWeight: 700, marginLeft: "auto" }}>
                            ₹{metrics.cost.toFixed(0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </SmoothScrollBox>
            </div>

            {/* ── Print Settings Summary ── */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <h3 className="or-sec-heading">Print Configuration</h3>
              </div>
              <div className="or-chips-container">
                {hasMultipleDifferentSettings ? (
                  <span className="or-icon-pill" style={{ color: '#4f46e5', borderColor: '#c7d2fe', background: '#f5f7ff' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    Customized per file ({files.length} files)
                  </span>
                ) : (
                  <>
                    <span className="or-icon-pill">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                      {copies} Cop{copies === 1 ? "y" : "ies"}
                    </span>

                    {/* Color blob chip */}
                    <span className="or-icon-pill">
                      {colorMode === "color" ? (
                        <svg width="13" height="13" viewBox="0 0 20 20">
                          <circle cx="7"  cy="10" r="6" fill="#3b82f6" opacity="0.85"/>
                          <circle cx="13" cy="10" r="6" fill="#f59e0b" opacity="0.85"/>
                          <circle cx="10" cy="6"  r="6" fill="#ec4899" opacity="0.75"/>
                        </svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 20 20">
                          <circle cx="8"  cy="11" r="6" fill="#94a3b8"/>
                          <circle cx="12" cy="9"  r="6" fill="#334155"/>
                        </svg>
                      )}
                      {colorMode === "bw" ? "B/W" : "Color"}
                    </span>

                    {/* Layout chip */}
                    <span className="or-icon-pill">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        {layout === "duplex"
                          ? <><rect x="2" y="3" width="13" height="17" rx="2"/><rect x="9" y="5" width="13" height="17" rx="2" opacity="0.4"/></>
                          : <rect x="4" y="3" width="16" height="18" rx="2"/>
                        }
                      </svg>
                      {layout === "duplex" ? "Double-sided" : "Single-sided"}
                    </span>

                    {/* Orientation chip */}
                    <span className="or-icon-pill">
                      {orientation === "portrait"
                        ? <svg width="10" height="12" viewBox="0 0 10 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="1" width="8" height="11" rx="1.5"/></svg>
                        : <svg width="12" height="10" viewBox="0 0 13 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="1" width="11" height="8" rx="1.5"/></svg>
                      }
                      {orientation === "portrait" ? "Portrait" : "Landscape"}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* ── Order Summary (Bill Details) ── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h3 className="or-sec-heading">Order Summary</h3>
                <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                  Standard Pricing Applied
                </span>
              </div>
              <div className="or-bill-card">
                <div className="or-bill-header">
                  <p style={{ margin: 0, fontSize: "0.76rem", fontWeight: 700, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase" }}>Bill Details</p>
                  <span style={{ fontSize: "0.74rem", color: "#64748b", fontWeight: 600 }}>{calculatedSheets} {calculatedSheets === 1 ? 'Sheet' : 'Sheets'} total</span>
                </div>
                <div className="or-row">
                  <span className="or-row-label">Total Files</span>
                  <span className="or-row-val">{files.length} File{files.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="or-row">
                  <span className="or-row-label">Total Pages to Print</span>
                  <span className="or-row-val">{totalFilePages} Page{totalFilePages !== 1 ? "s" : ""}</span>
                </div>
                <div className="or-row">
                  <span className="or-row-label">Printing Cost</span>
                  <span className="or-row-val">₹ {finalPrintCost.toFixed(2)}</span>
                </div>
                <div className="or-row">
                  <span className="or-row-label" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    Platform Service Fee
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </span>
                  <span className="or-row-val">₹ {serviceFee.toFixed(2)}</span>
                </div>

                {/* Grand total */}
                <div className="or-grand">
                  <span>Grand Total</span>
                  <span style={{ fontSize: "1.15rem", color: "#4a5fc1", fontWeight: 800 }}>₹ {grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* ── Sticky footer bar ── */}
            <div style={{ width: "100%", paddingTop: "2px" }}>
              <div className="or-footer">
                <div className="or-footer-left">
                  <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 500 }}>Total {totalFilePages} page{totalFilePages !== 1 ? 's' : ''} ({calculatedSheets} sheets)</span>
                  <strong>₹ {grandTotal.toFixed(2)}</strong>
                </div>
                <button className="or-proceed" onClick={onProceed}>
                  <span>Proceed to Pay</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
