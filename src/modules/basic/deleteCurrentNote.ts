import { App, Notice, TFile, TFolder } from 'obsidian';
import type AILSSPlugin from '../../../main';
import { showConfirmationDialog } from '../../components/confirmationModal';

export class DeleteCurrentNote {
    private app: App;
    private plugin: AILSSPlugin;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async deleteNote(): Promise<void> {
        try {
            const currentFile = this.app.workspace.getActiveFile();
            if (!currentFile) {
                new Notice("활성화된 파일이 없습니다.");
                return;
            }

            const shouldDelete = await showConfirmationDialog(this.app, {
                title: "노트 삭제 확인",
                message: "현재 노트를 삭제하고 관련된 모든 링크를 해제하시겠습니까?",
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

            // 현재 노트 삭제
            await this.app.vault.trash(currentFile, true);
            
            // 빈 폴더 정리
            await this.cleanEmptyFolders(currentFile.parent);

            new Notice("노트가 삭제되었고 관련 링크가 모두 해제되었습니다.");
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

    private async cleanEmptyFolders(folder: TFolder | null): Promise<void> {
        if (!folder) return;

        const isRootFolder = folder.path === '/';
        if (isRootFolder) return;

        const isEmpty = folder.children.length === 0;
        if (isEmpty) {
            try {
                await this.app.vault.delete(folder, true);
                await this.cleanEmptyFolders(folder.parent);
            } catch (error) {
                console.error("폴더 삭제 중 오류 발생:", error);
            }
        }
    }
}
