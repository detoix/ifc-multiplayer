export type UserIdentity = {
    id: string;
    name: string;
    color: string;
};

const STORAGE_KEY = "ifc-presence-identity";

const COLORS = ["#a855f7", "#22d3ee", "#f59e0b", "#ef4444", "#10b981", "#3b82f6"];

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
