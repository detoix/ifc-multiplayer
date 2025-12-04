"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export type PointerPayload = {
  position: [number, number, number]; // Camera position
  direction: [number, number, number]; // Camera look direction
  color: string;
  label: string;
};
export type PresenceMap = Record<string, PointerPayload>;

const colors = ["#a855f7", "#22d3ee", "#f59e0b", "#ef4444", "#10b981", "#3b82f6"];

const getClientId = () => {
  if (typeof window === "undefined") return "server";
  const stored = window.localStorage.getItem("ifc-presence-client-id");
  if (stored) return stored;
  const id = crypto.randomUUID();
  window.localStorage.setItem("ifc-presence-client-id", id);
  return id;
};

export const usePresence = (roomId: string, label: string | null) => {
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    setClientId(getClientId());
  }, []);
  const [color, setColor] = useState("#a855f7"); // Default color
  const [pointers, setPointers] = useState<PresenceMap>({});
  const socketRef = useRef<Socket | null>(null);
  const lastSent = useRef(0);
  const pointerRef = useRef<PointerPayload>({ position: [0, 0, 0], direction: [0, 0, -1], color: "#a855f7", label: label || "" });

  useEffect(() => {
    if (label) {
      pointerRef.current.label = label;
    }
  }, [label]);

  // Set random color on client only to avoid hydration mismatch
  useEffect(() => {
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    setColor(randomColor);
    pointerRef.current.color = randomColor;
  }, []);

  useEffect(() => {
    // Initialize socket connection
    const socket = io();
    socketRef.current = socket;
    (window as any).__socket = socket; // Expose for file sync

    socket.on("connect", () => {
      console.log("Connected to websocket", socket.id);
      // Clear pointers on reconnect to avoid stale state
      setPointers({});
      socket.emit("join-room", roomId);
    });

    socket.on("pointer-update", ({ clientId: remoteId, pointer }: { clientId: string; pointer: PointerPayload }) => {
      setPointers((prev) => ({
        ...prev,
        [remoteId]: pointer
      }));
    });

    socket.on("user-disconnected", (remoteId: string) => {
      setPointers((prev) => {
        const next = { ...prev };
        delete next[remoteId];
        return next;
      });
    });

    return () => {
      socket.disconnect();
      setPointers({}); // Clear pointers on unmount/disconnect
    };
  }, [roomId]);

  const updatePosition = React.useCallback((position: [number, number, number], direction: [number, number, number]) => {
    const now = performance.now();
    if (now - lastSent.current < 50) return; // Throttle to ~20fps
    lastSent.current = now;

    pointerRef.current.position = position;
    pointerRef.current.direction = direction;

    if (socketRef.current) {
      socketRef.current.emit("pointer-update", { roomId, pointer: pointerRef.current });
    }
  }, [roomId]);

  return { pointers, clientId, color, updatePosition, socket: socketRef.current } as const;
};
