import { App, Notice, TFile, Plugin, normalizePath } from 'obsidian';
import AILSSPlugin from 'main';

export class UpdateAttachments {
    private app: App;
    private plugin: AILSSPlugin;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async updateAttachments(): Promise<void> {
        try {
            const currentFile = this.app.workspace.getActiveFile();
            if (!currentFile) {
                new Notice("활성화된 파일이 없습니다.");
                return;
            }

            const content = await this.app.vault.read(currentFile);
            const attachmentPattern = /!\[\[(.*?)\]\]/g;
            const matches = Array.from(content.matchAll(attachmentPattern));
            
            if (matches.length === 0) {
                new Notice("첨부 파일을 찾을 수 없습니다.");
                return;
            }

            let updatedContent = content;
            let changedCount = 0;

            for (const match of matches) {
                try {
                    const originalEmbed = match[0];
                    const originalPath = match[1].split("|")[0].trim();
                    
                    if (originalPath.includes(`${currentFile.basename}-`)) {
                        continue;
                    }

                    const attachmentFile = this.app.vault.getAbstractFileByPath(originalPath);
                    if (!(attachmentFile instanceof TFile)) {
                        continue;
                    }

                    const newFileName = `${currentFile.basename}-${changedCount + 1}.${attachmentFile.extension}`;
                    const parentPath = attachmentFile.parent?.path || "";
                    const newPath = normalizePath(parentPath ? `${parentPath}/${newFileName}` : newFileName);

                    await this.app.fileManager.renameFile(attachmentFile, newPath);
                    
                    const newEmbed = `![[${newPath}]]`;
                    updatedContent = updatedContent.replace(originalEmbed, newEmbed);
                    changedCount++;

                } catch (e) {
                    console.error("파일 처리 중 오류:", e);
                    continue;
                }
            }

            if (changedCount > 0) {
                await this.app.vault.modify(currentFile, updatedContent);
                new Notice(`${changedCount}개의 첨부 파일 이름이 변경되었습니다.`);
            } else {
                new Notice("변경된 파일이 없습니다.");
            }

        } catch (error) {
            console.error("첨부 파일 업데이트 중 오류:", error);
            new Notice("첨부 파일 업데이트 중 오류가 발생했습니다.");
        }
    }
}
