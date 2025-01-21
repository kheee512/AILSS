import { App, Notice, TFile } from 'obsidian';
import { showConfirmationDialog } from '../../../components/confirmationModal';

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

            const confirmed = await showConfirmationDialog(this.app, {
                message: "현재 노트의 첨부 파일들의 이름을 변경하시겠습니까?",
                title: "첨부 파일 이름 변경",
                confirmText: "변경",
                cancelText: "취소"
            });

            if (!confirmed) {
                new Notice("작업이 취소되었습니다.");
                return;
            }

            const content = await this.app.vault.read(currentFile);
            const attachmentPattern = /!\[\[([^\]]+)\]\]/g;
            const matches = Array.from(content.matchAll(attachmentPattern));
            
            if (matches.length === 0) {
                new Notice("첨부 파일이 없습니다.");
                return;
            }

            // 현재 존재하는 가장 큰 인덱스 찾기
            let maxIndex = 0;
            for (const match of matches) {
                const fileName = match[1];
                if (fileName.startsWith(currentFile.basename + '-')) {
                    const indexStr = fileName.split('-')[1]?.split('.')[0];
                    const index = parseInt(indexStr);
                    if (!isNaN(index) && index > maxIndex) {
                        maxIndex = index;
                    }
                }
            }

            let updatedContent = content;
            let changedCount = 0;

            for (const match of matches) {
                const oldFileName = match[1];
                const extension = oldFileName.split('.').pop() || '';
                const oldEmbed = match[0];

                // 파일명이 이미 올바른 형식인지 확인
                if (!oldFileName.startsWith(currentFile.basename + '-') || 
                    !oldFileName.split('-')[1]?.split('.')[0].match(/^\d+$/)) {
                    maxIndex++;
                    const newFileName = `${currentFile.basename}-${maxIndex}.${extension}`;
                    const newPath = `${currentFile.parent?.path || ''}/${newFileName}`;
                    const newEmbed = `![[${newFileName}]]`;

                    const oldFile = this.app.vault.getAbstractFileByPath(
                        `${currentFile.parent?.path || ''}/${oldFileName}`
                    );

                    if (oldFile instanceof TFile) {
                        await this.app.fileManager.renameFile(oldFile, newPath);
                        updatedContent = updatedContent.replace(oldEmbed, newEmbed);
                        changedCount++;
                    }
                }
            }

            await this.app.vault.modify(currentFile, updatedContent);
            new Notice(`${changedCount}개의 첨부 파일 이름이 변경되었습니다.`);

        } catch (error) {
            console.error("Error in RenameAttachments:", error);
            new Notice(`오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
