import { App, Notice, MarkdownView, moment } from 'obsidian';
import type AILSSPlugin from 'main';

export class LinkNote {
    constructor(
        private app: App,
        private plugin: AILSSPlugin
    ) {}

    async createLinkNote() {
        try {
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

            const now = moment();
            const folderPath = now.format('YY/MM/DD/HH');
            const activatedTime = now.format('YYYY-MM-DDTHH:mm:ss');

            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) {
                throw new Error("현재 열린 파일을 찾을 수 없습니다.");
            }

            // 현재 노트의 frontmatter에서 태그 가져오기
            const frontmatter = this.app.metadataCache.getFileCache(activeFile)?.frontmatter;
            const currentTags = frontmatter?.tags || [];
            const defaultTags = this.plugin.settings.defaultTags;
            const tags = Array.from(new Set([
                ...defaultTags,
                ...(Array.isArray(currentTags) ? currentTags : [currentTags])
            ]));

            // 노트 내용 생성 (태그 포함)
            const noteContent = `---
Potentiation: 0
Activated: ${activatedTime}
tags:
${tags.map(tag => `  - ${tag}`).join('\n')}
---
`;

            // 폴더 생성
            if (!(await this.app.vault.adapter.exists(folderPath))) {
                await this.app.vault.createFolder(folderPath);
            }

            // 파일명으로 선택된 텍스트 사용
            let fileName = `${selectedText}.md`;
            let counter = 1;
            
            while (await this.app.vault.adapter.exists(`${folderPath}/${fileName}`)) {
                fileName = `${selectedText}-${counter}.md`;
                counter++;
            }

            // 노트 생성
            const newFile = await this.app.vault.create(
                `${folderPath}/${fileName}`,
                noteContent
            );

            // 설정에 따라 새 탭에서 파일 열기
            if (this.plugin.settings.openInNewTab) {
                const leaf = this.app.workspace.getLeaf('tab');
                await leaf.openFile(newFile);
            }

            // 선택된 텍스트를 링크로 변경
            editor.replaceSelection(`[[${folderPath}/${fileName.replace('.md', '')}|${selectedText}]]`);

            new Notice(`새 노트가 생성되었습니다: ${newFile.path}`);
            return newFile;
        } catch (error) {
            new Notice('노트 생성 중 오류가 발생했습니다.');
            console.error('Error creating new note:', error);
            throw error;
        }
    }
}
