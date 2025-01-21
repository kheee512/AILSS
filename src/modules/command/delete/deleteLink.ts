import { App, Notice, TFile, TFolder } from 'obsidian';
import type AILSSPlugin from '../../../../main';
import { showConfirmationDialog } from '../../../components/confirmationModal';
import { CleanEmptyFolders } from './cleanEmptyFolders';

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

        try {
            const fileToDelete = this.app.vault.getAbstractFileByPath(filePath);
            if (fileToDelete instanceof TFile) {
                // 사용자 확인 추가
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

                await this.app.vault.trash(fileToDelete, true);
                editor.replaceSelection('');
                new Notice('파일이 삭제되었습니다.');

                // CleanEmptyFolders 모듈 사용
                await this.cleanEmptyFolders.cleanEmptyFoldersInVault();
            } else {
                new Notice(`파일을 찾을 수 없습니다: ${filePath}`);
            }
        } catch (error) {
            console.error('파일 삭제 중 오류 발생:', error);
            new Notice('파일 삭제에 실패했습니다.');
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
                // 첨부파일은 현재 노트와 같은 경로에 있음
                const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));
                return `${currentDir}/${match[1]}`;
            }
        } else {
            match = text.match(/\[\[(.*?)(?:\|.*?)?\]\]/);
            if (match) {
                // 노트 경로가 이미 완전한 경로인 경우
                return match[1].endsWith('.md') ? match[1] : `${match[1]}.md`;
            }
        }
        return null;
    }
}
