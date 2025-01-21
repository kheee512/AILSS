import { App, Notice, Editor, MarkdownView } from 'obsidian';
import AILSSPlugin from '../../../../main';
import { requestToAI } from '../../../modules/maintenance/utils/aiUtils';
import { getContentWithoutFrontmatter } from '../../../modules/maintenance/utils/contentUtils';

export class AIAnswer {
    private app: App;
    private plugin: AILSSPlugin;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async main() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('활성화된 마크다운 편집기가 없습니다.');
            return;
        }

        const editor = activeView.editor;
        const fullContent = getContentWithoutFrontmatter(editor.getValue());
        const selectedText = editor.getSelection();
        if (!selectedText) {
            new Notice('질문할 텍스트를 선택해주세요.');
            return;
        }

        // 선택된 텍스트의 위치 정보 저장
        const selections = editor.listSelections();
        const lastSelection = selections[selections.length - 1];
        const endPos = lastSelection.head.line > lastSelection.anchor.line ? 
            lastSelection.head : lastSelection.anchor;

        const systemPrompt = `당신은 지식이 풍부한 전문가이자 교육자입니다.
모든 분야(수학, 컴퓨터과학, 과학, 철학, 인문학 등)에 대해 정확하고 상세한 답변을 제공하는 것이 임무입니다.

답변 규칙:
- 정확성과 신뢰성을 최우선으로 합니다
- 복잡한 개념은 단계적으로 설명합니다
- 필요한 경우 예시를 들어 설명합니다
- 관련된 추가 정보나 맥락도 제공합니다
- 수식이나 코드가 필요한 경우 마크다운 문법을 사용합니다
- 답변은 논리적 구조를 가지도록 구성합니다
- 불확실한 내용은 명시적으로 표현합니다
- 전문 용어는 한글과 원어를 함께 표기합니다
- 필요한 경우 참고할만한 추가 자료나 리소스를 제안합니다
- 답변 마지막에는 핵심 내용을 요약합니다

포맷팅 규칙:
- 들여쓰기는 반드시 띄어쓰기 4칸을 사용합니다
- 강조가 필요한 텍스트는 *로 감싸서 이탤릭체로 표시합니다
- 모든 목록은 - 기호를 사용합니다`;

        const userPrompt = `다음은 전체 문서입니다:
${fullContent}

위 문서에서 다음 선택된 텍스트에 대해 문서의 맥락을 고려하여 상세하고 정확하게 답변해주세요:

선택된 텍스트:
${selectedText}`;

        try {
            new Notice('AI 답변 생성 중...');
            const response = await requestToAI(this.plugin, {
                systemPrompt,
                userPrompt,
                max_tokens: 3000,  // 상세한 답변을 위해 충분한 토큰 필요
                temperature: 0.3   // 정확성 중시, 현재 값 적절함
            });

            // 저장된 위치 정보를 사용하여 답변 삽입
            editor.replaceRange(`\n\n%%\nAI 답변:\n${response}\n%%\n`,
                {line: endPos.line, ch: editor.getLine(endPos.line).length});
            new Notice('답변이 성공적으로 추가되었습니다.');
        } catch (error) {
            console.error('AI 답변 생성 중 오류 발생:', error);
            new Notice('AI 답변 생성 중 오류가 발생했습니다.');
        }
    }
} 