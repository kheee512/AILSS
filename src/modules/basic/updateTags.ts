import { App, Notice, TFile } from 'obsidian';
import AILSSPlugin from '../../../main';

export class UpdateTags {
    private app: App;
    private plugin: AILSSPlugin;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async updateCurrentNoteTags(): Promise<void> {
        try {
            const currentFile = this.app.workspace.getActiveFile();
            if (!currentFile) {
                new Notice("활성화된 파일이 없습니다.");
                return;
            }

            const content = await this.app.vault.read(currentFile);
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            
            if (!frontmatterMatch) {
                new Notice("현재 노트에 frontmatter가 없습니다.");
                return;
            }

            const frontmatter = this.parseFrontmatter(frontmatterMatch[1]);
            const tags = frontmatter.tags || [];

            if (!Array.isArray(tags)) {
                new Notice("태그 형식이 올바르지 않습니다.");
                return;
            }

            await this.updateLinkedNotesTags(currentFile, tags);
            new Notice("태그 업데이트가 완료되었습니다.");

        } catch (error) {
            console.error("태그 업데이트 중 오류:", error);
            new Notice("태그 업데이트 중 오류가 발생했습니다.");
        }
    }

    private parseFrontmatter(frontmatterContent: string): { [key: string]: any } {
        const frontmatter: { [key: string]: any } = {};
        const lines = frontmatterContent.split('\n');

        let currentKey = '';
        for (const line of lines) {
            if (line.includes(':')) {
                const [key, value] = line.split(':').map(s => s.trim());
                if (key === 'tags') {
                    frontmatter[key] = [];
                    currentKey = key;
                } else {
                    frontmatter[key] = value;
                }
            } else if (line.trim().startsWith('-') && currentKey === 'tags') {
                frontmatter.tags.push(line.trim().substring(1).trim());
            }
        }

        return frontmatter;
    }

    private async updateLinkedNotesTags(sourceFile: TFile, tags: string[]): Promise<void> {
        const links = this.app.metadataCache.resolvedLinks[sourceFile.path] || {};
        
        for (const linkedPath of Object.keys(links)) {
            const linkedFile = this.app.vault.getAbstractFileByPath(linkedPath);
            if (linkedFile instanceof TFile) {
                await this.updateNoteTags(linkedFile, tags);
            }
        }
    }

    private async updateNoteTags(file: TFile, newTags: string[]): Promise<void> {
        const content = await this.app.vault.read(file);
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        
        if (!frontmatterMatch) return;

        const frontmatter = this.parseFrontmatter(frontmatterMatch[1]);
        
        // 기존 노트의 기본 태그는 유지하고, 새로운 태그에서 기본 태그를 제외
        const existingDefaultTags = (frontmatter.tags || []).filter((tag: string) => 
            this.plugin.settings.defaultTags.includes(tag)
        );
        const nonDefaultNewTags = newTags.filter(tag => 
            !this.plugin.settings.defaultTags.includes(tag)
        );
        
        // 기본 태그와 새로운 태그 합치기
        frontmatter.tags = [...existingDefaultTags, ...nonDefaultNewTags];

        const newFrontmatter = this.generateFrontmatter(frontmatter);
        const newContent = content.replace(/^---\n[\s\S]*?\n---/, newFrontmatter);

        await this.app.vault.modify(file, newContent);
    }

    private generateFrontmatter(frontmatter: { [key: string]: any }): string {
        let output = '---\n';
        
        for (const [key, value] of Object.entries(frontmatter)) {
            if (Array.isArray(value)) {
                output += `${key}:\n`;
                value.forEach(item => {
                    output += `  - ${item}\n`;
                });
            } else {
                output += `${key}: ${value}\n`;
            }
        }

        output += '---';
        return output;
    }
}
