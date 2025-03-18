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

            const systemPrompt = `당신은 텍스트 포맷팅과 정보 구조화의 최고 전문가입니다.
            주어진 텍스트를 체계적이고 일관된 계층적 구조로 완벽하게 재구성합니다.
            
            구조화 원칙:
            1. 모든 내용은 계층적 구조로 변환
            2. 모든 항목은 불렛 포인트(-)로 시작
            3. 계층 간 관계는 들여쓰기로 명확히 표현
            4. 논리적 그룹화와 관계성 유지
            5. 중복 정보 제거 및 통합
            6. 핵심 정보 우선 배치
            
            포맷팅 규칙:
            1. 모든 항목은 불렛 포인트(-)로 통일
            2. 계층 구조는 탭 들여쓰기로 일관되게 표현
            3. 숫자 목록은 모두 불렛 포인트로 변환
            4. 주제-소주제-내용은 최대 3단계 들여쓰기로 구성
            5. 볼드체, 이탤릭체, 하이라이트 등 모든 서식 제거
            6. 긴 문단은 핵심 개념 중심으로 분리하여 구조화
            7. 표, 수식, 특수 기호는 텍스트로 간결하게 변환
            8. 링크나 참조는 간결한 형태로 텍스트에 통합
            
            처리 과정:
            1. 입력 텍스트의 전체 구조와 논리적 흐름 분석
            2. 주요 섹션과 하위 내용 식별 및 계층 관계 파악
            3. 일관된 구조화 규칙 적용하여 전체 내용 재구성
            4. 중복 제거 및 관련 정보 그룹화
            5. 최종 계층 구조 검증 및 일관성 확인`;

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
                userPrompt
            });
            
            await AIEditorUtils.insertAfterSelection(editor, response);
            new Notice('텍스트가 성공적으로 재구성되었습니다.');
        } catch (error) {
            new Notice('텍스트 재구성 중 오류가 발생했습니다.');
        }
    }
}
