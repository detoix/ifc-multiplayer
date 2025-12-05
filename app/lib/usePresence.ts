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
  const [events, setEvents] = useState<string[]>([]);
  const lastSent = useRef(0);

  // Initialize pointer ref with identity if available, otherwise defaults
  const pointerRef = useRef<PointerPayload>({
    position: [0, 0, 0],
    direction: [0, 0, -1],
    color: identity?.color || "#a855f7",
    label: identity?.name || "Anonymous"
  });

  const channelRef = useRef<any>(null);
  const hasAnnouncedLeaveRef = useRef(false);
  const hasSentInitialPointerRef = useRef(false);

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
    hasAnnouncedLeaveRef.current = false;

    // Announce that we joined the room so others know immediately
    fetch("/api/pusher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: channelName,
        event: "user-joined",
        data: { senderId: identity.id, name: identity.name, color: identity.color }
      })
    }).catch(console.error);

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
        const label = next[senderId]?.label || prev[senderId]?.label;
        delete next[senderId];
        if (label) {
          setEvents((prevEvents) => [...prevEvents.slice(-4), `${label} left the room`]);
        }
        return next;
      });
    };

    // Handle user joining
    const handleUserJoined = ({ senderId, name }: { senderId: string; name: string }) => {
      if (senderId === identity.id) return;
      setEvents((prev) => [...prev.slice(-4), `${name} joined the room`]);
    };

    channel.bind("pointer-update", handlePointerUpdate);
    channel.bind("user-left", handleUserLeft);
    channel.bind("user-joined", handleUserJoined);

    return () => {
      channel.unbind("pointer-update", handlePointerUpdate);
      channel.unbind("user-left", handleUserLeft);
      channel.unbind("user-joined", handleUserJoined);
      pusherInstance?.unsubscribe(channelName);
      setPointers({});
    };
  }, [roomId, identity]);

  // As soon as we have an identity, send one pointer update so
  // others can see our camera even if we never move it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!identity) return;
    if (hasSentInitialPointerRef.current) return;

    hasSentInitialPointerRef.current = true;

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

  // Helper to announce that we are leaving the room (route change, tab close, etc.)
  const announceLeave = React.useCallback(() => {
    if (typeof window === "undefined") return;
    if (!identity) return;
    if (hasAnnouncedLeaveRef.current) return;
    hasAnnouncedLeaveRef.current = true;

    const channelName = `room-${roomId}`;
    const payload = {
      channel: channelName,
      event: "user-left",
      data: { senderId: identity.id }
    };

    try {
      const body = JSON.stringify(payload);
      const url = "/api/pusher";

      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      } else {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true
        }).catch(console.error);
      }
    } catch (e) {
      console.error("Failed to announce leave", e);
    }
  }, [roomId, identity]);

  // Announce leave on unmount / dependency change
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!identity) return;

    const handleBeforeUnload = () => {
      announceLeave();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      announceLeave();
    };
  }, [announceLeave, identity]);

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

  return { pointers, updatePosition, events } as const;
};
