import { App, Notice, MarkdownView, TFile, TFolder } from 'obsidian';
import type AILSSPlugin from 'main';
import { PathSettings } from '../../maintenance/settings/pathSettings';
import { CleanEmptyFolders } from '../../maintenance/utils/cleanEmptyFolders';

export class RecoverNote {
    constructor(
        private app: App,
        private plugin: AILSSPlugin
    ) {}

    async recoverNote() {
        try {
            // 현재 활성화된 에디터와 선택된 텍스트 가져오기
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!activeView) {
                throw new Error("활성화된 마크다운 뷰가 없습니다.");
            }

            const editor = activeView.editor;
            const selectedText = editor.getSelection();

            if (!selectedText) {
                throw new Error("텍스트가 선택되지 않았습니다.");
            }

            // 링크 정보 추출
            const linkInfo = this.extractLinkInfo(selectedText);
            if (!linkInfo) {
                throw new Error("선택된 텍스트에서 유효한 링크를 찾을 수 없습니다.");
            }

            // 링크된 파일 찾기
            const linkedFile = this.app.vault.getAbstractFileByPath(linkInfo.path + PathSettings.DEFAULT_FILE_EXTENSION) as TFile;
            if (!linkedFile) {
                throw new Error(`링크된 파일을 찾을 수 없습니다: ${linkInfo.path}`);
            }

            // 링크된 파일의 내용 가져오기
            const linkedContent = await this.app.vault.read(linkedFile);
            const contentWithoutFrontmatter = this.removeFrontmatter(linkedContent);

            // 링크를 내용으로 대체
            const cursor = editor.getCursor();
            const line = editor.getLine(cursor.line);
            const currentIndent = line.match(/^\s*/)?.[0] || '';

            const contentLines = contentWithoutFrontmatter.split('\n');
            const formattedContent = contentLines.map((contentLine, index) => {
                if (index === 0) {
                    // 첫 줄의 불렛 포인트 제거 (-, *, + 로 시작하는 불렛 포인트)
                    return contentLine.replace(/^[-*+]\s+/, '');
                }
                return `${currentIndent}${contentLine}`;
            }).join('\n');

            editor.replaceSelection(formattedContent);

            // 링크된 파일 삭제
            await this.app.vault.trash(linkedFile, true);

            // 빈 폴더 정리
            await this.cleanEmptyFolders(linkedFile.path);

            new Notice("링크가 복구되었고 연결된 노트가 삭제되었습니다.");
        } catch (error) {
            console.error("오류 발생:", error);
            new Notice(`오류: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private extractLinkInfo(text: string): { path: string, alias: string } | null {
        const match = text.match(/\[\[(.*?)(?:\|(.*?))?\]\]/);
        if (!match) return null;
        return { path: match[1], alias: match[2] || match[1] };
    }

    private removeFrontmatter(content: string): string {
        return content.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
    }

    private async cleanEmptyFolders(filePath: string): Promise<void> {
        const cleanEmptyFolders = new CleanEmptyFolders(this.app, this.plugin);
        await cleanEmptyFolders.cleanEmptyFoldersInVault();
    }
}
