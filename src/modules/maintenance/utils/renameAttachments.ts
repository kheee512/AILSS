import { App, Notice, TFile } from 'obsidian';
import { PathSettings } from '../settings/pathSettings';

export class RenameAttachments {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    async renameAttachments(): Promise<void> {
        try {
            const currentFile = this.app.workspace.getActiveFile();
            if (!currentFile) {
                throw new Error("활성화된 파일이 없습니다.");
            }

            const content = await this.app.vault.read(currentFile);
            const attachmentPattern = /!\[\[(.*?)\]\]/g;
            const matches = Array.from(content.matchAll(attachmentPattern));
            
            if (matches.length === 0) {
                return;
            }

            let updatedContent = content;
            let changedCount = 0;

            // 현재 노트의 디렉토리 경로
            const currentDir = currentFile.parent?.path || '';

            for (let i = 0; i < matches.length; i++) {
                const match = matches[i];
                const attachmentName = match[1];
                const oldEmbed = match[0];
                
                // 이미 이름이 변경된 파일은 건너뛰기 (파일명이 노트이름-숫자 형식인 경우)
                if (attachmentName.includes(`${currentFile.basename}-`)) {
                    continue;
                }

                const extension = attachmentName.split('.').pop() || '';
                const attachmentFile = this.app.vault.getAbstractFileByPath(attachmentName);

                if (attachmentFile instanceof TFile) {
                    // 첨부파일 이름 생성 로직 개선
                    const newFileName = `${currentFile.basename}-${i + 1}${extension ? `.${extension}` : PathSettings.DEFAULT_FILE_EXTENSION}`;
                    // 새 파일의 절대 경로 생성
                    const newPath = currentDir ? `${currentDir}/${newFileName}` : newFileName;
                    // 절대 경로를 포함한 새 임베드 생성
                    const newEmbed = `![[${newPath}]]`;

                    await this.app.fileManager.renameFile(attachmentFile, newPath);
                    updatedContent = updatedContent.replace(oldEmbed, newEmbed);
                    changedCount++;
                }
            }

            if (changedCount > 0) {
                await this.app.vault.modify(currentFile, updatedContent);
                new Notice(`${changedCount}개의 첨부 파일 이름이 변경되었습니다.`);
            }

        } catch (error) {
            console.error("Error in RenameAttachments:", error);
            new Notice(`오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
