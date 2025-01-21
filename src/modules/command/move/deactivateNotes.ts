import { App, Notice, TFile, Modal } from 'obsidian';
import { showConfirmationDialog } from '../../../components/confirmationModal';
import { showTagSelectionDialog } from '../../../components/tagSelectionModal';
import { CleanEmptyFolders } from '../delete/cleanEmptyFolders';
import type AILSSPlugin from '../../../../main';

export class DeactivateNotes {
    private app: App;
    private plugin: AILSSPlugin;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async deactivateNotesByTag(): Promise<void> {
        try {
            const tags = await this.showTagSelectionModal();
            if (!tags || tags.length === 0) {
                new Notice("태그가 선택되지 않았습니다.");
                return;
            }

            const notesToDeactivate = this.findNotesByTags(tags);
            if (notesToDeactivate.size === 0) {
                new Notice("선택한 태그를 가진 노트를 찾을 수 없습니다.");
                return;
            }

            const confirmed = await showConfirmationDialog(this.app, {
                title: "비활성화 확인",
                message: `선택한 태그(${tags.join(', ')})를 가진 ${notesToDeactivate.size}개의 노트를 비활성화하시겠습니까?`,
                confirmText: "비활성화",
                cancelText: "취소"
            });

            if (!confirmed) {
                new Notice("작업이 취소되었습니다.");
                return;
            }

            let processedCount = 0;
            for (const note of notesToDeactivate) {
                try {
                    await this.moveNoteToDeactivateFolder(note, tags);
                    processedCount++;
                    new Notice(`진행 상황: ${processedCount}/${notesToDeactivate.size}`);
                } catch (error) {
                    console.error(`Error processing note ${note.path}:`, error);
                    new Notice(`노트 처리 중 오류 발생: ${note.basename}`);
                }
            }

            // 빈 폴더 정리
            const cleanEmptyFolders = new CleanEmptyFolders(this.app, this.plugin);
            await cleanEmptyFolders.cleanEmptyFoldersInVault();

            new Notice("모든 노트가 비활성화되었습니다.");
        } catch (error) {
            console.error("Error in deactivateNotesByTag:", error);
            new Notice(`오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async moveNoteToDeactivateFolder(note: TFile, tags: string[]): Promise<void> {
        const now = new Date();
        const mainTag = tags[0].replace(/^#/, '').replace(/\//g, '-');
        const year = String(now.getFullYear()).slice(-2);
        const deactivatePath = `${mainTag}/${year}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${String(now.getHours()).padStart(2, '0')}`;
        
        // 대상 폴더 생성
        await this.createFolderIfNotExists(deactivatePath);

        // 노트 내용 읽기
        const content = await this.app.vault.read(note);
        
        // 첨부파일 찾기 및 이동
        const attachmentRegex = /!\[\[(.*?)\]\]/g;
        let match;

        // 현재 노트의 디렉토리 경로
        const currentDir = note.parent?.path || '';

        while ((match = attachmentRegex.exec(content)) !== null) {
            const attachmentName = match[1];
            // 현재 노트 디렉토리에서 첨부파일 찾기
            const attachmentPath = currentDir ? `${currentDir}/${attachmentName}` : attachmentName;
            const attachmentFile = this.app.vault.getAbstractFileByPath(attachmentPath);

            if (attachmentFile instanceof TFile) {
                const newAttachmentPath = `${deactivatePath}/${attachmentFile.name}`;
                // 첨부파일 이동
                await this.app.vault.rename(attachmentFile, newAttachmentPath);
                // 노트 내용의 링크는 그대로 유지 (이미 상대 경로 형식이므로)
            }
        }

        // 노트 이동
        const newPath = `${deactivatePath}/${note.name}`;
        await this.app.vault.rename(note, newPath);
    }

    private async createFolderIfNotExists(path: string): Promise<void> {
        if (!(await this.app.vault.adapter.exists(path))) {
            await this.app.vault.createFolder(path);
        }
    }

    private findNotesByTags(tags: string[]): Set<TFile> {
        const notes = new Set<TFile>();
        
        this.app.vault.getFiles().forEach(file => {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache?.frontmatter?.tags) {
                const fileTags = Array.isArray(cache.frontmatter.tags) 
                    ? cache.frontmatter.tags 
                    : [cache.frontmatter.tags];
                
                if (tags.some(inputTag => 
                    fileTags.some(fileTag => 
                        fileTag.startsWith(inputTag.replace(/^#/, ''))
                    )
                )) {
                    notes.add(file);
                }
            }
        });
        
        return notes;
    }

    private async showTagSelectionModal(): Promise<string[]> {
        return showTagSelectionDialog(this.app, {
            title: "비활성화할 노트의 태그 입력",
            placeholder: "태그를 입력하세요 (쉼표로 구분)",
            confirmText: "비활성화",
            cancelText: "취소"
        });
    }
}
