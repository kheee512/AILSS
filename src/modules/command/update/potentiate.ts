import { App, Notice } from 'obsidian';
import type AILSSPlugin from '../../../../main';
import { FrontmatterManager } from '../../maintenance/frontmatterManager';

export class Potentiate {
    private app: App;
    private plugin: AILSSPlugin;
    private frontmatterManager: FrontmatterManager;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.frontmatterManager = new FrontmatterManager(this.plugin);
    }

    async potentiateNote() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('활성화된 노트가 없습니다.');
            return;
        }

        const fileContent = await this.app.vault.read(activeFile);
        const frontmatter = this.frontmatterManager.parseFrontmatter(fileContent);

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
        const formattedDate = now.toISOString().replace(/\.\d{3}Z$/, '');

        const updatedContent = this.frontmatterManager.updateFrontmatter(fileContent, {
            Potentiation: newPotentiation,
            Activated: formattedDate
        });

        await this.app.vault.modify(activeFile, updatedContent);
        new Notice(`강화 완료! (${currentPotentiation} → ${newPotentiation})`);
    }
}