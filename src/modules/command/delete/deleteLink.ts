import { App, Notice, TFile, TFolder } from 'obsidian';
import type AILSSPlugin from '../../../../main';
import { showConfirmationDialog } from '../../../components/confirmationModal';
import { CleanEmptyFolders } from '../../maintenance/utils/cleanEmptyFolders';
import { PathSettings } from '../../maintenance/settings/pathSettings';

export class DeleteLink {
    private app: App;
    private plugin: AILSSPlugin;
    private cleanEmptyFolders: CleanEmptyFolders;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.cleanEmptyFolders = new CleanEmptyFolders(this.app, this.plugin);
    }

    async deleteLink() {
        try {
            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice('활성화된 노트가 없습니다.');
                return;
            }

            const editor = this.app.workspace.activeEditor?.editor;
            if (!editor) {
                new Notice('에디터를 찾을 수 없습니다.');
                return;
            }

            const selectedText = editor.getSelection();
            if (!selectedText) {
                new Notice('텍스트가 선택되지 않았습니다.');
                return;
            }

            const linkType = this.identifyLinkType(selectedText);
            if (!linkType) {
                new Notice('선택된 텍스트에서 유효한 링크를 찾을 수 없습니다.');
                return;
            }

            const filePath = this.extractFilePath(selectedText, linkType, activeFile.path);
            if (!filePath) {
                new Notice('파일 경로를 추출할 수 없습니다.');
                return;
            }

            const fileToDelete = this.app.vault.getAbstractFileByPath(filePath);
            if (fileToDelete instanceof TFile) {
                const confirmed = await showConfirmationDialog(this.app, {
                    title: "링크 삭제 확인",
                    message: `"${fileToDelete.basename}"${linkType === 'attachment' ? ' 첨부파일' : ' 노트'}을(를) 삭제하시겠습니까?`,
                    confirmText: "삭제",
                    cancelText: "취소"
                });

                if (!confirmed) {
                    new Notice("작업이 취소되었습니다.");
                    return;
                }

                try {
                    await this.app.vault.delete(fileToDelete);
                } catch (deleteError) {
                    new Notice('파일 삭제에 실패했습니다. 오류: ' + deleteError.message);
                    new Notice('trash로 시도합니다.');
                    await this.app.vault.trash(fileToDelete, false);
                }
            }
            
            // 파일 존재 여부와 관계없이 링크 텍스트 처리
            if (linkType === 'attachment') {
                editor.replaceSelection('');
            } else {
                const titleMatch = selectedText.match(/\[\[(.*?)(?:\|.*?)?\]\]/);
                if (titleMatch) {
                    const fullPath = titleMatch[1];
                    if (fullPath.includes('|')) {
                        const alias = fullPath.split('|')[1];
                        editor.replaceSelection(alias);
                    } else {
                        const noteName = fullPath.split('/').pop()?.replace(/\.md$/, '') || '';
                        editor.replaceSelection(noteName);
                    }
                }
            }
            
            if (fileToDelete instanceof TFile) {
                new Notice('파일이 삭제되었습니다.');
                await this.cleanEmptyFolders.cleanEmptyFoldersInVault();
            } else {
                new Notice(`파일이 이미 삭제되었거나 존재하지 않습니다: ${filePath}`);
            }
        } catch (error) {
            console.error('파일 삭제 중 오류 발생:', error);
            new Notice('파일 삭제에 실패했습니다. 오류: ' + error.message);
        }
    }

    private identifyLinkType(text: string): 'note' | 'attachment' | null {
        if (text.match(/!\[\[.*?\]\]/)) return 'attachment';
        if (text.match(/\[\[.*?\]\]/)) return 'note';
        return null;
    }

    private extractFilePath(text: string, type: 'note' | 'attachment', currentPath: string): string | null {
        let match;
        if (type === 'attachment') {
            match = text.match(/!\[\[(.*?)(?:\|.*?)?\]\]/);
            if (match) {
                // 첨부파일 경로가 이미 완전한 경로인 경우 (예: YY-MM/DD/HH/파일명)
                const filePath = match[1];
                if (PathSettings.isValidPath(filePath)) {
                    return filePath;
                }
                // 기존 상대 경로 처리
                const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));
                return `${currentDir}/${filePath}`;
            }
        } else {
            match = text.match(/\[\[(.*?)(?:\|.*?)?\]\]/);
            if (match) {
                const filePath = match[1];
                // 노트 경로가 이미 완전한 경로인 경우 (예: YY-MM/DD/HH/노트명)
                if (PathSettings.isValidPath(filePath)) {
                    return filePath.endsWith(PathSettings.DEFAULT_FILE_EXTENSION)
                        ? filePath
                        : `${filePath}${PathSettings.DEFAULT_FILE_EXTENSION}`;
                }
                // 기존 상대 경로 처리
                return filePath.endsWith(PathSettings.DEFAULT_FILE_EXTENSION)
                    ? filePath
                    : `${filePath}${PathSettings.DEFAULT_FILE_EXTENSION}`;
            }
        }
        return null;
    }
}
