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
            const filesToDelete: Array<{file: TFile | null, type: 'note' | 'attachment', originalText: string}> = [];
            
            for (const link of links) {
                //console.log('처리 중인 링크:', link);

                let filePath = '';
                if (link.type === 'note') {
                    const match = link.text.match(/\[\[([^|]+)\|/);
                    if (match) {
                        filePath = match[1].trim();
                        if (!filePath.endsWith('.md')) {
                            filePath += '.md';
                        }
                    }
                } else {
                    const match = link.text.match(/!\[\[(.*?)\]\]/);
                    if (match) {
                        filePath = match[1].trim();
                    }
                }

                //console.log('추출된 파일 경로:', filePath);

                if (filePath) {
                    const file = this.app.vault.getAbstractFileByPath(filePath);
                    //console.log('찾은 파일 객체:', file);

                    // 파일이 있든 없든 filesToDelete 배열에 추가
                    filesToDelete.push({
                        file: file instanceof TFile ? file : null,
                        type: link.type,
                        originalText: link.text
                    });
                }
            }

            if (filesToDelete.length > 0) {
                const existingFiles = filesToDelete.filter(f => f.file !== null);
                //console.log('삭제할 파일 목록:', existingFiles.map(f => f.file?.path));

                const confirmMessage = existingFiles.length > 0
                    ? `${existingFiles.length}개의 파일을 삭제하고 모든 링크를 처리하시겠습니까?\n\n${existingFiles.map(f => `- ${f.file?.path}`).join('\n')}`
                    : "선택된 모든 링크를 텍스트로 변환하시겠습니까?";

                const confirmed = await showConfirmationDialog(this.app, {
                    title: "링크 삭제 확인",
                    message: confirmMessage,
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
                    let fileDeleted = false;

                    if (file) {
                        try {
                            //console.log('파일 삭제 시도:', file.path);
                            await this.app.vault.delete(file);
                            //console.log('파일 삭제 성공:', file.path);
                            fileDeleted = true;
                        } catch (error) {
                            //console.error('파일 삭제 실패:', error);
                            try {
                                await this.app.vault.trash(file, false);
                                //console.log('파일 휴지통으로 이동:', file.path);
                                fileDeleted = true;
                            } catch (trashError) {
                                //console.error('휴지통으로 이동 실패:', trashError);
                                new Notice(`${file.path} 삭제 실패`);
                                continue;
                            }
                        }
                    }

                    if (!file || fileDeleted) {
                        if (type === 'attachment') {
                            modifiedText = modifiedText.replace(originalText, '');
                        } else {
                            const linkMatch = originalText.match(/\[\[.*?\|(.*?)\]\]/);
                            if (linkMatch) {
                                const alias = linkMatch[1];
                                modifiedText = modifiedText.replace(originalText, alias);
                            }
                        }
                    }
                }

                editor.replaceSelection(modifiedText);
                
                const message = existingFiles.length > 0
                    ? `${existingFiles.length}개의 파일이 삭제되고 모든 링크가 처리되었습니다.`
                    : "모든 링크가 텍스트로 변환되었습니다.";
                new Notice(message);
                await this.cleanEmptyFolders.cleanEmptyFoldersInVault();
            } else {
                new Notice('삭제할 파일을 찾을 수 없습니다.');
            }
        } catch (error) {
            //console.error('전체 작업 실패:', error);
            new Notice('작업 실패: ' + error.message);
        }
    }

    private findAllLinks(text: string): Array<{text: string, type: 'note' | 'attachment'}> {
        const links: Array<{text: string, type: 'note' | 'attachment'}> = [];
        
        // 모든 링크를 찾습니다
        const regex = /!?\[\[.*?\]\]/g;
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            const linkText = match[0];
            // 파이프가 있으면 노트, 없으면 첨부파일
            if (linkText.includes('|')) {
                links.push({text: linkText, type: 'note'});
            } else {
                links.push({text: linkText, type: 'attachment'});
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
            match = text.match(/!\[\[(.*?)\]\]/);
            if (match) {
                const filePath = match[1];
                if (PathSettings.isValidPath(filePath)) {
                    return filePath;
                }
                const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));
                return `${currentDir}/${filePath}`;
            }
        } else {
            // 노트 링크에서 파일 경로 추출 (파이프 기호 앞의 부분)
            match = text.match(/\[\[([^|]+)\|/);
            if (match) {
                let filePath = match[1].trim();
                // 파일 확장자가 없는 경우에만 추가
                if (!filePath.endsWith('.md')) {
                    filePath += '.md';
                }
                return filePath;
            }
        }
        return null;
    }
}
