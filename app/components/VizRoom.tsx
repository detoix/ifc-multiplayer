"use client";

import { useEffect, useState, useCallback } from "react";
import { IfcViewer } from "@/app/components/IfcViewer";
import type { PresenceMap } from "@/app/lib/usePresence";

export function VizRoom() {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>(
    "Enhance this architectural 3D scene into a high-quality, photorealistic render from the same camera angle. Keep all building geometry, shapes, and layout strictly unchanged—do not move, remove, or add any objects, and do not alter the composition or perspective. Add serene, natural surroundings, enrich colors, and improve lighting and materials while preserving the original structure exactly."
  );

  const emptyPointers: PresenceMap = {};

  useEffect(() => {
    fetch("/api/room-file?roomId=demo")
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data && data.fileUrl) {
          setFileUrl(data.fileUrl);
        } else {
          setFileUrl("/demo/demo.ifc");
        }
      })
      .catch((err) => {
        console.error("Failed to fetch demo file from API, using local demo:", err);
        setFileUrl("/demo/demo.ifc");
      });
  }, []);

  const onDrop = useCallback((files: File[]) => {
    if (files.length > 0) {
      const url = URL.createObjectURL(files[0]);
      setFileUrl(url);
    }
  }, []);

  const handleCameraUpdate = useCallback(
    (_pos: [number, number, number], _dir: [number, number, number]) => {
      // No multiplayer presence in /viz; we only care about the AI render.
    },
    []
  );

  return (
    <>
      {/* Fullscreen canvas (fixed to viewport) */}

        <IfcViewer
          fileUrl={fileUrl}
          pointers={emptyPointers}
          onCameraUpdate={handleCameraUpdate}
          enableNanoBanana
          nanoBananaPrompt={prompt}
          showLevelSelector={false}
        />

      {/* Fixed prompt overlay */}
      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: 24,
          transform: "translateX(-50%)",
          zIndex: 30,
          width: "min(960px, 100% - 32px)",
          padding: 20,
          borderRadius: 16,
          border: "1px solid var(--border)",
          background: "rgba(255,255,255,0.96)",
          color: "var(--text)",
          boxShadow: "0 18px 40px rgba(15,23,42,0.18)",
        }}
      >
        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 600,
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
          }}
        >
          AI render prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          style={{
            width: "100%",
            resize: "none",
            borderRadius: 16,
            border: "1px solid var(--border)",
            padding: "12px 14px",
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
            background: "rgba(255,255,255,0.95)",
            color: "var(--text)",
          }}
        />
      </div>
    </>
  );
}
