import { App, Notice, TFile } from 'obsidian';
import type AILSSPlugin from '../../../../main';
import { showConfirmationDialog } from '../../../components/confirmationModal';
import { CleanEmptyFolders } from '../../maintenance/utils/cleanEmptyFolders';

export class DeleteCurrentNote {
    private app: App;
    private plugin: AILSSPlugin;
    private cleanEmptyFolders: CleanEmptyFolders;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.cleanEmptyFolders = new CleanEmptyFolders(this.app, this.plugin);
    }

    async deleteNote(): Promise<void> {
        try {
            const currentFile = this.app.workspace.getActiveFile();
            if (!currentFile) {
                new Notice("활성화된 파일이 없습니다.");
                return;
            }

            // 첨부파일 찾기
            const content = await this.app.vault.read(currentFile);
            const attachmentRegex = /!\[\[(.*?)\]\]/g;
            const attachments: TFile[] = [];
            let match;

            while ((match = attachmentRegex.exec(content)) !== null) {
                const attachmentPath = match[1];
                const attachmentFile = this.app.vault.getAbstractFileByPath(attachmentPath);
                
                if (attachmentFile instanceof TFile) {
                    attachments.push(attachmentFile);
                }
            }

            // 삭제 확인 메시지 수정
            const confirmMessage = attachments.length > 0
                ? `현재 노트와 연결된 ${attachments.length}개의 첨부파일을 포함하여 삭제하시겠습니까?`
                : "현재 노트를 삭제하고 관련된 모든 링크를 해제하시겠습니까?";

            const shouldDelete = await showConfirmationDialog(this.app, {
                title: "노트 삭제 확인",
                message: confirmMessage,
                confirmText: "삭제",
                cancelText: "취소"
            });

            if (!shouldDelete) {
                new Notice("작업이 취소되었습니다.");
                return;
            }

            // 현재 노트를 참조하는 모든 노트 찾기
            const linkedFiles = this.app.metadataCache.resolvedLinks;
            for (const [sourcePath, links] of Object.entries(linkedFiles)) {
                if (links[currentFile.path]) {
                    const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
                    if (sourceFile instanceof TFile) {
                        await this.removeLinksToFile(sourceFile, currentFile.basename);
                    }
                }
            }

            // 첨부파일 삭제
            for (const attachment of attachments) {
                await this.app.vault.trash(attachment, true);
            }

            // 현재 노트 삭제
            await this.app.vault.trash(currentFile, true);
            
            // 빈 폴더 정리
            await this.cleanEmptyFolders.cleanEmptyFoldersInVault();

            const message = attachments.length > 0
                ? `노트와 ${attachments.length}개의 첨부파일이 삭제되었고 관련 링크가 모두 해제되었습니다.`
                : "노트가 삭제되었고 관련 링크가 모두 해제되었습니다.";

            new Notice(message);
        } catch (error) {
            console.error("노트 삭제 중 오류 발생:", error);
            new Notice(`오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async removeLinksToFile(sourceFile: TFile, targetBasename: string): Promise<void> {
        let content = await this.app.vault.read(sourceFile);
        
        // 일반 위키링크와 임베드 링크 모두 처리
        const wikiLinkRegex = new RegExp(`!?\\[\\[${targetBasename}(?:\\|[^\\]]*)?\\]\\]`, 'g');
        
        content = content.replace(wikiLinkRegex, (match) => {
            const linkMatch = match.match(/!?\[\[(.*?)(?:\|(.*?))?\]\]/);
            return linkMatch ? (linkMatch[2] || linkMatch[1]) : match;
        });

        await this.app.vault.modify(sourceFile, content);
    }
}
