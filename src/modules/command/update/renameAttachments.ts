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

            const content = await this.app.vault.read(currentFile);
            const attachmentPattern = /!\[\[(.*?)\]\]/g;
            const matches = Array.from(content.matchAll(attachmentPattern));
            
            if (matches.length === 0) {
                new Notice("첨부 파일이 없습니다.");
                return;
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

            let updatedContent = content;
            let changedCount = 0;

            // 현재 노트의 디렉토리 경로
            const currentDir = currentFile.parent?.path || '';

            for (let i = 0; i < matches.length; i++) {
                const match = matches[i];
                const attachmentName = match[1];
                const oldEmbed = match[0];
                const extension = attachmentName.split('.').pop() || '';
                
                // 현재 노트와 같은 디렉토리에서 첨부파일 찾기
                const attachmentPath = currentDir ? `${currentDir}/${attachmentName}` : attachmentName;
                const attachmentFile = this.app.vault.getAbstractFileByPath(attachmentPath);

                if (attachmentFile instanceof TFile) {
                    // 현재 노트 이름 + 인덱스로 새 파일명 생성
                    const newFileName = `${currentFile.basename}-${i + 1}.${extension}`;
                    // 현재 노트의 디렉토리에 새 파일 경로 생성
                    const newPath = currentDir ? `${currentDir}/${newFileName}` : newFileName;
                    const newEmbed = `![[${newFileName}]]`;

                    await this.app.fileManager.renameFile(attachmentFile, newPath);
                    updatedContent = updatedContent.replace(oldEmbed, newEmbed);
                    changedCount++;
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
