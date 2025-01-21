import { App, Notice, TFolder, TAbstractFile } from 'obsidian';
import { showConfirmationDialog } from '../../../components/confirmationModal';
import type AILSSPlugin from '../../../../main';

export class CleanEmptyFolders {
    private app: App;
    private plugin: AILSSPlugin;
    private readonly MAX_DEPTH = 6;
    private deletedFolders: string[] = [];

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async cleanEmptyFoldersInVault(): Promise<void> {
        try {
            const emptyFolders = await this.findEmptyFolders();
            if (emptyFolders.length === 0) {
                return;
            }

            let shouldProceed = true;
            if (this.plugin.settings.showCleanFoldersConfirm) {
                shouldProceed = await showConfirmationDialog(this.app, {
                    title: "빈 폴더 정리",
                    message: `${emptyFolders.length}개의 빈 폴더를 정리하시겠습니까?`,
                    confirmText: "정리",
                    cancelText: "취소"
                });
            }

            if (shouldProceed) {
                for (const folder of emptyFolders) {
                    await this.app.vault.delete(folder);
                }
                new Notice(`${emptyFolders.length}개의 빈 폴더가 정리되었습니다.`);
            }
        } catch (error) {
            console.error("Error cleaning empty folders:", error);
            new Notice("빈 폴더 정리 중 오류가 발생했습니다.");
        }
    }

    private async processFolder(folder: TFolder, depth: number): Promise<boolean> {
        if (depth >= this.MAX_DEPTH) return false;

        let isEmpty = true;
        const children = folder.children;

        // 하위 폴더 먼저 처리
        for (const child of children) {
            if (child instanceof TFolder) {
                const childIsEmpty = await this.processFolder(child, depth + 1);
                if (!childIsEmpty) {
                    isEmpty = false;
                }
            } else {
                // 파일이 있으면 폴더가 비어있지 않음
                isEmpty = false;
            }
        }

        // 빈 폴더이고 루트 폴더가 아닌 경우 삭제
        if (isEmpty && folder.path !== '/') {
            try {
                await this.app.vault.delete(folder);
                this.deletedFolders.push(folder.path);
                return true;
            } catch (error) {
                console.error(`폴더 삭제 중 오류 발생 (${folder.path}):`, error);
                return false;
            }
        }

        return isEmpty;
    }

    private async getUserConfirmation(): Promise<boolean> {
        return showConfirmationDialog(this.app, {
            title: "빈 폴더 정리",
            message: "볼트 내의 모든 빈 폴더를 정리하시겠습니까?",
            confirmText: "정리",
            cancelText: "취소"
        });
    }

    private handleCleanupResult(): void {
        if (this.deletedFolders.length > 0) {
            this.showNotice(`${this.deletedFolders.length}개의 빈 폴더가 삭제되었습니다.`);
            console.log("삭제된 폴더:", this.deletedFolders);
        } else {
            this.showNotice("삭제할 빈 폴더가 없습니다.");
        }
    }

    private handleError(error: unknown): void {
        console.error("폴더 정리 중 오류 발생:", error);
        this.showNotice("폴더 정리 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
    }

    private showNotice(message: string): void {
        new Notice(message);
    }

    private async findEmptyFolders(): Promise<TFolder[]> {
        const emptyFolders: TFolder[] = [];
        const rootFolder = this.app.vault.getRoot();
        await this.processFolder(rootFolder, 0);
        return emptyFolders;
    }
}
