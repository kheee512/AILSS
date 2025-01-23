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

            // 모든 링크 찾기
            const links = this.findAllLinks(selectedText);
            if (links.length === 0) {
                new Notice('선택된 텍스트에서 유효한 링크를 찾을 수 없습니다.');
                return;
            }

            // 삭제할 파일 정보 수집
            const filesToDelete: Array<{file: TFile, type: 'note' | 'attachment', originalText: string}> = [];
            for (const link of links) {
                const filePath = this.extractFilePath(link.text, link.type, activeFile.path);
                if (filePath) {
                    const file = this.app.vault.getAbstractFileByPath(filePath);
                    if (file instanceof TFile) {
                        filesToDelete.push({file, type: link.type, originalText: link.text});
                    }
                }
            }

            if (filesToDelete.length > 0) {
                const message = filesToDelete.length === 1 
                    ? `"${filesToDelete[0].file.basename}"${filesToDelete[0].type === 'attachment' ? ' 첨부파일' : ' 노트'}을(를) 삭제하시겠습니까?`
                    : `${filesToDelete.length}개의 파일을 삭제하시겠습니까?\n\n${filesToDelete.map(f => `- ${f.file.basename}`).join('\n')}`;

                const confirmed = await showConfirmationDialog(this.app, {
                    title: "링크 삭제 확인",
                    message,
                    confirmText: "삭제",
                    cancelText: "취소"
                });

                if (!confirmed) {
                    new Notice("작업이 취소되었습니다.");
                    return;
                }

                // 파일 삭제 및 링크 텍스트 처리
                let modifiedText = selectedText;
                for (const {file, type, originalText} of filesToDelete) {
                    try {
                        await this.app.vault.delete(file);
                    } catch (deleteError) {
                        new Notice(`${file.basename} 삭제 실패. trash로 시도합니다.`);
                        await this.app.vault.trash(file, false);
                    }

                    // 링크 텍스트 처리
                    if (type === 'attachment') {
                        modifiedText = modifiedText.replace(originalText, '');
                    } else {
                        const titleMatch = originalText.match(/\[\[(.*?)(?:\|.*?)?\]\]/);
                        if (titleMatch) {
                            const fullPath = titleMatch[1];
                            const replacement = fullPath.includes('|') 
                                ? fullPath.split('|')[1]
                                : fullPath.split('/').pop()?.replace(/\.md$/, '') || '';
                            modifiedText = modifiedText.replace(originalText, replacement);
                        }
                    }
                }

                editor.replaceSelection(modifiedText);
                new Notice(`${filesToDelete.length}개의 파일이 삭제되었습니다.`);
                await this.cleanEmptyFolders.cleanEmptyFoldersInVault();
            } else {
                new Notice('삭제할 파일을 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('파일 삭제 중 오류 발생:', error);
            new Notice('파일 삭제에 실패했습니다. 오류: ' + error.message);
        }
    }

    private findAllLinks(text: string): Array<{text: string, type: 'note' | 'attachment'}> {
        const links: Array<{text: string, type: 'note' | 'attachment'}> = [];
        
        // 첨부파일 링크 찾기 (이미지)
        const attachmentRegex = /!\[\[.*?\]\]/g;
        let match;
        while ((match = attachmentRegex.exec(text)) !== null) {
            links.push({text: match[0], type: 'attachment'});
        }

        // 노트 링크 찾기
        const noteRegex = /\[\[.*?\]\]/g;
        while ((match = noteRegex.exec(text)) !== null) {
            // 이미지 링크가 아닌 경우만 추가
            if (!text.slice(Math.max(0, match.index - 1), match.index).endsWith('!')) {
                links.push({text: match[0], type: 'note'});
            }
        }

        return links;
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
