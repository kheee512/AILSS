import { App, Notice, MarkdownView, moment } from 'obsidian';
import type AILSSPlugin from '../../../../main';
import { FrontmatterManager } from '../../maintenance/utils/frontmatterManager';
import { PathSettings } from '../../maintenance/settings/pathSettings';
import { requestToAI } from '../ai_utils/aiUtils';
import { getContentWithoutFrontmatter } from '../../maintenance/utils/contentUtils';

export class AILinkNote {
    constructor(
        private app: App,
        private plugin: AILSSPlugin
    ) {}

    async createAILinkNote() {
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

            // 현재 노트의 전체 내용과 frontmatter 가져오기
            const currentContent = await this.app.vault.read(activeFile);
            const frontmatterManager = new FrontmatterManager();
            const currentFrontmatter = frontmatterManager.parseFrontmatter(currentContent);
            const currentTags = currentFrontmatter?.tags || [];

            // 기본 태그만 있는지 확인
            if (FrontmatterManager.hasOnlyDefaultTags(currentTags)) {
                new Notice("현재 노트에 기본 태그 외의 태그가 없습니다. 태그를 추가해주세요.");
                return;
            }

            // AI 분석 요청
            new Notice("AI 분석 중...");
            const aiContent = await this.generateAIContent(currentContent, selectedText);

            // 노트 생성 준비
            const now = moment();
            const folderPath = PathSettings.getTimestampedPath(now);

            // 기본 태그를 제외한 태그만 가져오기
            const nonDefaultTags = FrontmatterManager.getNonDefaultTags(currentTags);

            // 프론트매터 생성 (상속받은 태그 포함)
            const noteContent = frontmatterManager.generateFrontmatter({
                tags: [...FrontmatterManager.DEFAULT_TAGS, ...nonDefaultTags]
            }) + `\n${aiContent}`;

            // 폴더 생성
            if (!(await this.app.vault.adapter.exists(folderPath))) {
                await this.app.vault.createFolder(folderPath);
            }

            // 파일명으로 선택된 텍스트 사용
            let fileName = `${selectedText}${PathSettings.DEFAULT_FILE_EXTENSION}`;
            let counter = 1;
            
            while (await this.app.vault.adapter.exists(`${folderPath}/${fileName}`)) {
                fileName = `${selectedText}-${counter}${PathSettings.DEFAULT_FILE_EXTENSION}`;
                counter++;
            }

            // 노트 생성
            const newFile = await this.app.vault.create(
                `${folderPath}/${fileName}`,
                noteContent
            );

            // 선택된 텍스트를 링크로 변경
            editor.replaceSelection(`[[${folderPath}/${fileName.replace(PathSettings.DEFAULT_FILE_EXTENSION, '')}|${selectedText}]]`);

            new Notice(`AI 분석이 포함된 새 노트가 생성되었습니다: ${newFile.path}`);
            return newFile;
        } catch (error) {
            new Notice('노트 생성 중 오류가 발생했습니다.');
            console.error('Error creating AI note:', error);
            throw error;
        }
    }

    private async generateAIContent(currentContent: string, selectedText: string): Promise<string> {
        // 프론트매터 제거 및 첨부파일 링크/노트 링크 처리
        const contentWithoutFrontmatter = getContentWithoutFrontmatter(currentContent);
        const processedContent = this.processNoteContent(contentWithoutFrontmatter);
        
        const systemPrompt = `당신은 텍스트를 분석하고 체계적으로 설명하는 전문가입니다.
주어진 텍스트의 맥락을 이해하고, 선택된 텍스트를 자세히 분석해주세요.

분석 시 다음 사항을 고려하세요:
1. 선택된 텍스트의 핵심 개념과 의미
2. 전체 문맥에서의 역할과 중요성
3. 관련된 이론이나 개념
4. 실제 적용 사례나 예시
5. 주의해야 할 점이나 한계
6. "선택된 텍스트 분석" 등 불필요한 내용 제거

결과는 다음 형식으로 작성해주세요:
- 핵심 개념
- 상세 분석
- 맥락에서의 의미
- 관련 개념
- 참고사항`;

        const userPrompt = `다음은 전체 문서 내용입니다:
${processedContent}

다음은 분석이 필요한 선택된 텍스트입니다:
${selectedText}

위 형식에 맞춰 분석해주세요.`;

        return await requestToAI(this.plugin, {
            systemPrompt,
            userPrompt,
            temperature: 0.3,
            max_tokens: 2000
        });
    }

    private processNoteContent(content: string): string {
        // 첨부파일 링크 제거 (![[...]])
        content = content.replace(/!\[\[.*?\]\]/g, '');
        
        // 노트 링크를 표시 텍스트로 변환 ([[경로/노트명|표시텍스트]] -> 표시텍스트)
        content = content.replace(/\[\[.*?\|(.+?)\]\]/g, '$1');
        
        // 표시 텍스트가 없는 노트 링크 처리 ([[경로/노트명]] -> 노트명)
        content = content.replace(/\[\[(.*?)\]\]/g, (match, path) => {
            const noteName = path.split('/').pop(); // 경로에서 노트명만 추출
            return noteName || match;
        });
        
        return content;
    }
} 