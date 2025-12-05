import { useEffect, useRef, useState } from "react";
import type { PresenceMap, PointerPayload } from "./usePresence";

const FAKE_NAMES = [
    "Architect", "Engineer", "Client", "Manager", "Designer",
    "Consultant", "Viewer", "Guest", "Supervisor", "Director"
];

const COLORS = ["#a855f7", "#22d3ee", "#f59e0b", "#ef4444", "#10b981", "#3b82f6"];

const getRandomName = () => FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];

// Deterministically map an ID to a color so fake users
// keep the same color across reloads and sessions.
const getColorForId = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    const index = Math.abs(hash) % COLORS.length;
    return COLORS[index];
};

// Chaotic but deterministic 3D movement based on wall-clock time.
// Using Date.now means all clients see the same motion for a given bot.
const getPosition = (timeMs: number, offset: number): [number, number, number] => {
    const t = timeMs * 0.001; // seconds
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
    const t = timeMs * 0.001;
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
        { id: "fake-1", offset: 0, color: getColorForId("fake-1"), name: getRandomName(), nextNameChange: 0 },
        { id: "fake-2", offset: 100, color: getColorForId("fake-2"), name: getRandomName(), nextNameChange: 0 }
    ]);

    useEffect(() => {
        let animationFrameId: number;

        const update = () => {
            const now = Date.now();
            const newPointers: PresenceMap = {};

            usersRef.current.forEach(user => {
                // Name rotation logic
                if (now > user.nextNameChange) {
                    user.name = getRandomName();
                    // Schedule next change in 5-10 minutes (300,000 - 600,000 ms)
                    user.nextNameChange = now + 300000 + Math.random() * 300000;
                }

                newPointers[user.id] = {
                    position: getPosition(now, user.offset),
                    direction: getDirection(now, user.offset),
                    color: user.color,
                    label: user.name
                };
            });

            setPointers(newPointers);
            animationFrameId = requestAnimationFrame(update);
        };

        // Initialize next name change times
        const now = Date.now();
        usersRef.current.forEach(user => {
            if (user.nextNameChange === 0) {
                user.nextNameChange = now + 300000 + Math.random() * 300000;
            }
        });

        update();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return { pointers };
};
