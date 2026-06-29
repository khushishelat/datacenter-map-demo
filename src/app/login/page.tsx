"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.href = "/";
      } else {
        setError(true);
        setLoading(false);
      }
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F9F8F4] flex items-center justify-center">
      <div className="bg-white border border-[#E5E5E5] rounded-[8px] p-8 w-[400px] shadow-sm">
        <h1 className="text-[16px] font-medium text-[#1D1B16] mb-1">
          Datacenter Monitor
        </h1>
        <p className="text-[13px] text-[#858483] mb-6">
          Enter password to continue.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full px-4 py-2.5 text-[13px] font-mono border border-[#E5E5E5] rounded-[4px] bg-white text-[#1D1B16] focus:outline-none focus:border-[#FB631B] placeholder:text-[#ADADAC] mb-3"
          />
          {error && (
            <p className="text-[13px] text-[#E14942] mb-3">
              Incorrect password.
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full font-mono uppercase text-[13px] px-4 py-2.5 bg-[#1D1B16] text-white rounded-[4px] hover:bg-[#434343] transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "Enter"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#E5E5E5]">
          <a
            href="https://parallel.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[8px] uppercase tracking-[0.05em] text-[#ADADAC] hover:text-[#FB631B] transition-colors"
          >
            Powered by parallel.ai
          </a>
        </div>
      </div>
    </div>
  );
}
