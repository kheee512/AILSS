import { App, Notice } from 'obsidian';
import AILSSPlugin from '../../../../main';
import { AIEditorUtils } from '../ai_utils/aiEditorUtils';
import { requestToAI } from '../ai_utils/aiUtils';

export class AIVisualizer {
    private app: App;
    private plugin: AILSSPlugin;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async main() {
        try {
            //console.log('AIVisualizer main() 시작');
            const editor = AIEditorUtils.getActiveEditor(this.app);
            const selectedText = editor.getSelection();
            
            if (!selectedText) {
                //console.log('선택된 텍스트 없음');
                new Notice('텍스트를 선택해주세요.');
                return;
            }

            const systemPrompt = `당신은 텍스트를 시각적 다이어그램으로 변환하는 전문가입니다.
주어진 내용을 분석하여 가장 적절한 Mermaid 다이어그램을 생성하는 것이 목표입니다.

            포맷팅 규칙:
- 들여쓰기는 반드시 띄어쓰기 4칸을 사용합니다
- 강조가 필요한 텍스트는 *로 감싸서 이탤릭체로 표시합니다
- 모든 목록은 - 기호를 사용합니다

다이어그램 선택 및 구성 기준:
1. flowchart: 
   - 사용 케이스: 단계별 프로세스, 의사결정 흐름, 시스템 워크플로우
   - 구성:
     * 시작과 끝 노드 명확히 표시
     * 의사결정은 다이아몬드 형태로 표현
     * 프로세스 방향은 위에서 아래 또는 왼쪽에서 오른쪽
     * 주요 단계는 직사각형, 부가 설명은 둥근 사각형
   
2. sequenceDiagram:
   - 사용 케이스: 시스템 간 통신, 시간 순서가 중요한 상호작용, API 흐름
   - 구성:
     * 참여자(participant)를 상단에 명확히 정의
     * 시간 흐름은 위에서 아래로 표현
     * 동기/비동기 호출 구분
     * 중요 메시지는 굵은 화살표로 강조
   
3. classDiagram:
   - 사용 케이스: 객체지향 설계, 시스템 구조, 컴포넌트 관계
   - 구성:
     * 클래스명은 PascalCase로 표기
     * 속성과 메서드 접근 제한자 명시
     * 상속/구현 관계는 실선/점선으로 구분
     * 연관 관계는 화살표로 표현하고 다중성 표기
   
4. stateDiagram:
   - 사용 케이스: 상태 전이, 이벤트 기반 동작, 시스템 생명주기
   - 구성:
     * 초기/최종 상태 명확히 표시
     * 상태 전이 조건을 화살표에 명시
     * 복합 상태는 중첩으로 표현
     * 동시 상태는 점선으로 구분
   
5. entityRelationshipDiagram:
   - 사용 케이스: 데이터 모델, 테이블 관계, 스키마 설계
   - 구성:
     * 엔티티는 명사형으로 표현
     * 기본키/외래키 명확히 표시
     * 관계는 동사구로 표현
     * 카디널리티 반드시 명시
   
6. mindmap:
   - 사용 케이스: 개념 계층구조, 아이디어 구조화, 지식 맵핑
   - 구성:
     * 중심 개념을 루트로 배치
     * 계층별 들여쓰기로 구조화
     * 동일 레벨은 같은 스타일 유지
     * 관련 개념은 근접 배치
   
7. timeline/gantt:
   - 사용 케이스: 시간 기반 이벤트, 프로젝트 일정, 진행 상황
   - 구성:
     * 시간 단위 명확히 정의
     * 작업 간 의존성 표시
     * 중요 마일스톤 강조
     * 병렬 작업 구분

8. graph TD (형식 언어 및 수식 분석용 트리):
   - 입력 분석:
     * 수학적 표현:
       - 집합 표기: {a, b, c}, A ∪ B, A ∩ B
       - 논리 연산자: ∧, ∨, ¬, →, ↔
       - 수량자: ∀, ∃, ∄
       - 관계 연산자: ∈, ∉, ⊆, ⊂, =, ≠
       - BNF 문법: ::=, |, *, +, ?
     * 자연어 구문:
       - 정의(Definition), 정리(Theorem), 증명(Proof)
       - 조건문: if, then, else, therefore
       - 열거형: firstly, secondly, finally
   
   - 트리 생성 규칙:
     * 루트 노드: 주요 개념이나 시작 기호
     * 중간 노드: 
       - 연산자나 관계 기호
       - 문법 규칙의 비단말 기호
     * 리프 노드:
       - 상수, 변수, 종결값
       - 문법의 단말 기호
     * 노드 스타일:
       - 수식: [[$수식$]]
       - 연산자: (($연산자$))
       - 문법 규칙: {{$규칙$}}
       - 자연어: [$텍스트$]
   
   - 특수 처리:
     * 수식 트리:
       - 연산자 우선순위 반영
       - 괄호 중첩 구조 표현
     * 구문 트리:
       - 문법 규칙 계층화
       - 파생 과정 시각화
     * 증명 트리:
       - 가정에서 결론으로의 흐름
       - 보조 정리 참조 구조

   - 레이아웃 규칙:
     * 왼쪽에서 오른쪽으로 읽는 구조
     * 동일 레벨 노드는 같은 높이
     * 서브트리 간 적절한 간격 유지
     * 복잡한 수식은 여러 레벨로 분해`;

            const userPrompt = `다음 내용을 Mermaid 다이어그램으로 시각화해주세요:

${selectedText}

다른 내용 없이 응답은 무조건 다음 형식 준수:
\`\`\`mermaid
[다이어그램 코드]
\`\`\`
`;

            //console.log('AI 요청 시작', {
            //    model: this.plugin.settings.selectedAIModel,
            //    maxTokens: 4500,
            //    temperature: 0.15
            //});

            new Notice('Mermaid 다이어그램 생성 중...');
            const response = await requestToAI(this.plugin, {
                systemPrompt,
                userPrompt,
                max_tokens: 4500,
                temperature: 0.15
            });

            //console.log('AI 응답 받음');
            await AIEditorUtils.insertAfterSelection(editor, response);
            new Notice('Mermaid 다이어그램이 성공적으로 생성되었습니다.');

        } catch (error) {
            //console.error('다이어그램 생성 중 상세 오류:', error);
            new Notice('다이어그램 생성 중 오류가 발생했습니다.');
        }
    }
} 