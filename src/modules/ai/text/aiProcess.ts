import { App, Notice, Editor, MarkdownView } from 'obsidian';
import AILSSPlugin from '../../../../main';
import { requestToAI } from '../ai_utils/aiUtils';
import { getContentWithoutFrontmatter } from '../../maintenance/utils/contentUtils';

export class AIProcess {
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
            new Notice('실행할 명령을 선택해주세요.');
            return;
        }

        const selections = editor.listSelections();
        const lastSelection = selections[selections.length - 1];
        const endPos = lastSelection.head.line > lastSelection.anchor.line ? 
            lastSelection.head : lastSelection.anchor;

        const systemPrompt = `당신은 문서 처리 전문가입니다.
주어진 문서와 명령을 분석하여 요청된 작업을 수행하고 결과를 제공합니다.

처리 규칙:
- 명령을 정확히 이해하고 실행합니다
- 문서의 맥락을 고려하여 처리합니다
- 결과는 마크다운 형식으로 제공합니다
- 처리 과정이 필요한 경우 단계별로 설명합니다
- 불확실한 부분은 명시적으로 표현합니다
- 처리 결과는 논리적 구조를 가지도록 구성합니다

포맷팅 규칙:
- 들여쓰기는 반드시 띄어쓰기 2칸을 사용합니다
- 강조가 필요한 텍스트는 *로 감싸서 이탤릭체로 표시합니다
- 모든 목록은 - 기호를 사용합니다`;

        const userPrompt = `${systemPrompt}

다음은 전체 문서입니다:
${fullContent}

위 문서에 대해 다음 명령을 실행해주세요:
${selectedText}`;

        try {
            new Notice('명령 처리 중...');
            const response = await requestToAI(this.plugin, {
                systemPrompt,
                userPrompt,
                max_tokens: 3000,
                temperature: 0.3
            });

            editor.replaceRange(`\n${response}\n`,
                {line: endPos.line, ch: editor.getLine(endPos.line).length});
            new Notice('명령이 성공적으로 처리되었습니다.');
            
            return response; // aiChainProcess에서 사용하기 위해 응답 반환
        } catch (error) {
            new Notice('명령 처리 중 오류가 발생했습니다.');
            throw error; // 체인 처리를 위해 에러를 상위로 전파
        }
    }
}
