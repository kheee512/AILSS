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
- 내용을 논리적 계층 구조로 분석하여 불렛 포인트(-)와 들여쓰기로 구성
- 들여쓰기는 2칸 공백을 사용하여 계층 구조 표현
- 각 항목은 해당 내용을 명확하고 간결하게 설명
- 중요한 개념이나 키워드는 볼드체(**) 사용
- 관련 개념들은 같은 들여쓰기 수준으로 그룹화
- 전문 용어는 한글과 원어를 함께 표기
- 불필요한 중복이나 반복 제거

구조화 규칙:
- 최상위 개념은 들여쓰기 없이 시작
- 하위 개념은 2칸씩 들여쓰기 추가
- 동일한 수준의 개념은 같은 들여쓰기 적용
- 모든 항목은 불렛 포인트(-)로 시작
- 각 개념 간의 논리적 연관성 유지`;

            const userPrompt = `다음 내용을 분석하여 불렛 포인트(-)와 들여쓰기(2칸)를 사용한 계층 구조로 재구성해주세요:

${content}

결과는 헤더(#) 사용을 피하고, 오직 불렛 포인트와 들여쓰기만을 사용하여 개념 간의 상하관계와 연관성을 표현해주세요.`;

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