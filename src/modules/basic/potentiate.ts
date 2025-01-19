import { App, Notice, TFile } from 'obsidian';
import type AILSSPlugin from '../../../main';

export class Potentiate {
    private app: App;
    private plugin: AILSSPlugin;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async potentiateNote() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('활성화된 노트가 없습니다.');
            return;
        }

        const fileContent = await this.app.vault.read(activeFile);
        const frontmatter = this.parseFrontMatter(fileContent);

        if (!frontmatter) {
            new Notice('프론트매터가 없는 노트입니다.');
            return;
        }

        const currentPotentiation = Number(frontmatter.Potentiation) || 0;
        const lastActivated = frontmatter.Activated ? new Date(frontmatter.Activated) : null;

        // 최대 강화 지수 체크
        if (currentPotentiation >= this.plugin.settings.maxPotentiation) {
            new Notice('이미 최대 강화 지수에 도달했습니다.');
            return;
        }

        // 대기 시간 체크
        if (lastActivated) {
            const minutesSinceLastActivation = (new Date().getTime() - lastActivated.getTime()) / (1000 * 60);
            if (minutesSinceLastActivation < this.plugin.settings.potentiateDelay) {
                new Notice(`강화까지 ${Math.ceil(this.plugin.settings.potentiateDelay - minutesSinceLastActivation)}분 남았습니다.`);
                return;
            }
        }

        // 강화 수행
        const newPotentiation = currentPotentiation + this.plugin.settings.potentiateValue;
        const now = new Date();
        const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        
        const newContent = this.updateFrontMatter(fileContent, {
            Potentiation: newPotentiation,
            Activated: formattedDate
        });

        await this.app.vault.modify(activeFile, newContent);
        new Notice(`강화 완료! (${currentPotentiation} → ${newPotentiation})`);
    }

    private parseFrontMatter(content: string): any {
        const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
        const match = content.match(frontMatterRegex);
        if (!match) return null;

        const frontMatter: any = {};
        const lines = match[1].split('\n');
        
        lines.forEach(line => {
            const [key, ...values] = line.split(':').map(s => s.trim());
            if (key && values.length > 0) {
                frontMatter[key] = values.join(':');
            }
        });

        return frontMatter;
    }

    private updateFrontMatter(content: string, updates: Record<string, any>): string {
        const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
        const match = content.match(frontMatterRegex);
        
        if (!match) return content;

        let frontMatter = match[1];
        Object.entries(updates).forEach(([key, value]) => {
            const regex = new RegExp(`^${key}:.*$`, 'm');
            if (frontMatter.match(regex)) {
                frontMatter = frontMatter.replace(regex, `${key}: ${value}`);
            } else {
                frontMatter += `\n${key}: ${value}`;
            }
        });

        return content.replace(frontMatterRegex, `---\n${frontMatter}\n---`);
    }
}