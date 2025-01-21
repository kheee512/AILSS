import { App, Notice, TFile, TFolder } from 'obsidian';
import { showConfirmationDialog } from '../../../components/confirmationModal';
import { showTagSelectionDialog } from '../../../components/tagSelectionModal';
import { CleanEmptyFolders } from '../../maintenance/utils/cleanEmptyFolders';
import type AILSSPlugin from '../../../../main';
import { PathSettings } from '../../maintenance/settings/pathSettings';

export class ActivateNotes {
    private static readonly DEACTIVATED_ROOT = PathSettings.DEACTIVATED_ROOT;
    
    private app: App;
    private plugin: AILSSPlugin;
    private cleanEmptyFolders: CleanEmptyFolders;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.cleanEmptyFolders = new CleanEmptyFolders(this.app, this.plugin);
    }

    async activateNotes(): Promise<void> {
        try {
            if (!(await this.app.vault.adapter.exists(ActivateNotes.DEACTIVATED_ROOT))) {
                new Notice("비활성화된 노트 폴더가 존재하지 않습니다.");
                return;
            }

            // 태그 입력 받기 (실제로는 폴더명 입력)
            const tags = await showTagSelectionDialog(this.app, {
                title: "활성화할 폴더명 입력",
                placeholder: "비활성화된 노트들이 있는 폴더명을 입력하세요",
                confirmText: "검색",
                cancelText: "취소"
            });

            if (!tags || tags.length === 0) {
                new Notice("폴더명이 입력되지 않았습니다.");
                return;
            }

            // 태그를 폴더명 형식으로 변환
            const folderName = tags[0].replace(/^#/, '').replace(/\//g, '-');
            const fullPath = `${ActivateNotes.DEACTIVATED_ROOT}/${folderName}`;
            
            // 해당 폴더 찾기
            const folder = this.app.vault.getAbstractFileByPath(fullPath);
            if (!(folder instanceof TFolder)) {
                new Notice(`'${fullPath}' 폴더를 찾을 수 없습니다. 정확한 폴더명을 입력해주세요.`);
                return;
            }

            // 폴더 내의 노트들 찾기
            const deactivatedNotes = await this.findNotesInFolder(folder);
            if (deactivatedNotes.length === 0) {
                new Notice("활성화할 노트를 찾을 수 없습니다.");
                return;
            }

            const confirmed = await showConfirmationDialog(this.app, {
                title: "노트 활성화 확인",
                message: `'${fullPath}' 폴더에서 발견된 ${deactivatedNotes.length}개의 노트를 활성화하시겠습니까?`,
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
            await this.cleanEmptyFolders.cleanEmptyFoldersInVault();

            new Notice("모든 노트가 활성화되었습니다.");

        } catch (error) {
            console.error("Error in activateNotes:", error);
            new Notice(`오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async findNotesInFolder(folder: TFolder): Promise<TFile[]> {
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
        const [, , year, month, day, hour] = pathParts;
        const activePath = `${year}/${month}/${day}/${hour}`;
        
        // 대상 폴더 생성
        await this.createFolderIfNotExists(activePath);

        // 노트 내용 읽기
        const content = await this.app.vault.read(note);
        
        // 첨부파일 이동
        const attachmentRegex = /!\[\[(.*?)\]\]/g;
        let match;

        while ((match = attachmentRegex.exec(content)) !== null) {
            const attachmentName = match[1];
            const attachmentPath = `${note.parent?.path}/${attachmentName}`;
            const attachmentFile = this.app.vault.getAbstractFileByPath(attachmentPath);

            if (attachmentFile instanceof TFile) {
                const newAttachmentPath = `${activePath}/${attachmentFile.name}`;
                await this.app.vault.rename(attachmentFile, newAttachmentPath);
            }
        }

        // 노트 이동
        const newPath = `${activePath}/${note.name}`;
        await this.app.vault.rename(note, newPath);
    }

    private async createFolderIfNotExists(path: string): Promise<void> {
        if (!(await this.app.vault.adapter.exists(path))) {
            await this.app.vault.createFolder(path);
        }
    }
}
