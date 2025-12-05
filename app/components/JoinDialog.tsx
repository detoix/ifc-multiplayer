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
      background: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      backdropFilter: "blur(4px)"
    }}>
      <div style={{
        background: "#0f172a",
        border: "1px solid #1e293b",
        padding: 24,
        borderRadius: 12,
        width: "100%",
        maxWidth: 400,
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
      }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 600, color: "#f8fafc" }}>
          Join Room
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14, color: "#94a3b8" }}>
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name..."
              autoFocus
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 6,
                color: "white",
                fontSize: 16,
                outline: "none"
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim()}
            style={{
              width: "100%",
              padding: "10px",
              background: name.trim() ? "#3b82f6" : "#334155",
              color: name.trim() ? "white" : "#94a3b8",
              border: "none",
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 500,
              cursor: name.trim() ? "pointer" : "not-allowed",
              transition: "all 0.2s"
            }}
          >
            Join
          </button>
        </form>
      </div>
    </div>
  );
}
