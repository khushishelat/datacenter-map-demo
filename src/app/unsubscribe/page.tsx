"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function UnsubscribeForm() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const [email, setEmail] = useState(emailParam);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  async function handleUnsubscribe() {
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("done");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div style={{ maxWidth: 440, margin: "80px auto", padding: "0 24px", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: 18, color: "#1D1B16", marginBottom: 24 }}>
        parallel
      </div>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#1D1B16", marginBottom: 32 }}>
        Datacenter Signal
      </div>

      {status === "done" ? (
        <>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: "#1D1B16", marginBottom: 12 }}>
            You&apos;ve been unsubscribed
          </h1>
          <p style={{ fontSize: 14, lineHeight: "22px", color: "#5C5B59" }}>
            <strong style={{ color: "#1D1B16" }}>{email}</strong> has been removed from the Datacenter Signal mailing list.
          </p>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: "#1D1B16", marginBottom: 12 }}>
            Unsubscribe
          </h1>
          <p style={{ fontSize: 14, lineHeight: "22px", color: "#5C5B59", marginBottom: 20 }}>
            Remove your email from the Datacenter Signal weekly brief.
          </p>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            style={{
              width: "100%", padding: "10px 12px", fontSize: 14,
              border: "1px solid #E5E5E5", borderRadius: 6, marginBottom: 12,
              fontFamily: "'Courier New', monospace", boxSizing: "border-box" as const,
            }}
          />

          <button
            onClick={handleUnsubscribe}
            disabled={!email || status === "loading"}
            style={{
              fontFamily: "'Courier New', monospace", textTransform: "uppercase" as const,
              fontSize: 12, padding: "10px 24px",
              backgroundColor: status === "loading" ? "#A6A5A4" : "#1D1B16",
              color: "#fff", border: "none", borderRadius: 6, cursor: "pointer",
            }}
          >
            {status === "loading" ? "Removing..." : "Unsubscribe"}
          </button>

          {status === "error" && (
            <p style={{ fontSize: 13, color: "#E14942", marginTop: 12 }}>
              Something went wrong. Please try again.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: 440, margin: "80px auto", padding: "0 24px", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
        <p style={{ fontSize: 14, color: "#5C5B59" }}>Loading...</p>
      </div>
    }>
      <UnsubscribeForm />
    </Suspense>
  );
}
