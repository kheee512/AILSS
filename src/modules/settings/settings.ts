// ... existing code ...
export interface FrontmatterField {
    key: string;
    value: string | number | string[];
    enabled: boolean;
}

export interface AILSSSettings {
    openInNewTab: boolean;
    showCleanFoldersConfirm: boolean;
}

export const DEFAULT_SETTINGS: AILSSSettings = {
    openInNewTab: true,
    showCleanFoldersConfirm: true,
}