import { App, Notice, TFile, Modal } from 'obsidian';
import { showConfirmationDialog } from '../../components/confirmationModal';

export class DeactivateNotes {
    private app: App;

    constructor(app: App) {
        this.app = app;
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
                    await this.moveNoteToDeactivateFolder(note);
                    processedCount++;
                    new Notice(`진행 상황: ${processedCount}/${notesToDeactivate.size}`);
                } catch (error) {
                    console.error(`Error processing note ${note.path}:`, error);
                    new Notice(`노트 처리 중 오류 발생: ${note.basename}`);
                }
            }

            new Notice("모든 노트가 비활성화되었습니다.");
        } catch (error) {
            console.error("Error in deactivateNotesByTag:", error);
            new Notice(`오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async moveNoteToDeactivateFolder(note: TFile): Promise<void> {
        const now = new Date();
        const deactivatePath = `deactivate/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${String(now.getHours()).padStart(2, '0')}`;
        
        // 대상 폴더 생성
        await this.createFolderIfNotExists(deactivatePath);

        // 노트 이동
        const newPath = `${deactivatePath}/${note.name}`;
        await this.app.vault.rename(note, newPath);

        // 첨부파일 이동
        await this.moveAttachments(note, deactivatePath);
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
        return new Promise((resolve) => {
            new TagSelectionModal(this.app, resolve).open();
        });
    }
}

class TagSelectionModal extends Modal {
    private onSubmit: (tags: string[]) => void;

    constructor(app: App, onSubmit: (tags: string[]) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        const container = contentEl.createDiv({
            cls: "modal-container",
            attr: { style: "padding: 1rem;" }
        });

        container.createEl("h3", {
            text: "비활성화할 노트의 태그 입력",
            attr: { style: "margin-bottom: 1rem;" }
        });

        const input = container.createEl("input", {
            type: "text",
            attr: {
                placeholder: "태그를 입력하세요 (쉼표로 구분)",
                style: "width: 100%; margin-bottom: 1rem;"
            }
        });

        const buttonContainer = container.createDiv({
            attr: { style: "display: flex; justify-content: flex-end; gap: 0.5rem;" }
        });

        buttonContainer.createEl("button", { text: "취소" })
            .onclick = () => {
                this.close();
                this.onSubmit([]);
            };

        buttonContainer.createEl("button", { text: "확인", cls: "mod-cta" })
            .onclick = () => {
                const tags = input.value.split(',').map(t => t.trim()).filter(t => t);
                this.close();
                this.onSubmit(tags);
            };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
