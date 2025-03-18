import { App, Notice } from 'obsidian';
import AILSSPlugin from '../../../../main';
import { AIEditorUtils } from '../ai_utils/aiEditorUtils';
import { requestToAI } from '../ai_utils/aiUtils';

export class AIReformat {
    private app: App;
    private plugin: AILSSPlugin;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async main() {
        try {
            const editor = AIEditorUtils.getActiveEditor(this.app);
            const selectedText = editor.getSelection();
            
            if (!selectedText) {
                new Notice('텍스트를 선택해주세요.');
                return;
            }

            const systemPrompt = `당신은 텍스트 포맷팅 전문가입니다.
            주어진 텍스트를 다음 규칙에 따라 재구성하는 것이 임무입니다:
            1. 모든 내용은 불렛 포인트(-)로 시작
            2. 계층 구조는 탭 들여쓰기로 표현
            3. 숫자 리스트는 모두 불렛 포인트로 변환
            4. 제목-서브주제-내용은 3단계 들여쓰기로 구성
            5. 볼드체, 이탤릭체, 하이라이트 등 모든 포맷팅 제거
            6. 오직 탭 들여쓰기와 불렛 포인트만 사용하여 구조화`;

            const userPrompt = `${systemPrompt}

다음 텍스트를 위 규칙에 따라 재구성해주세요:

            "${selectedText}"

            변환 규칙:
            1. 각 줄은 반드시 불렛 포인트(-)로 시작
            2. 계층 구조는 탭으로 들여쓰기
            3. 기존 포맷팅은 모두 제거
            4. 내용의 논리적 구조 유지
            5. 변환 과정 설명 없이 결과만 출력`;

            new Notice('텍스트 재구성 중...');
            const response = await requestToAI(this.plugin, {
                systemPrompt,
                userPrompt,
                max_tokens: 2000,
                temperature: 0.1
            });
            
            await AIEditorUtils.insertAfterSelection(editor, response);
            new Notice('텍스트가 성공적으로 재구성되었습니다.');
        } catch (error) {
            new Notice('텍스트 재구성 중 오류가 발생했습니다.');
        }
    }
}
