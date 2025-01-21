import { moment } from 'obsidian';
import type AILSSPlugin from 'main';

export class FrontmatterManager {
    constructor(private plugin: AILSSPlugin) {}

    generateFrontmatter(additionalFields: Record<string, any> = {}): string {
        const now = moment();
        
        // 기본 프론트매터 필드 정의
        const defaultFields = {
            ID: now.format('YYMMDDHHmmss'),
            Potentiation: 0,
            Activated: now.format('YYYY-MM-DDTHH:mm:ss'),
            tags: this.plugin.settings.defaultTags
        };

        // 추가 필드들과 병합
        const mergedFields = { ...defaultFields, ...additionalFields };

        // YAML 형식으로 변환
        let yaml = '---\n';
        Object.entries(mergedFields).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                yaml += `${key}:\n${value.map(v => `  - ${v}`).join('\n')}\n`;
            } else {
                yaml += `${key}: ${value}\n`;
            }
        });
        yaml += '---\n';

        return yaml;
    }

    parseFrontmatter(content: string): Record<string, any> | null {
        const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
        const match = content.match(frontMatterRegex);
        if (!match) return null;

        const frontmatter: Record<string, any> = {};
        const lines = match[1].split('\n');
        
        let currentKey: string | null = null;
        let currentArray: string[] = [];

        lines.forEach(line => {
            if (line.trim() === '') return;

            if (line.startsWith('  - ')) {
                if (currentKey) {
                    currentArray.push(line.substring(4));
                }
            } else {
                if (currentKey && currentArray.length > 0) {
                    frontmatter[currentKey] = currentArray;
                    currentArray = [];
                }

                const [key, ...values] = line.split(':').map(s => s.trim());
                if (key && values.length > 0) {
                    currentKey = key;
                    const value = values.join(':');
                    if (value.trim() === '') {
                        currentArray = [];
                    } else {
                        frontmatter[key] = value;
                        currentKey = null;
                    }
                }
            }
        });

        if (currentKey && currentArray.length > 0) {
            frontmatter[currentKey] = currentArray;
        }

        return frontmatter;
    }

    updateFrontmatter(content: string, updates: Record<string, any>): string {
        const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
        const match = content.match(frontMatterRegex);
        
        if (!match) return content;

        const currentFrontmatter = this.parseFrontmatter(content) || {};
        const updatedFrontmatter = { ...currentFrontmatter, ...updates };
        const newFrontmatter = this.generateFrontmatter(updatedFrontmatter);

        return content.replace(frontMatterRegex, newFrontmatter);
    }
} 