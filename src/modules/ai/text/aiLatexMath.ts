import { App, Notice } from 'obsidian';
import AILSSPlugin from '../../../../main';
import { AIEditorUtils } from '../ai_utils/aiEditorUtils';
import { requestToAI } from '../ai_utils/aiUtils';

export class AILatexMath {
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

            const systemPrompt = `당신은 수학과 LaTeX의 전문가입니다. 
            주어진 자연어와 수식이 혼합된 표현을 정확하게 해석하여 Obsidian에서 지원하는 LaTeX 수학 코드로 변환하는 것이 임무입니다.
            텍스트는 \\text{} 명령어를 사용하여 처리하고, 수식 내의 영문자는 기울임체로 처리합니다.`;

            const userPrompt = `${systemPrompt}

다음 표현을 LaTeX 코드로 변환해주세요:

            "${selectedText}"

            변환 규칙:
            1. Obsidian에서 인식 가능한 LaTeX 문법 사용
            2. $$ ... $$ 형식으로 감싸기
            3. 변환 과정 설명 없이 코드만 출력
            4. 필요시 줄바꿈과 align 환경 사용
            5. 왼쪽 정렬 유지
            6. 가독성을 위한 적절한 줄바꿈 추가
            7. 필요시 \\begin{...} ... \\end{...} 형식 사용
            8. 일반 텍스트는 \\text{} 안에 넣어 처리
            9. 영문 변수나 수식 기호는 수식 모드로 처리
            10. 한글 텍스트는 \\text{} 안에 넣어 처리
            11. 왼쪽 정렬 유지`;

            new Notice('LaTeX 수학 코드 생성 중...');
            const response = await requestToAI(this.plugin, {
                systemPrompt,
                userPrompt,
                max_tokens: 1500,
                temperature: 0.1
            });
            
            await AIEditorUtils.insertAfterSelection(editor, response);
            new Notice('LaTeX 수학 코드가 성공적으로 생성되었습니다.');
        } catch (error) {
            //console.error('LaTeX 수학 코드 생성 중 오류 발생:', error);
            new Notice('LaTeX 수학 코드 생성 중 오류가 발생했습니다.');
        }
    }
}
