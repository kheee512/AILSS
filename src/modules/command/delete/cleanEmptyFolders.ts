import { App, Notice, TFolder } from 'obsidian';
import type AILSSPlugin from '../../../../main';

export class CleanEmptyFolders {
    private static readonly DEACTIVATED_ROOT = 'deactivated';
    private app: App;
    private readonly MAX_DEPTH = 7;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
    }

    async cleanEmptyFoldersInVault(): Promise<void> {
        try {
            const emptyFolders = await this.findEmptyFolders();
            
            // deactivated 폴더 특별 처리
            const deactivatedFolder = this.app.vault.getAbstractFileByPath(CleanEmptyFolders.DEACTIVATED_ROOT);
            if (deactivatedFolder instanceof TFolder && deactivatedFolder.children.length === 0) {
                emptyFolders.push(deactivatedFolder);
            }

            if (emptyFolders.length === 0) {
                new Notice("삭제할 빈 폴더가 없습니다.");
                return;
            }

            for (const folder of emptyFolders) {
                await this.app.vault.delete(folder);
            }
            new Notice(`${emptyFolders.length}개의 빈 폴더가 정리되었습니다.`);
        } catch (error) {
            console.error("Error cleaning empty folders:", error);
            new Notice("빈 폴더 정리 중 오류가 발생했습니다.");
        }
    }

    private async findEmptyFolders(): Promise<TFolder[]> {
        const emptyFolders: TFolder[] = [];
        const rootFolder = this.app.vault.getRoot();
        await this.processFolder(rootFolder, 0, emptyFolders);
        return emptyFolders;
    }

    private async processFolder(folder: TFolder, depth: number, emptyFolders: TFolder[]): Promise<boolean> {
        if (depth >= this.MAX_DEPTH) return false;

        let isEmpty = true;
        const children = folder.children;

        // 하위 폴더 먼저 처리
        for (const child of children) {
            if (child instanceof TFolder) {
                const childIsEmpty = await this.processFolder(child, depth + 1, emptyFolders);
                if (!childIsEmpty) {
                    isEmpty = false;
                }
            } else {
                // 파일이 있으면 폴더가 비어있지 않음
                isEmpty = false;
            }
        }

        // 빈 폴더이고 루트 폴더가 아닌 경우 목록에 추가
        if (isEmpty && folder.path !== '/') {
            emptyFolders.push(folder);
        }

        return isEmpty;
    }
}
