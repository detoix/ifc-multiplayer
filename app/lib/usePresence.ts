"use client";

import React, { useEffect, useRef, useState } from "react";
import PusherClient from "pusher-js";
import type { UserIdentity } from "./identity";

export type PointerPayload = {
  position: [number, number, number]; // Camera position
  direction: [number, number, number]; // Camera look direction
  color: string;
  label: string;
};
export type PresenceMap = Record<string, PointerPayload>;

const getClientId = () => {
  if (typeof window === "undefined") return "server";
  const stored = window.sessionStorage.getItem("ifc-presence-client-id");
  if (stored) return stored;
  const id = crypto.randomUUID();
  window.sessionStorage.setItem("ifc-presence-client-id", id);
  return id;
};

// Module-level singleton - only created once
let pusherInstance: PusherClient | null = null;

export const usePresence = (roomId: string, identity: UserIdentity | null) => {
  const [pointers, setPointers] = useState<PresenceMap>({});
  const lastSent = useRef(0);

  // Initialize pointer ref with identity if available, otherwise defaults
  const pointerRef = useRef<PointerPayload>({
    position: [0, 0, 0],
    direction: [0, 0, -1],
    color: identity?.color || "#a855f7",
    label: identity?.name || "Anonymous"
  });

  const channelRef = useRef<any>(null);

  // Update pointer ref when identity changes
  useEffect(() => {
    if (identity) {
      pointerRef.current.color = identity.color;
      pointerRef.current.label = identity.name;
    }
  }, [identity]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!identity) return; // Wait for identity

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
      if (senderId === identity.id) return;

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
  }, [roomId, identity]);

  const updatePosition = React.useCallback((position: [number, number, number], direction: [number, number, number]) => {
    pointerRef.current.position = position;
    pointerRef.current.direction = direction;

    if (!identity) return;

    // Send via API route
    fetch("/api/pusher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: `room-${roomId}`,
        event: "pointer-update",
        data: { senderId: identity.id, pointer: pointerRef.current }
      })
    }).catch(console.error);
  }, [roomId, identity]);

  return { pointers, updatePosition } as const;
};
