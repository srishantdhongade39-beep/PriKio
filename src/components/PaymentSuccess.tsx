import { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// PaymentSuccess.tsx
// ─────────────────────────────────────────────────────────────────────────────

const CIRCLE_R = 46;
const CIRCLE_C = 2 * Math.PI * CIRCLE_R;

interface PaymentSuccessProps {
  amount?: string;
  merchantName?: string;
  paymentId?: string;
  paymentMethod?: string;
  redirectSeconds?: number;
  onRedirect?: () => void;
}

export default function PaymentSuccess({
  amount = "10.00",
  merchantName = "CampusPrint",
  paymentId = "pay_" + Math.random().toString(36).slice(2, 14).toUpperCase(),
  paymentMethod = "UPI",
  redirectSeconds = 0,
  onRedirect = () => {},
}: PaymentSuccessProps) {
  const [phase, setPhase] = useState(0);
  const [circleDash, setCircleDash] = useState(CIRCLE_C);
  const [checkDash, setCheckDash] = useState(100);
  const [cardVisible, setCardVisible] = useState(false);
  const [btnVisible, setBtnVisible] = useState(false);
  const [countdown, setCountdown] = useState(redirectSeconds);
  const [copied, setCopied] = useState(false);

  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const now = new Date();
    setDateStr(now.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }));
    setTimeStr(now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }));
  }, []);

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // animation sequence
  useEffect(() => {
    if (prefersReduced) {
      setPhase(5);
      setCircleDash(0);
      setCheckDash(0);
      setCardVisible(true);
      setBtnVisible(true);
      return;
    }
    const t: ReturnType<typeof setTimeout>[] = [];
    t.push(setTimeout(() => { setPhase(1); setCircleDash(0); }, 0));
    t.push(setTimeout(() => { setPhase(2); setCheckDash(0); }, 100));
    t.push(setTimeout(() => setPhase(3), 200));
    t.push(setTimeout(() => setPhase(4), 300));
    t.push(setTimeout(() => setCardVisible(true), 400));
    t.push(setTimeout(() => { setPhase(5); setBtnVisible(true); }, 500));
    return () => t.forEach(clearTimeout);
  }, [prefersReduced]);

  // countdown + auto-redirect
  useEffect(() => {
    if (!btnVisible) return;
    if (countdown <= 0) {
      onRedirect();
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown, btnVisible, onRedirect]);

  const copyId = () => {
    navigator.clipboard?.writeText(paymentId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const fade = (show: boolean, delay = "0s") => ({
    opacity: show ? 1 : 0,
    transform: show ? "translateY(0)" : "translateY(14px)",
    transition: prefersReduced
      ? "none"
      : `opacity 0.5s ease ${delay}, transform 0.5s ease ${delay}`,
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

        .ps-wrap * {
          box-sizing: border-box;
          font-family: 'DM Sans', Inter, system-ui, sans-serif;
        }

        @keyframes ringPulse {
          0%   { transform: scale(1);   opacity: 0.55; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @keyframes ambientGlow {
          0%,100% { opacity: 0.15; }
          50%      { opacity: 0.30; }
        }
        .ps-pulse1 { animation: ringPulse 2s ease-out infinite; }
        .ps-pulse2 { animation: ringPulse 2s ease-out 0.6s infinite; }
        .ps-glow   { animation: ambientGlow 3s ease-in-out infinite; }

        .ps-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 9px 0;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          font-size: 0.82rem;
        }
        .ps-row:last-child { border-bottom: none; }
        .ps-row-label { color: rgba(255,255,255,0.45); font-weight: 400; }
        .ps-row-val   { color: rgba(255,255,255,0.9);  font-weight: 600; }

        .ps-copy {
          background: none; border: none; cursor: pointer;
          color: rgba(255,255,255,0.35); padding: 0 0 0 6px;
          line-height: 1; transition: color 0.15s;
        }
        .ps-copy:hover { color: rgba(255,255,255,0.75); }

        @media (max-width: 480px) {
          .ps-amount { font-size: clamp(2.2rem, 10vw, 3rem) !important; }
          .ps-title  { font-size: clamp(1.3rem, 6vw, 1.7rem) !important; }
        }
      `}</style>

      <div
        className="ps-wrap"
        style={{
          minHeight: "100vh",
          width: "100%",
          zIndex: 9999,
          background: `
            radial-gradient(ellipse 55% 45% at 50% 36%,
              rgba(74,95,193,0.20) 0%,
              rgba(74,95,193,0.08) 45%,
              transparent 70%),
            #1a2340
          `,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        {/* redirect notice */}
        <p
          style={{
            position: "absolute",
            top: "1.5rem",
            fontSize: "0.82rem",
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.01em",
            textAlign: "center",
            margin: 0,
            ...fade(btnVisible),
          }}
        >
          You will be redirected in{" "}
          <strong style={{ color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>
            {countdown} second{countdown !== 1 ? "s" : ""}
          </strong>
        </p>

        {/* ── glowing circle ── */}
        <div style={{ position: "relative", marginBottom: "1.6rem" }}>
          {/* ambient radial glow */}
          {phase >= 3 && (
            <div
              className="ps-glow"
              style={{
                position: "absolute",
                inset: "-32px",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(74,95,193,0.30) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />
          )}
          {/* pulse rings */}
          {phase >= 3 && (
            <>
              <div
                className="ps-pulse1"
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "2px solid rgba(74,95,193,0.55)",
                  pointerEvents: "none",
                }}
              />
              <div
                className="ps-pulse2"
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "2px solid rgba(74,95,193,0.35)",
                  pointerEvents: "none",
                }}
              />
            </>
          )}

          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            aria-label="Payment successful"
          >
            <circle cx="60" cy="60" r="58" fill="#1e2d4f" />
            <circle
              cx="60"
              cy="60"
              r={CIRCLE_R}
              fill="none"
              stroke="rgba(74,95,193,0.12)"
              strokeWidth="5"
            />
            <circle
              cx="60"
              cy="60"
              r={CIRCLE_R}
              fill="none"
              stroke="#4a5fc1"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={CIRCLE_C}
              strokeDashoffset={circleDash}
              transform="rotate(-90 60 60)"
              style={{
                transition: prefersReduced
                  ? "none"
                  : "stroke-dashoffset 0.65s cubic-bezier(0.65,0,0.35,1)",
                filter: phase >= 3 ? "drop-shadow(0 0 8px #4a5fc1)" : "none",
              }}
            />
            <polyline
              points="36,62 52,78 84,44"
              fill="none"
              stroke="#ffffff"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="100"
              strokeDashoffset={checkDash}
              style={{
                transition: prefersReduced
                  ? "none"
                  : "stroke-dashoffset 0.45s cubic-bezier(0.65,0,0.35,1)",
                filter: phase >= 3 ? "drop-shadow(0 0 5px #ffffff)" : "none",
              }}
            />
          </svg>
        </div>

        {/* title */}
        <h1
          className="ps-title"
          style={{
            fontSize: "1.65rem",
            fontWeight: 700,
            color: "white",
            margin: "0 0 0.45rem",
            letterSpacing: "-0.01em",
            textAlign: "center",
            ...fade(phase >= 4),
          }}
        >
          Payment Successful
        </h1>

        {/* amount */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "5px",
            marginBottom: "0.5rem",
            ...fade(phase >= 4, "0.1s"),
          }}
        >
          <span
            style={{ fontSize: "1.4rem", fontWeight: 700, color: "#4a5fc1" }}
          >
            ₹
          </span>
          <span
            className="ps-amount"
            style={{
              fontSize: "2.8rem",
              fontWeight: 700,
              color: "white",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {amount}
          </span>
        </div>

        {/* ORDER CONFIRMED */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            marginBottom: "1.75rem",
            ...fade(phase >= 4, "0.18s"),
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="7" fill="#4a5fc1" opacity="0.18" />
            <polyline
              points="4,8 7,11 12,5"
              fill="none"
              stroke="#4a5fc1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: "#4a5fc1",
              textTransform: "uppercase",
            }}
          >
            Order Confirmed
          </span>
        </div>

        {/* receipt card */}
        <div
          style={{
            width: "min(340px, 100%)",
            background: "rgba(255,255,255,0.055)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: "16px",
            padding: "14px 18px",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            opacity: cardVisible ? 1 : 0,
            transform: cardVisible ? "translateY(0)" : "translateY(20px)",
            transition: prefersReduced
              ? "none"
              : "opacity 0.55s ease, transform 0.55s ease",
          }}
        >
          {/* merchant row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "10px",
              marginBottom: "6px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span
              style={{ fontWeight: 700, color: "white", fontSize: "0.95rem" }}
            >
              {merchantName}
            </span>
            <span
              style={{ fontWeight: 700, color: "#4a5fc1", fontSize: "0.95rem" }}
            >
              ₹ {amount}
            </span>
          </div>

          <div className="ps-row">
            <span className="ps-row-label">Date</span>
            <span className="ps-row-val">
              {dateStr} · {timeStr}
            </span>
          </div>
          <div className="ps-row">
            <span className="ps-row-label">Payment ID</span>
            <span
              className="ps-row-val"
              style={{ display: "flex", alignItems: "center" }}
            >
              <span
                style={{
                  fontFamily: "'DM Mono', 'Courier New', monospace",
                  fontSize: "0.76rem",
                }}
              >
                {paymentId.length > 18
                  ? paymentId.slice(0, 18) + "…"
                  : paymentId}
              </span>
              <button className="ps-copy" onClick={copyId} title="Copy">
                {copied ? (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#4a5fc1"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <polyline points="20,6 9,17 4,12" />
                  </svg>
                ) : (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </span>
          </div>
          <div className="ps-row">
            <span className="ps-row-label">Method</span>
            <span className="ps-row-val">{paymentMethod}</span>
          </div>

          {/* secured footer */}
          <div
            style={{
              marginTop: "10px",
              paddingTop: "10px",
              borderTop: "1px solid rgba(255,255,255,0.07)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span
              style={{
                fontSize: "0.7rem",
                color: "rgba(255,255,255,0.3)",
                letterSpacing: "0.04em",
              }}
            >
              Secured by CampusPrint
            </span>
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={onRedirect}
          style={{
            marginTop: "1.5rem",
            padding: "12px 28px",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "9999px",
            color: "white",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
            backdropFilter: "blur(4px)",
            transition: prefersReduced ? "none" : "all 0.2s ease",
            opacity: btnVisible ? 1 : 0,
            transform: btnVisible ? "translateY(0)" : "translateY(20px)",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.2)";
            e.currentTarget.style.transform = btnVisible ? "translateY(-2px)" : "translateY(20px)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.1)";
            e.currentTarget.style.transform = btnVisible ? "translateY(0)" : "translateY(20px)";
          }}
        >
          Continue
        </button>
      </div>
    </>
  );
}
