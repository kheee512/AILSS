import { App, Notice, TFile, TFolder } from 'obsidian';
import { showConfirmationDialog } from '../../components/confirmationModal';

export class ActivateNotes {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    async activateNotes(): Promise<void> {
        try {
            const deactivateFolder = this.app.vault.getAbstractFileByPath('deactivate');
            if (!(deactivateFolder instanceof TFolder)) {
                new Notice("비활성화된 노트가 없습니다.");
                return;
            }

            const deactivatedNotes = await this.findDeactivatedNotes(deactivateFolder);
            if (deactivatedNotes.length === 0) {
                new Notice("활성화할 노트를 찾을 수 없습니다.");
                return;
            }

            const confirmed = await showConfirmationDialog(this.app, {
                title: "활성화 확인",
                message: `${deactivatedNotes.length}개의 노트를 활성화하시겠습니까?`,
                confirmText: "활성화",
                cancelText: "취소"
            });

            if (!confirmed) {
                new Notice("작업이 취소되었습니다.");
                return;
            }

            let processedCount = 0;
            for (const note of deactivatedNotes) {
                try {
                    await this.moveNoteToActiveFolder(note);
                    processedCount++;
                    new Notice(`진행 상황: ${processedCount}/${deactivatedNotes.length}`);
                } catch (error) {
                    console.error(`Error processing note ${note.path}:`, error);
                    new Notice(`노트 처리 중 오류 발생: ${note.basename}`);
                }
            }

            // 빈 폴더 정리
            await this.cleanEmptyFolders(deactivateFolder);
            new Notice("모든 노트가 활성화되었습니다.");

        } catch (error) {
            console.error("Error in activateNotes:", error);
            new Notice(`오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async findDeactivatedNotes(folder: TFolder): Promise<TFile[]> {
        const notes: TFile[] = [];
        
        const processFolder = async (currentFolder: TFolder) => {
            for (const child of currentFolder.children) {
                if (child instanceof TFolder) {
                    await processFolder(child);
                } else if (child instanceof TFile && child.extension === 'md') {
                    notes.push(child);
                }
            }
        };

        await processFolder(folder);
        return notes;
    }

    private async moveNoteToActiveFolder(note: TFile): Promise<void> {
        const pathParts = note.path.split('/');
        const [, year, month, day, hour] = pathParts;
        const activePath = `${year}/${month}/${day}/${hour}`;
        
        // 대상 폴더 생성
        await this.createFolderIfNotExists(activePath);

        // 노트 이동
        const newPath = `${activePath}/${note.name}`;
        await this.app.vault.rename(note, newPath);

        // 첨부파일 이동
        await this.moveAttachments(note, activePath);
    }

    private async moveAttachments(note: TFile, targetPath: string): Promise<void> {
        const content = await this.app.vault.read(note);
        const attachmentRegex = /!\[\[(.*?)\]\]/g;
        let match;

        while ((match = attachmentRegex.exec(content)) !== null) {
            const attachmentPath = match[1].split('|')[0];
            const attachmentFile = this.app.vault.getAbstractFileByPath(attachmentPath);

            if (attachmentFile instanceof TFile) {
                const newPath = `${targetPath}/${attachmentFile.name}`;
                await this.app.vault.rename(attachmentFile, newPath);
            }
        }
    }

    private async createFolderIfNotExists(path: string): Promise<void> {
        if (!(await this.app.vault.adapter.exists(path))) {
            await this.app.vault.createFolder(path);
        }
    }

    private async cleanEmptyFolders(folder: TFolder): Promise<void> {
        const processFolder = async (currentFolder: TFolder): Promise<boolean> => {
            const children = currentFolder.children;
            let isEmpty = true;

            for (const child of children) {
                if (child instanceof TFolder) {
                    const childIsEmpty = await processFolder(child);
                    if (!childIsEmpty) isEmpty = false;
                } else {
                    isEmpty = false;
                }
            }

            if (isEmpty) {
                await this.app.vault.delete(currentFolder);
                return true;
            }

            return false;
        };

        await processFolder(folder);
        
        // deactivate 폴더가 비어있다면 삭제
        const deactivateFolder = this.app.vault.getAbstractFileByPath('deactivate');
        if (deactivateFolder instanceof TFolder && deactivateFolder.children.length === 0) {
            await this.app.vault.delete(deactivateFolder);
        }
    }
}
