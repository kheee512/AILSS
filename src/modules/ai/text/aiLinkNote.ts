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
            
            // 현재 선택된 텍스트의 정확한 위치 가져오기
            const currentSelection = {
                from: editor.getCursor('from'),
                to: editor.getCursor('to')
            };
            
            if (!selectedText) {
                throw new Error("선택된 텍스트가 없습니다.");
            }

            // 현재 문서의 전체 내용 가져오기
            const currentContent = editor.getValue();
            
            // 선택한 텍스트의 위치 정보 저장
            const selectionStartPos = editor.posToOffset(currentSelection.from);
            const selectionEndPos = editor.posToOffset(currentSelection.to);
            
            // 선택 해제
            editor.setSelection(currentSelection.to, currentSelection.to);

            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) {
                throw new Error("현재 열린 파일을 찾을 수 없습니다.");
            }

            // 현재 노트의 전체 내용과 frontmatter 가져오기
            const fileContent = await this.app.vault.read(activeFile);
            const frontmatterManager = new FrontmatterManager();
            const currentFrontmatter = frontmatterManager.parseFrontmatter(fileContent);
            const currentTags = currentFrontmatter?.tags || [];

            // 기본 태그만 있는지 확인
            if (FrontmatterManager.hasOnlyDefaultTags(currentTags)) {
                new Notice("현재 노트에 기본 태그 외의 태그가 없습니다. 태그를 추가해주세요.");
                return;
            }

            const now = moment();
            const folderPath = PathSettings.getTimestampedPath(now);
            
            // 파일명을 ID 형식으로 생성
            const fileName = PathSettings.getDefaultFileName();

            // AI 분석 요청
            new Notice("AI 분석 중...");
            const aiContent = await this.generateAIContent(fileContent, selectedText);

            // 노트 생성 준비
            const nonDefaultTags = FrontmatterManager.getNonDefaultTags(currentTags);

            // 노트 생성
            const { file, fileName: newFileName, timestamp } = await PathSettings.createNote({
                app: this.app,
                frontmatterConfig: {
                    title: selectedText,
                    tags: nonDefaultTags
                },
                content: aiContent,
                isInherited: true
            });

            // 노트 생성 후 텍스트 내용 기반으로 위치를 찾아 링크 삽입
            const fileNameWithoutExtension = newFileName.replace(PathSettings.DEFAULT_FILE_EXTENSION, '');
            const linkText = `[[${fileNameWithoutExtension}|${selectedText}]]`;
            
            // 텍스트 검색 및 대체 (원래 선택했던 위치 정보 활용)
            if (this.replaceSelectedText(editor, selectedText, linkText, selectionStartPos)) {
                new Notice(`AI 분석이 포함된 새 노트가 생성되었습니다: ${file.path}`);
            } else {
                new Notice(`노트는 생성되었지만 링크 삽입에 실패했습니다. 수동으로 링크를 삽입해주세요: ${file.path}`);
            }
            
            return file;
        } catch (error) {
            new Notice('노트 생성 중 오류가 발생했습니다.');
            console.error('Error creating AI note:', error);
            throw error;
        }
    }

    /**
     * 에디터에서 텍스트를 찾아 링크로 대체하는 함수
     * @param editor 에디터 인스턴스
     * @param searchText 찾을 텍스트
     * @param replaceText 대체할 텍스트
     * @param originalPosition 원래 선택했던 텍스트의 시작 위치
     * @returns 성공 여부
     */
    private replaceSelectedText(editor: any, searchText: string, replaceText: string, originalPosition: number): boolean {
        const content = editor.getValue();
        
        // 1. 정확한 위치 검색: 원래 선택했던 위치 주변에서 텍스트 검색
        const searchRadius = 100; // 원래 위치에서 앞뒤로 탐색할 문자 수
        const startPos = Math.max(0, originalPosition - searchRadius);
        const endPos = Math.min(content.length, originalPosition + searchText.length + searchRadius);
        
        const nearbyContent = content.substring(startPos, endPos);
        const relativePos = nearbyContent.indexOf(searchText);
        
        if (relativePos >= 0) {
            const exactPos = startPos + relativePos;
            const fromPos = editor.offsetToPos(exactPos);
            const toPos = editor.offsetToPos(exactPos + searchText.length);
            
            editor.setSelection(fromPos, toPos);
            editor.replaceSelection(replaceText);
            return true;
        }
        
        // 2. 정확한 위치에서 찾지 못한 경우, 전체 문서에서 검색
        // 현재 커서 위치
        const cursor = editor.getCursor();
        const cursorPos = editor.posToOffset(cursor);
        
        // 원래 위치에 가장 가까운 일치하는 텍스트 찾기
        const allMatches = this.findAllOccurrences(content, searchText);
        if (allMatches.length === 0) return false;
        
        // 원래 위치에 가장 가까운 일치하는 텍스트 찾기
        let closestMatch = allMatches[0];
        let minDistance = Math.abs(closestMatch - originalPosition);
        
        for (const match of allMatches) {
            const distance = Math.abs(match - originalPosition);
            if (distance < minDistance) {
                minDistance = distance;
                closestMatch = match;
            }
        }
        
        // 가장 가까운 일치 텍스트 대체
        const matchFromPos = editor.offsetToPos(closestMatch);
        const matchToPos = editor.offsetToPos(closestMatch + searchText.length);
        
        editor.setSelection(matchFromPos, matchToPos);
        editor.replaceSelection(replaceText);
        return true;
    }
    
    /**
     * 문자열에서 특정 텍스트의 모든 출현 위치를 찾는 함수
     * @param content 검색할 문자열
     * @param searchText 찾을 텍스트
     * @returns 모든 출현 위치의 인덱스 배열
     */
    private findAllOccurrences(content: string, searchText: string): number[] {
        const positions: number[] = [];
        let pos = content.indexOf(searchText);
        
        while (pos !== -1) {
            positions.push(pos);
            pos = content.indexOf(searchText, pos + 1);
        }
        
        return positions;
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

        const userPrompt = `${systemPrompt}

다음은 전체 문서 내용입니다:
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