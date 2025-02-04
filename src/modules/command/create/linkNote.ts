import { App, Notice, MarkdownView, moment } from 'obsidian';
import type AILSSPlugin from 'main';
import { FrontmatterManager } from '../../maintenance/utils/frontmatterManager';
import { PathSettings } from '../../maintenance/settings/pathSettings';

export class LinkNote {
    constructor(
        private app: App,
        private plugin: AILSSPlugin
    ) {}

    async createLinkNote() {
        try {
            // 노트 개수 제한 확인
            if (!(await PathSettings.checkNoteLimit(this.app, this.plugin))) {
                new Notice(`노트 개수가 최대 제한(${PathSettings.MAX_NOTES}개)에 도달했습니다.`);
                return;
            }
            // 현재 활성화된 에디터와 선택된 텍스트 가져오기
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!activeView) {
                throw new Error("활성화된 마크다운 뷰가 없습니다.");
            }

            const editor = activeView.editor;
            const selectedText = editor.getSelection().trim();
            
            if (!selectedText) {
                throw new Error("선택된 텍스트가 없습니다.");
            }

            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) {
                throw new Error("현재 열린 파일을 찾을 수 없습니다.");
            }

            // 현재 노트의 frontmatter에서 태그 가져오기
            const frontmatterManager = new FrontmatterManager();
            const currentContent = await this.app.vault.read(activeFile);
            const currentFrontmatter = frontmatterManager.parseFrontmatter(currentContent);
            const currentTags = currentFrontmatter?.tags || [];

            // 기본 태그만 있는지 확인
            if (FrontmatterManager.hasOnlyDefaultTags(currentTags)) {
                new Notice("현재 노트에 기본 태그 외의 태그가 없습니다. 태그를 추가해주세요.");
                return;
            }

            // 기본 태그를 제외한 태그만 가져오기
            const nonDefaultTags = FrontmatterManager.getNonDefaultTags(currentTags);

            const now = moment();
            const folderPath = PathSettings.getTimestampedPath(now);
            
            // 파일명을 ID 형식으로 생성
            const fileName = PathSettings.getDefaultFileName();

            // 프론트매터 생성 (상속받은 태그만 포함)
            const noteContent = frontmatterManager.generateFrontmatter({
                title: selectedText,
                tags: nonDefaultTags
            }, true) + `\n- ${selectedText}`;

            // 폴더 생성
            if (!(await this.app.vault.adapter.exists(folderPath))) {
                await this.app.vault.createFolder(folderPath);
            }

            // 노트 생성
            const newFile = await this.app.vault.create(
                `${folderPath}/${fileName}`,
                noteContent
            );

            // 선택된 텍스트를 링크로 변경 (ID만 사용)
            const fileNameWithoutExtension = fileName.replace(PathSettings.DEFAULT_FILE_EXTENSION, '');
            editor.replaceSelection(`[[${fileNameWithoutExtension}|${selectedText}]]`);

            new Notice(`새 노트가 생성되었습니다: ${newFile.path}`);
            return newFile;
        } catch (error) {
            new Notice('노트 생성 중 오류가 발생했습니다.');
            console.error('Error creating new note:', error);
            throw error;
        }
    }
}
