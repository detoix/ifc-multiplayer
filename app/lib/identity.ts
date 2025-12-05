export type UserIdentity = {
    id: string;
    name: string;
    color: string;
};

const STORAGE_KEY = "ifc-presence-identity";

const COLORS = [
    "#ef4444", // red
    "#f97316", // orange
    "#f59e0b", // amber
    "#eab308", // yellow
    "#22c55e", // green
    "#10b981", // emerald
    "#14b8a6", // teal
    "#06b6d4", // cyan
    "#0ea5e9", // sky
    "#3b82f6", // blue
    "#6366f1", // indigo
    "#8b5cf6", // violet
    "#a855f7", // purple
    "#d946ef", // fuchsia
    "#ec4899", // pink
    "#f973b5"  // light pink
];

const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

export const getIdentity = (): UserIdentity | null => {
    if (typeof window === "undefined") return null;
    try {
        const stored = window.sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to parse identity", e);
    }
    return null;
};

export const createIdentity = (name: string): UserIdentity => {
    const identity: UserIdentity = {
        id: crypto.randomUUID(),
        name,
        color: getRandomColor(),
    };
    if (typeof window !== "undefined") {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    }
    return identity;
};

export const updateIdentity = (updates: Partial<UserIdentity>): UserIdentity | null => {
    const current = getIdentity();
    if (!current) return null;

    const updated = { ...current, ...updates };
    if (typeof window !== "undefined") {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
    return updated;
};
