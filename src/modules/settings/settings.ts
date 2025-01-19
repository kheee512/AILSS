// ... existing code ...
export interface AILSSSettings {
    openInNewTab: boolean;
    defaultTags: string[];
    potentiateDelay: number;
    potentiateValue: number;
    maxPotentiation: number;
}

export const DEFAULT_SETTINGS: AILSSSettings = {
    openInNewTab: true,
    defaultTags: ['Initial'],
    potentiateDelay: 1440,
    potentiateValue: 1,
    maxPotentiation: 10
}