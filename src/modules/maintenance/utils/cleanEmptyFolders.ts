import { App, Notice, TFolder } from 'obsidian';
import type AILSSPlugin from '../../../../main';
import { PathSettings } from '../settings/pathSettings';

export class CleanEmptyFolders {
    private static readonly DEACTIVATED_ROOT = PathSettings.DEACTIVATED_ROOT;
    private app: App;
    private readonly MAX_DEPTH = PathSettings.MAX_FOLDER_DEPTH;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
    }

    async cleanEmptyFoldersInVault(): Promise<void> {
        try {
            const emptyFolders = await this.findEmptyFolders();
            
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
        
        // deactivated 폴더는 처리하지 않음
        if (folder.path === CleanEmptyFolders.DEACTIVATED_ROOT) {
            return false;
        }

        // 폴더의 실제 내용물을 확인
        const files = await this.app.vault.adapter.list(folder.path);
        const isEmpty = files.files.length === 0 && files.folders.length === 0;

        // 빈 폴더이고 루트 폴더가 아닌 경우에만 목록에 추가
        if (isEmpty && folder.path !== '/') {
            emptyFolders.push(folder);
        }

        return isEmpty;
    }
}
