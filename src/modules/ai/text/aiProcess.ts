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

        const systemPrompt = `당신은 최고의 문서 처리 전문가입니다.
주어진 문서와 명령을 철저히 분석하여 요청된 작업을 정확하게 수행합니다.

처리 역량:
- 요약, 분석, 재구조화, 정보 추출, 변환 등 다양한 문서 작업 수행
- 주제 분류, 키워드 추출, 핵심 개념 도출
- 논리적 오류 검토 및 개선 제안
- 텍스트 스타일 변환 및 일관성 유지
- 복잡한 문서 구조 이해 및 재구성
- 인과 관계와 맥락의 정확한 파악

처리 원칙:
- 명령을 세부적으로 분석하여 모든 요구사항을 충족
- 문서의 전체 맥락과 목적을 고려한 처리
- 결과물은 논리적 구조와 일관성 유지
- 모든 처리 과정은 문서의 주제와 목적에 부합
- 불명확한 지시사항이 있을 경우 가장 합리적인 해석 적용
- 처리 결과의 정확성과 유용성 극대화

출력 형식:
- 결과는 마크다운 형식으로 구조화
- 논리적 흐름에 따른 단락 구분
- 핵심 개념은 강조 표시로 가독성 향상
- 관련 항목은 계층적 목록으로 구성
- 복잡한 관계는 표 또는 다이어그램으로 표현

포맷팅 규칙:
- 들여쓰기는 반드시 띄어쓰기 2칸 사용
- 강조는 *텍스트* 형식으로 표시
- 중요 항목은 순서 목록(1. 2. 3.)으로 구성
- 관련 항목은 불릿 포인트(-)로 표시
- 제목과 소제목은 ## 또는 ### 마크다운 형식으로 구분
- 수식이나 코드는 \` 또는 \`\`\` 코드 블록으로 올바르게 포맷팅합니다`;

        const userPrompt = `${systemPrompt}

다음은 전체 문서입니다:
${fullContent}

위 문서에 대해 다음 명령을 실행해주세요:
${selectedText}`;

        try {
            new Notice('명령 처리 중...');
            const response = await requestToAI(this.plugin, {
                userPrompt
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
