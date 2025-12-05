"use client";

import { useState, useEffect } from "react";
import { createIdentity, getIdentity, updateIdentity } from "@/app/lib/identity";
import type { UserIdentity } from "@/app/lib/identity";

export function JoinDialog({ onJoin }: { onJoin: (identity: UserIdentity) => void }) {
  const [name, setName] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if we already have an identity
    const existing = getIdentity();
    if (existing) {
      onJoin(existing);
    } else {
      setIsOpen(true);
    }
  }, [onJoin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const identity = createIdentity(name.trim());
    onJoin(identity);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(255,255,255,0.85)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      backdropFilter: "blur(12px)"
    }}>
      <div style={{
        background: "white",
        border: "1px solid #e2e8f0",
        padding: 32,
        borderRadius: 24,
        width: "100%",
        maxWidth: 400,
        boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.1), 0 0 15px rgba(0,0,0,0.05)"
      }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 700, color: "#1a1a1a" }}>
          Join Room
        </h2>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "#666" }}>
          Enter a display name to collaborate.
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alice"
              autoFocus
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                color: "#1a1a1a",
                fontSize: 16,
                outline: "none",
                transition: "all 0.2s"
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.background = "white";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(249, 115, 22, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#e2e8f0";
                e.currentTarget.style.background = "#f8fafc";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim()}
            style={{
              width: "100%",
              padding: "14px",
              background: name.trim() ? "var(--accent)" : "#f1f5f9",
              color: name.trim() ? "white" : "#94a3b8",
              border: "none",
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              cursor: name.trim() ? "pointer" : "not-allowed",
              transition: "all 0.2s",
              boxShadow: name.trim() ? "0 4px 6px -1px rgba(249, 115, 22, 0.2)" : "none"
            }}
          >
            Start Collaborating
          </button>
        </form>
      </div>
    </div>
  );
}
