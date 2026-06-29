import { useState, useEffect } from 'react';

export interface SavedAudience {
    id: string;
    name: string;
    targeting: any; // Targeting spec
    createdAt: string;
}

const STORAGE_KEY = 'lads_saved_audiences';

export function useSavedAudiences() {
    const [savedAudiences, setSavedAudiences] = useState<SavedAudience[]>([]);

    useEffect(() => {
        // Load from local storage on mount
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setSavedAudiences(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse saved audiences', e);
            }
        }
    }, []);

    const saveAudience = (name: string, targeting: any) => {
        const newAudience: SavedAudience = {
            id: crypto.randomUUID(),
            name,
            targeting,
            createdAt: new Date().toISOString(),
        };

        const updated = [...savedAudiences, newAudience];
        setSavedAudiences(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return newAudience;
    };

    const deleteAudience = (id: string) => {
        const updated = savedAudiences.filter(a => a.id !== id);
        setSavedAudiences(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    };

    return {
        savedAudiences,
        saveAudience,
        deleteAudience
    };
}
