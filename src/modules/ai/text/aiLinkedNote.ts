import { App, Editor, Notice, MarkdownView, TFile, EditorPosition } from 'obsidian';
import AILSSPlugin from '../../../../main';
import { requestToAI } from '../../../modules/maintenance/utils/aiUtils';
import {
    FRAGMENTS_PATH,
    PARTIAL_LINKED_NOTE_DATE_FORMAT,
    FRONTMATTER_KEY_ORDER,
    MAX_DEPTH
} from '../../../modules/maintenance/constants';

export class AILinkedNote {
    private app: App;
    private plugin: AILSSPlugin;
    private activeSelections: Map<string, {
        from: EditorPosition,
        to: EditorPosition,
        processing: boolean
    }> = new Map();

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async main(): Promise<void> {
        try {
            const editor = this.getActiveEditor();
            const selectedText = editor.getSelection().trim();
            const fromLine = editor.getCursor('from').line;

            // 현재 선택에 대한 고유 ID 생성
            const selectionId = `${fromLine}-${Date.now()}`;

            // 이미 처리 중인 선택인지 확인
            if (this.isProcessing(fromLine)) {
                throw new Error("이미 처리 중인 선택입니다.");
            }

            // 현재 선택 위치 저장 및 처리 중 표시
            const originalSelection = {
                from: editor.getCursor('from'),
                to: editor.getCursor('to')
            };
            this.activeSelections.set(selectionId, {
                ...originalSelection,
                processing: true
            });

            const { text: contextText, fromLine: startLine, toLine } = this.getSelectedTextWithSubBullets(editor, fromLine);

            if (!selectedText) {
                throw new Error("텍스트가 선택되지 않았습니다.");
            }

            const currentFile = this.app.workspace.getActiveFile();
            if (!currentFile) {
                throw new Error("현재 열린 파일을 찾을 수 없습니다.");
            }

            const { tags } = this.extractFrontmatterData(currentFile);
            if (tags.length === 0) {
                throw new Error("태그가 비어있습니다!");
            }

            // AI 분석 수행
            new Notice('AI 분석 중...');
            const aiContent = await this.generateAIContent(contextText, selectedText);

            const { path: newNotePath, properties, appellation } = this.createNoteInfo(selectedText, tags);

            if (/^\d+$/.test(appellation)) {
                throw new Error("Appellation은 숫자만으로 이루어질 수 없습니다.");
            }

            await this.validateAndCreateNote(newNotePath, properties, selectedText, aiContent);
            
            // 저장된 위치 정보를 사용하여 원본 노트 업데이트
            editor.setSelection(originalSelection.from, originalSelection.to);
            this.updateOriginalNote(editor, newNotePath, appellation);
            
            new Notice("AI 분석이 포함된 새 노트가 생성되었습니다.");

            // 작업 완료 후 선택 정보 업데이트
            this.activeSelections.set(selectionId, {
                ...originalSelection,
                processing: false
            });

            // 일정 시간 후 선택 정보 제거
            setTimeout(() => {
                this.activeSelections.delete(selectionId);
            }, 5000);

        } catch (error) {
            // 에러 발생 시 선택 정보 초기화
            this.activeSelections.clear();
            console.error("오류 발생:", error);
            new Notice(`오류: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async generateAIContent(contextText: string, selectedText: string): Promise<string> {
        const systemPrompt = `당신은 텍스트를 분석하고 체계적으로 설명하는 전문가입니다.
주어진 텍스트 중 실제 분석해야 할 핵심 텍스트와, 이해를 돕기 위한 맥락 정보가 함께 제공됩니다.
반드시 핵심 텍스트에 집중하여 분석하고, 맥락 정보는 보조적으로만 활용하세요.

분석 시 고려사항:
1. 핵심 텍스트에 대한 상세하고 정확한 설명 제공
2. 개념을 직관적이고 이해하기 쉽게 설명
3. 수학/과학 관련 수식은 반드시 $ 기호로 감싸서 표현 (예: $E = mc^2$)
4. 복잡한 개념은 구체적 예시나 비유를 통해 설명
5. 모든 내용은 "- 제목" 형태로 시작하고, 그 하위 내용은 탭으로 들여쓰기 후 "- 내용" 형태로 작성
6. 불필요한 반복이나 모호한 설명 제외
7. 맥락 정보는 핵심 텍스트의 이해를 돕는 용도로만 참고`;

        const userPrompt = `다음 텍스트를 분석해주세요:

핵심 텍스트(이 부분에 집중해서 분석해주세요):
${selectedText}

맥락 정보(참고용):
${contextText}

다음 형식으로 핵심 텍스트에 대해 출력해주세요:

- 핵심 개념 요약
	- 개념의 명확하고 구체적인 정의
	- 개념의 중요한 특징이나 성질
    - 개념의 핵심 목적과 의도
    - 개념이 해결하고자 하는 문제나 과제
	- 개념과 연관된 수식이나 원리 및 알고리즘 ($로 감싸서 표현)
    - 개념이 사용하는 기초 이론이나 원리

- 상세 분석
	- 개념의 구체적 설명과 예시
	- 주요 특성과 동작 원리
	- 관련 개념들과의 연결성
	- 주의할 점이나 제한사항
    - 내부 동작 메커니즘

- 추가 참고사항
	- 이해를 돕는 비유나 예시
	- 맥락에서 특별히 고려해야 할 점
    - 잠재적인 오해나 혼동 포인트
	- 심화 학습 포인트
    
- 연관 개념
    - 이 개념이 직접적으로 활용하는 하위 개념들
    - 각 하위 개념과의 상호작용 방식
    - 하위 개념들의 중요도와 역할`;

        const response = await requestToAI(this.plugin, {
            systemPrompt,
            userPrompt,
            max_tokens: 2000,
            temperature: 0.3
        });

        return response;
    }

    private formatDate(date: Date, options: Intl.DateTimeFormatOptions = PARTIAL_LINKED_NOTE_DATE_FORMAT): string {
        const fullDate = new Intl.DateTimeFormat('ko-KR', options).format(date).replace(/[^\d]/g, '');
        return fullDate.slice(2, 14);
    }

    private escapeYamlString(str: string): string {
        if (/[:#{}\[\]|>]/.test(str) || /^[&*!%@`'"]/.test(str) || str.includes('\n')) {
            return `"${str.replace(/"/g, '\\"')}"`;
        }
        return str;
    }

    private createPath(timestamp: string): string {
        const [year, month, day, hour] = [
            timestamp.slice(0, 2),
            timestamp.slice(2, 4),
            timestamp.slice(4, 6),
            timestamp.slice(6, 8)
        ];
        return `${FRAGMENTS_PATH}/${year}년/${month}월/${day}일/${hour}시/${timestamp}.md`;
    }

    private extractFrontmatterData(file: TFile): { tags: string[] } {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
        const allTags = Array.isArray(frontmatter.tags) ? frontmatter.tags : 
                        (frontmatter.tags ? [frontmatter.tags] : []);
        
        return {
            tags: allTags.filter(tag => !this.plugin.settings.defaultTags.includes(tag))
        };
    }

    private createNoteInfo(selectedText: string, tags: string[]): { path: string; properties: string; appellation: string } {
        const now = new Date();
        const timestamp = this.formatDate(now);
        const appellation = selectedText.trim().replace(/^[-*+]\s+/, '');
        
        const properties = this.createFrontmatter(timestamp, appellation, tags);
        
        return {
            path: this.createPath(timestamp),
            properties,
            appellation
        };
    }

    private createFrontmatter(timestamp: string, appellation: string, tags: string[]): string {
        const now = new Date();
        const formattedCurrentTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

        const frontmatter: { [key: string]: string | string[] | number } = {
            UUID: timestamp,
            Appellation: this.escapeYamlString(appellation),
            tags: tags,
            Potentiation: 0,
            'Last Activate': formattedCurrentTime,
            aliases: [this.escapeYamlString(appellation)]
        };

        const orderedFrontmatter = FRONTMATTER_KEY_ORDER.reduce((acc, key) => {
            if (key in frontmatter) {
                acc[key] = frontmatter[key];
            }
            return acc;
        }, {} as { [key: string]: string | string[] | number });

        return ['---', ...Object.entries(orderedFrontmatter).map(([key, value]) => {
            if (Array.isArray(value)) {
                return `${key}:\n${value.map(item => `  - ${item}`).join('\n')}`;
            }
            return `${key}: ${value}`;
        }), '---'].join('\n');
    }

    private validateFileNameAndUUID(fileName: string, uuid: string): void {
        const fileNameWithoutExt = fileName.replace('.md', '');
        if (fileNameWithoutExt.length !== 12 || !/^\d{12}$/.test(fileNameWithoutExt)) {
            throw new Error(`잘못된 파일 이름 형식: ${fileName}`);
        }
        if (uuid !== fileNameWithoutExt) {
            throw new Error(`파일 이름과 UUID가 일치하지 않습니다: ${fileName} vs ${uuid}`);
        }
    }

    private async createNewNote(notePath: string, noteContent: string): Promise<void> {
        const folderPath = notePath.split('/').slice(0, -1).join('/');
        await this.createFolderRecursively(folderPath);
        await this.app.vault.create(notePath, noteContent);
    }

    private async createFolderRecursively(folderPath: string, depth: number = 0): Promise<void> {
        if (depth > MAX_DEPTH) {
            throw new Error("최대 폴더 깊이를 초과했습니다.");
        }
        if (!(await this.app.vault.adapter.exists(folderPath))) {
            const parentFolder = folderPath.split('/').slice(0, -1).join('/');
            await this.createFolderRecursively(parentFolder, depth + 1);
            await this.app.vault.createFolder(folderPath);
        }
    }

    private updateOriginalNote(editor: Editor, newNotePath: string, appellation: string): void {
        const fileName = newNotePath.split('/').pop()?.replace('.md', '');
        const link = `[[${fileName}|${appellation}]]`;
        
        // 현재 에디터의 상태를 확인하고 안전하게 업데이트
        if (editor.somethingSelected()) {
            const selection = editor.getSelection();
            const selectionStart = editor.getCursor('from');
            const line = editor.getLine(selectionStart.line);
            
            // 트랜잭션으로 처리하여 동시 수정 충돌 방지
            editor.transaction({
                changes: [{
                    from: selectionStart,
                    to: editor.getCursor('to'),
                    text: link
                }]
            });
        }
    }

    private async validateAndCreateNote(notePath: string, properties: string, selectedText: string, aiContent: string): Promise<void> {
        const fileName = notePath.split('/').pop();
        const uuid = properties.match(/UUID: (\d+)/)?.[1];
        if (fileName && uuid) {
            this.validateFileNameAndUUID(fileName, uuid);
        }

        if (await this.app.vault.adapter.exists(notePath)) {
            throw new Error("같은 이름의 노트가 이미 존재합니다.");
        }

        const noteContent = `${properties}
- ${selectedText}

${aiContent}`;

        await this.createNewNote(notePath, noteContent);
    }

    private getActiveEditor(): Editor {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (!activeLeaf) {
            throw new Error("활성화된 뷰를 찾을 수 없습니다.");
        }

        const { view } = activeLeaf;
        if (!(view instanceof MarkdownView)) {
            throw new Error("마크다운 편집기를 찾을 수 없습니다.");
        }

        return view.editor;
    }

    private getSelectedTextWithSubBullets(editor: Editor, fromLine: number): { text: string, fromLine: number, toLine: number } {
        const line = editor.getLine(fromLine);
        const baseIndentLength = line.match(/^(\s*)/)?.[1].length ?? 0;
        const lines: string[] = [];
        const adjustedLines: string[] = [];

        // 첫 줄의 전체 불렛 내용 추가
        lines.push(line);
        adjustedLines.push(line.substring(baseIndentLength));

        // 하위 불렛 찾기
        let hasSubBullets = false;
        for (let lineNum = fromLine + 1; lineNum < editor.lineCount(); lineNum++) {
            const lineText = editor.getLine(lineNum);
            const indentLength = lineText.match(/^(\s*)/)?.[1].length ?? 0;

            if (indentLength > baseIndentLength) {
                hasSubBullets = true;
                lines.push(lineText);
                adjustedLines.push(lineText.substring(baseIndentLength));
            } else {
                break;
            }
        }

        if (!hasSubBullets) {
            console.log("하위 불렛이 없는 텍스트가 선택되었습니다.");
        }

        return {
            text: adjustedLines.join('\n'),
            fromLine: fromLine,
            toLine: fromLine + lines.length - 1,
        };
    }

    private isProcessing(line: number): boolean {
        for (const [_, selection] of this.activeSelections) {
            if (selection.processing && 
                selection.from.line <= line && 
                selection.to.line >= line) {
                return true;
            }
        }
        return false;
    }
} 