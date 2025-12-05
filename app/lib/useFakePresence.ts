import { useEffect, useRef, useState } from "react";
import type { PresenceMap, PointerPayload } from "./usePresence";

// Fixed fake users with constant names and colors
const FAKE_USERS = [
    { id: "fake-1", offset: 0, color: "#22d3ee", label: "Client" },
    { id: "fake-2", offset: 100, color: "#a855f7", label: "Architect" }
];

// Simple deterministic pseudo-random helper (0–1) based on a numeric seed
const pseudoRandom = (seed: number) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
};

// Determine whether a bot is "idle" (stale) or "moving" for the current time.
// This is deterministic from wall-clock time + offset so all clients see the same pattern.
const getMovementPhase = (timeMs: number, offset: number) => {
    const SEGMENT_MS = 8000; // 8s segments for natural pauses
    const segmentIndex = Math.floor((timeMs + offset * 500) / SEGMENT_MS);
    const rand = pseudoRandom(segmentIndex + offset * 0.13);
    const isIdle = rand < 0.65; // ~65% of the time spent idle
    const segmentStartTime = segmentIndex * SEGMENT_MS;
    return { isIdle, segmentStartTime };
};

// Chaotic but deterministic 3D movement based on wall-clock time,
// with frequent "stale" periods where bots stop in place.
const getPosition = (timeMs: number, offset: number): [number, number, number] => {
    const { isIdle, segmentStartTime } = getMovementPhase(timeMs, offset);
    const effectiveTime = isIdle ? segmentStartTime : timeMs;
    const t = effectiveTime * 0.001; // seconds
    const x =
        Math.sin(t + offset) * 18 +
        Math.cos(t * 0.7 + offset * 0.3) * 7 +
        Math.sin(t * 1.3 + offset * 0.5) * 3;
    const y =
        8 +
        Math.sin(t * 1.1 + offset) * 6 +
        Math.cos(t * 0.4 + offset * 0.2) * 2;
    const z =
        Math.cos(t + offset * 0.8) * 18 +
        Math.sin(t * 0.9 + offset * 0.6) * 7;
    return [x, y, z];
};

const getDirection = (timeMs: number, offset: number): [number, number, number] => {
    const { isIdle, segmentStartTime } = getMovementPhase(timeMs, offset);
    const effectiveTime = isIdle ? segmentStartTime : timeMs;
    const t = effectiveTime * 0.001;
    // Look roughly toward origin but wobble a bit over time
    const baseX = -Math.sin(t + offset * 0.5);
    const baseZ = -Math.cos(t + offset * 0.5);
    const x = baseX + Math.sin(t * 1.7 + offset) * 0.3;
    const y = -0.4 + Math.sin(t * 0.9 + offset) * 0.2;
    const z = baseZ + Math.cos(t * 1.3 + offset) * 0.3;
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    return [x / len, y / len, z / len];
};

export const useFakePresence = () => {
    const [pointers, setPointers] = useState<PresenceMap>({});

    // Keep track of our fake users
    const usersRef = useRef([
        ...FAKE_USERS
    ]);

    useEffect(() => {
        let animationFrameId: number;

        const update = () => {
            const now = Date.now();
            const newPointers: PresenceMap = {};

            usersRef.current.forEach(user => {
                newPointers[user.id] = {
                    position: getPosition(now, user.offset),
                    direction: getDirection(now, user.offset),
                    color: user.color,
                    label: user.label
                };
            });

            setPointers(newPointers);
            animationFrameId = requestAnimationFrame(update);
        };

        update();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return { pointers };
};
