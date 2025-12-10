"use client";

import { useEffect, useState, useCallback } from "react";
import { IfcViewer } from "@/app/components/IfcViewer";
import type { PresenceMap } from "@/app/lib/usePresence";

const PROMPT_PRESETS = [
  {
    id: "christmas",
    label: "Christmas prompt 🎄",
    initial:
      "Enhance this architectural 3D scene into a high-quality, photorealistic Christmas render from the same camera angle. Keep all geometry and composition unchanged, but transform the environment into a festive winter setting with gentle snowfall, warm decorative lighting, subtle Christmas decorations, and a cozy evening atmosphere while preserving the original structure exactly.",
  },
  {
    id: "current",
    label: "Neutral prompt ✨",
    initial:
      "Enhance this architectural 3D scene into a high-quality, photorealistic render from the same camera angle. Keep all building geometry, shapes, and layout strictly unchanged—do not move, remove, or add any objects, and do not alter the composition or perspective. Add serene, natural surroundings, enrich colors, and improve lighting and materials while preserving the original structure exactly.",
  },
  {
    id: "spring",
    label: "Spring prompt 🌱",
    initial:
      "Enhance this architectural 3D scene into a high-quality, photorealistic spring render from the same camera angle. Keep all geometry and composition unchanged, but add soft spring sunlight, fresh greenery, blossoming trees, and bright yet natural colors while preserving the original structure exactly.",
  },
  {
    id: "village",
    label: "Village prompt 🏡",
    initial:
      "Enhance this architectural 3D scene into a high-quality, photorealistic render set in a small village context. Keep all building geometry and composition unchanged, but surround it with low-rise neighboring structures, trees, narrow streets, and human-scale details while preserving the original building footprint.",
  },
  {
    id: "city",
    label: "City prompt 🌆",
    initial:
      "Enhance this architectural 3D scene into a high-quality, photorealistic render set in a dense city context. Keep all building geometry and composition unchanged, but place it among taller neighboring buildings, paved public space, street furniture, and subtle urban details while preserving the original structure exactly.",
  },
];

export function VizRoom() {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [activePresetIndex, setActivePresetIndex] = useState(0);
  const [prompts, setPrompts] = useState<string[]>(() =>
    PROMPT_PRESETS.map((preset) => preset.initial)
  );
  const [nanoBananaPromptVersion, setNanoBananaPromptVersion] = useState(0);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const emptyPointers: PresenceMap = {};

  useEffect(() => {
    if (typeof window !== "undefined") {
      const updateIsMobile = () => {
        setIsMobile(window.innerWidth <= 900);
      };
      updateIsMobile();
      window.addEventListener("resize", updateIsMobile);
      return () => window.removeEventListener("resize", updateIsMobile);
    }
  }, []);

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

  const handlePrevPreset = useCallback(() => {
    setActivePresetIndex((current) => {
      const nextIndex = (current - 1 + PROMPT_PRESETS.length) % PROMPT_PRESETS.length;
      return nextIndex;
    });
    setNanoBananaPromptVersion((v) => v + 1);
  }, []);

  const handleNextPreset = useCallback(() => {
    setActivePresetIndex((current) => {
      const nextIndex = (current + 1) % PROMPT_PRESETS.length;
      return nextIndex;
    });
    setNanoBananaPromptVersion((v) => v + 1);
  }, []);

  const handlePromptChange = useCallback(
    (value: string) => {
      setPrompts((current) => {
        const next = [...current];
        next[activePresetIndex] = value;
        return next;
      });
    },
    [activePresetIndex]
  );

  const currentPrompt = prompts[activePresetIndex] ?? "";
  const currentPreset = PROMPT_PRESETS[activePresetIndex];

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
          nanoBananaPrompt={currentPrompt}
          nanoBananaPromptVersion={nanoBananaPromptVersion}
          showLevelSelector={false}
        />

      {/* Fixed prompt overlay */}
      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: isMobile && isPromptFocused ? "40vh" : 24,
          transform: "translateX(-50%)",
          zIndex: 30,
          width: "min(960px, 100% - 32px)",
          padding: 20,
          borderRadius: 8,
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
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
          }}
        >
          AI render prompt · {currentPreset.label}
        </label>
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={handlePrevPreset}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              width: 32,
              minWidth: 32,
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "white",
              color: "var(--text-muted)",
              fontSize: 16,
              alignSelf: "stretch",
            }}
          >
            ←
          </button>
          <textarea
            value={currentPrompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            onFocus={() => setIsPromptFocused(true)}
            onBlur={() => setIsPromptFocused(false)}
            rows={4}
            style={{
              flex: 1,
              width: "100%",
              resize: "none",
              borderRadius: 8,
              border: "1px solid var(--border)",
              padding: "12px 14px",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
              background: "rgba(255,255,255,0.95)",
              color: "var(--text)",
            }}
          />
          <button
            type="button"
            onClick={handleNextPreset}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              width: 32,
              minWidth: 32,
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "white",
              color: "var(--text-muted)",
              fontSize: 16,
              alignSelf: "stretch",
            }}
          >
            →
          </button>
        </div>
      </div>
    </>
  );
}
