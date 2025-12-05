"use client";

import React, { useEffect, useRef, useState } from "react";
import PusherClient from "pusher-js";

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

// Module-level singleton - only created once
let pusherInstance: PusherClient | null = null;

export const usePresence = (roomId: string, label: string | null) => {
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    setClientId(getClientId());
  }, []);

  const [color, setColor] = useState("#a855f7"); // Default color
  const [pointers, setPointers] = useState<PresenceMap>({});
  const lastSent = useRef(0);
  const pointerRef = useRef<PointerPayload>({ position: [0, 0, 0], direction: [0, 0, -1], color: "#a855f7", label: label || "" });
  const channelRef = useRef<any>(null);

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
    if (typeof window === "undefined") return;

    // Create singleton Pusher instance
    if (!pusherInstance) {
      const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
      const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
      if (!key || !cluster) {
        console.warn("Pusher credentials not configured");
        return;
      }
      pusherInstance = new PusherClient(key, { cluster });
    }

    const channelName = `room-${roomId}`;
    const channel = pusherInstance.subscribe(channelName);
    channelRef.current = channel;

    // Handle pointer updates from other users
    const handlePointerUpdate = ({ senderId, pointer }: { senderId: string; pointer: PointerPayload }) => {
      // Ignore our own updates
      const myId = getClientId();
      if (senderId === myId) return;

      setPointers((prev) => ({
        ...prev,
        [senderId]: pointer
      }));
    };

    // Handle user leaving
    const handleUserLeft = ({ senderId }: { senderId: string }) => {
      setPointers((prev) => {
        const next = { ...prev };
        delete next[senderId];
        return next;
      });
    };

    channel.bind("pointer-update", handlePointerUpdate);
    channel.bind("user-left", handleUserLeft);

    return () => {
      channel.unbind("pointer-update", handlePointerUpdate);
      channel.unbind("user-left", handleUserLeft);
      pusherInstance?.unsubscribe(channelName);
      setPointers({});
    };
  }, [roomId]);

  const updatePosition = React.useCallback((position: [number, number, number], direction: [number, number, number]) => {
    pointerRef.current.position = position;
    pointerRef.current.direction = direction;

    const myClientId = getClientId();
    if (myClientId === "server") return;

    // Send via API route
    fetch("/api/pusher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: `room-${roomId}`,
        event: "pointer-update",
        data: { senderId: myClientId, pointer: pointerRef.current }
      })
    }).catch(console.error);
  }, [roomId]);

  return { pointers, clientId, color, updatePosition } as const;
};
