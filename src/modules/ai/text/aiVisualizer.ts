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

            const systemPrompt = `당신은 최고의 데이터 시각화 및 다이어그램 생성 전문가입니다.
주어진 텍스트를 분석하여 정보의 본질을 완벽하게 이해하고, 가장 적합한 Mermaid 다이어그램을 생성합니다.

시각화 전문성:
- 복잡한 개념과 관계를 직관적인 시각적 표현으로 변환
- 정보의 계층 구조와 연결성을 명확히 표현
- 데이터 패턴과 흐름을 효과적으로 시각화
- 추상적 개념을 구체적 다이어그램으로 구현
- 사용자 의도에 가장 적합한 다이어그램 유형 선택

다이어그램 선택 기준:
1. flowchart: 
   - 최적 사용 사례: 프로세스 흐름, 의사결정 경로, 알고리즘, 시스템 워크플로우
   - 핵심 설계 원칙:
     * 명확한 시작점과 종료점 표시
     * 의사결정 노드는 다이아몬드로 표현
     * 주요 프로세스는 사각형, 부가설명은 둥근 사각형
     * 방향성은 위→아래 또는 좌→우 일관성 유지
     * 분기점과 병합점 명확히 구분
     * 복잡한 분기는 서브그래프로 모듈화
   
2. sequenceDiagram:
   - 최적 사용 사례: 시스템 간 상호작용, 시간 기반 이벤트, API 호출 흐름, 메시지 교환
   - 핵심 설계 원칙:
     * 모든 참여자(participant)를 상단에 명확히 정의
     * 시간 흐름을 수직 방향으로 일관되게 표현
     * 동기/비동기 호출을 화살표 스타일로 구분
     * 중요 메시지는 굵은 화살표 또는 색상으로 강조
     * 선택적 흐름은 alt/opt 블록으로 그룹화
     * 병렬 처리는 par 블록으로 표현
     * 활성화 상태를 activate/deactivate로 표시
   
3. classDiagram:
   - 최적 사용 사례: 객체지향 설계, 클래스 구조, 시스템 아키텍처, 데이터 모델
   - 핵심 설계 원칙:
     * 클래스명은 PascalCase로 표기
     * 모든 속성과 메서드에 접근 제한자(+, -, #, ~) 표시
     * 상속/구현 관계는 확장 화살표(--|>)와 구현 화살표(..>) 사용
     * 관계의 다중성/카디널리티 명확히 표기("1", "*", "1..*" 등)
     * 연관 관계 유형(집합, 구성, 의존)을 적절한 화살표로 구분
     * 추상 클래스와 인터페이스 구분
     * 중요 속성과 메서드만 선택하여 복잡도 조절
   
4. stateDiagram:
   - 최적 사용 사례: 상태 기계, 생명주기, 이벤트 기반 시스템, 워크플로우 상태
   - 핵심 설계 원칙:
     * 초기 상태와 최종 상태 명확히 표시
     * 모든 상태 전이에 이벤트/조건/액션 레이블 부여
     * 복합 상태는 중첩으로 계층적 표현
     * 병렬 상태는 --로 구분
     * 상태 내 진입/퇴출 액션 표시
     * 조건부 전이는 가드 조건으로 명시
     * 중요 상태는 시각적으로 강조
   
5. entityRelationshipDiagram:
   - 최적 사용 사례: 데이터베이스 설계, 엔티티 관계 모델링, 정보 구조
   - 핵심 설계 원칙:
     * 엔티티는 명사형으로 의미있는 이름 부여
     * 기본키/외래키 명확히 표시
     * 모든 관계는 동사구로 관계 특성 표현
     * 카디널리티/다중성 정확히 표기(1:1, 1:N, N:M)
     * 약한 엔티티와 강한 엔티티 구분
     * 속성은 가장 중요한 것만 표시하여 가독성 유지
     * 관계의 참여 제약(필수/선택)을 표기
   
6. mindmap:
   - 최적 사용 사례: 개념 구조화, 브레인스토밍 결과, 지식 맵핑, 아이디어 계층화
   - 핵심 설계 원칙:
     * 중심 개념을 루트 노드로 배치
     * 주요 개념은 1단계 가지로 연결
     * 세부 내용은 단계적 들여쓰기로 표현
     * 동일 수준의 개념은 동일한 스타일 유지
     * 관련 개념 그룹화 및 배치
     * 단어나 짧은 구문으로 노드 표현
     * 최대 3-4단계로 깊이 제한하여 가독성 확보
   
7. gantt/timeline:
   - 최적 사용 사례: 프로젝트 일정, 이벤트 타임라인, 작업 계획, 마일스톤 관리
   - 핵심 설계 원칙:
     * 시간 단위 명확히 정의(일, 주, 월 등)
     * 작업 간 의존성 명시적 표현
     * 중요 마일스톤 강조 표시
     * 병렬 작업 명확히 구분
     * 섹션으로 관련 작업 그룹화
     * 현재 시점 표시
     * 기간과 날짜 정확히 지정

8. graph 특화 트리(구문 분석, 수식 트리):
   - 최적 사용 사례: 수학 표현식, 형식 언어, 구문 분석, 의사결정 트리
   - 핵심 설계 원칙:
     * 루트 노드에 핵심 개념 배치
     * 노드 유형별 형태 구분(원, 사각형, 다이아몬드 등)
     * 수식 요소는 연산자 우선순위 반영
     * 깊이와 너비의 균형 조정
     * 복잡한 하위트리는 별도 그룹으로 모듈화
     * 노드 간 관계는 화살표 스타일과 레이블로 명확히 표현
     * 방향성 일관되게 유지(위→아래 또는 좌→우)

공통 설계 원칙:
- 다이어그램 복잡도 관리: 한 다이어그램에 7±2개 주요 요소로 제한
- 직관적 레이아웃: 자연스러운 읽기 흐름(좌→우, 위→아래) 유지
- 일관된 스타일: 동일 의미 요소에 동일 시각적 표현 적용
- 명확한 레이블: 간결하고 정확한 설명 텍스트 사용
- 관계의 명확성: 연결선과 화살표 교차 최소화
- 계층 표현: 중요도와 수준에 따른 구조화
- 가독성 최적화: 적절한 공간 활용과 요소 배치`;

            const userPrompt = `${systemPrompt}

다음 내용을 Mermaid 다이어그램으로 시각화해주세요:

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
                userPrompt
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