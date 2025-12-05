import { useEffect, useRef, useState } from "react";
import type { PresenceMap, PointerPayload } from "./usePresence";

const FAKE_NAMES = [
    "Architect", "Engineer", "Client", "Manager", "Designer",
    "Consultant", "Viewer", "Guest", "Supervisor", "Director"
];

const COLORS = ["#a855f7", "#22d3ee", "#f59e0b", "#ef4444", "#10b981", "#3b82f6"];

const getRandomName = () => FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

// Simple 3D noise-like movement using sine waves with different frequencies
const getPosition = (time: number, offset: number): [number, number, number] => {
    const t = time * 0.0005; // Slow down time
    const x = Math.sin(t + offset) * 15 + Math.cos(t * 0.5 + offset) * 5;
    const y = 10 + Math.sin(t * 0.3 + offset) * 5; // Height varies between 5 and 15
    const z = Math.cos(t + offset) * 15 + Math.sin(t * 0.7 + offset) * 5;
    return [x, y, z];
};

const getDirection = (time: number, offset: number): [number, number, number] => {
    const t = time * 0.0005;
    // Look roughly towards center (0,0,0) but with some variation
    const x = -Math.sin(t + offset);
    const y = -0.5;
    const z = -Math.cos(t + offset);
    // Normalize roughly
    const len = Math.sqrt(x * x + y * y + z * z);
    return [x / len, y / len, z / len];
};

export const useFakePresence = () => {
    const [pointers, setPointers] = useState<PresenceMap>({});

    // Keep track of our fake users
    const usersRef = useRef([
        { id: "fake-1", offset: 0, color: getRandomColor(), name: getRandomName(), nextNameChange: 0 },
        { id: "fake-2", offset: 100, color: getRandomColor(), name: getRandomName(), nextNameChange: 0 }
    ]);

    useEffect(() => {
        let animationFrameId: number;

        const update = () => {
            const now = performance.now();
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
        const now = performance.now();
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
