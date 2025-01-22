import { App, Notice, MarkdownView } from 'obsidian';
import type AILSSPlugin from '../../../../main';
import { requestToAI } from '../ai_utils/aiUtils';
import { getContentWithoutFrontmatter } from '../../maintenance/utils/contentUtils';

export class AIStructureNote {
    constructor(
        private app: App,
        private plugin: AILSSPlugin
    ) {}

    async main() {
        try {
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!activeView) {
                new Notice('활성화된 마크다운 편집기가 없습니다.');
                return;
            }

            const editor = activeView.editor;
            const selectedText = editor.getSelection().trim();
            const content = selectedText || getContentWithoutFrontmatter(editor.getValue());

            if (!content) {
                new Notice('분석할 내용이 없습니다.');
                return;
            }

            new Notice('노트 구조화 분석 중...');

            const systemPrompt = `당신은 텍스트를 체계적으로 구조화하는 전문가입니다.

분석 지침:
1. 내용을 논리적 계층 구조로 분석하여 헤더(#)로 구성
2. 최상위 개념은 H1(#), 하위 개념은 단계적으로 H2-H6(##-######) 사용
3. 각 섹션은 해당 내용을 명확하고 간결하게 설명
4. 중요한 개념이나 키워드는 볼드체(**) 사용
5. 관련 개념들은 같은 레벨의 헤더로 그룹화
6. 전문 용어는 한글과 원어를 함께 표기
7. 불필요한 중복이나 반복 제거
8. 각 섹션 시작에 간단한 설명 추가

구조화 규칙:
- 최상위 헤더(#)는 문서의 핵심 주제
- 주요 섹션은 H2(##)로 구성
- 상세 내용은 H3-H6(###-######)로 구분
- 각 헤더 레벨은 논리적 연관성 유지
- 모든 섹션은 명확한 계층 구조 형성`;

            const userPrompt = `다음 내용을 분석하여 체계적인 헤더 구조로 재구성해주세요:

${content}

결과는 마크다운 헤더(#)를 사용하여 계층적으로 구성하고, 각 섹션에 적절한 설명을 포함해주세요.`;

            const response = await requestToAI(this.plugin, {
                systemPrompt,
                userPrompt,
                temperature: 0.3,
                max_tokens: 3000
            });

            if (selectedText) {
                editor.replaceSelection(response);
            } else {
                editor.setValue(response);
            }

            new Notice('노트 구조화가 완료되었습니다.');

        } catch (error) {
            //console.error('노트 구조화 중 오류 발생:', error);
            new Notice('노트 구조화 중 오류가 발생했습니다.');
        }
    }
} 