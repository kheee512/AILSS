import { App, Notice, TFile } from 'obsidian';
import type AILSSPlugin from '../../../../main';
import { showConfirmationDialog } from '../../../components/confirmationModal';
import { CleanEmptyFolders } from '../../maintenance/utils/cleanEmptyFolders';
import { RemoveNoteLinks } from './removeNoteLinks';
import { FrontmatterManager } from '../../maintenance/utils/frontmatterManager';

export class DeleteCurrentNote {
    private app: App;
    private plugin: AILSSPlugin;
    private cleanEmptyFolders: CleanEmptyFolders;
    private removeNoteLinks: RemoveNoteLinks;
    private frontmatterManager: FrontmatterManager;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.cleanEmptyFolders = new CleanEmptyFolders(this.app, this.plugin);
        this.removeNoteLinks = new RemoveNoteLinks(this.app);
        this.frontmatterManager = new FrontmatterManager();
    }

    async deleteNote(): Promise<void> {
        try {
            const currentFile = this.app.workspace.getActiveFile();
            if (!currentFile) {
                new Notice("활성화된 파일이 없습니다.");
                return;
            }

            // 프론트매터에서 강화 단계 확인
            const content = await this.app.vault.read(currentFile);
            const frontmatter = this.frontmatterManager.parseFrontmatter(content);
            const potentiation = frontmatter?.potentiation ?? 0;

            // 강화 단계가 3~8 사이인지 확인
            if (potentiation < 3 || potentiation > 8) {
                new Notice(`강화 단계가 3~8 사이인 노트만 삭제할 수 있습니다. (현재: ${potentiation})`);
                return;
            }

            // 첨부파일 찾기
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
            const noteName = `${currentFile.name}`;
            const deleteMessage = attachments.length > 0
                ? `${attachments.length}개의 첨부파일을 포함하여 삭제하시겠습니까?`
                : `관련된 모든 링크를 해제하고 삭제하시겠습니까?`;
            
            const confirmMessage = `${noteName}\n\n${deleteMessage}`;

            const shouldDelete = await showConfirmationDialog(this.app, {
                title: "노트 삭제",
                message: confirmMessage,
                confirmText: "삭제",
                cancelText: "취소"
            });

            if (!shouldDelete) {
                new Notice("작업이 취소되었습니다.");
                return;
            }

            // 백링크 처리
            await this.removeNoteLinks.removeLinksToFile(currentFile);

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
}
