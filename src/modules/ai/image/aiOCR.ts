import { App, Notice, requestUrl } from 'obsidian';
import AILSSPlugin from '../../../../main';
import { AIImageUtils } from '../ai_utils/aiImageUtils';
import { AIEditorUtils } from '../ai_utils/aiEditorUtils';
import { AIBatchProcessor } from '../ai_utils/aiBatchProcessor';
import Anthropic from '@anthropic-ai/sdk';


export class AIOCR {
    private app: App;
    private plugin: AILSSPlugin;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async main() {
        try {
            //console.log('이미지 분석 프로세스 시작');
            new Notice('OCR 분석 프로세스 시작');
            const editor = AIEditorUtils.getActiveEditor(this.app);
            const selectedText = editor.getSelection();
            
            if (!selectedText) {
                //console.log('선택된 텍스트 없음');
                new Notice('이미지를 선택해주세요.');
                return;
            }

            const imageLinks = AIImageUtils.extractImageLinks(selectedText);
            //console.log(`발견된 이미지 링크: ${imageLinks.length}개`, imageLinks);
            new Notice(`발견된 이미지 링크: ${imageLinks.length}개`);

            if (imageLinks.length === 0) {
                //console.log('이미지 링크를 찾을 수 없음');
                new Notice('선택된 텍스트에서 이미지를 찾을 수 없습니다.');
                return;
            }

            new Notice('이미지 분석을 시작합니다...');
            const analyses = await AIBatchProcessor.processBatch(
                imageLinks,
                async (link, index, total) => {
                    //console.log(`이미지 분석 시작 (${index + 1}/${total}): ${link}`);
                    return await this.analyzeImage(link);
                },
                3,
                '이미지 분석'
            );

            //console.log('모든 이미지 분석 완료, 노트 업데이트 시작');
            new Notice('분석된 내용을 노트에 추가하는 중...');
            const updatedSelection = await AIEditorUtils.updateNoteContent(selectedText, analyses);
            editor.replaceSelection(updatedSelection);

            //console.log('이미지 분석 프로세스 완료');
            new Notice('이미지 분석이 완료되었습니다.');
        } catch (error) {
            //console.error('이미지 분석 중 오류 발생:', error);
            new Notice('이미지 분석 중 오류가 발생했습니다.');
        }
    }

    private async analyzeImage(imagePath: string): Promise<string> {
        try {
            const { base64Image, mediaType } = await AIImageUtils.processImageForVision(this.app, imagePath);

            if (this.plugin.settings.selectedVisionModel === 'openai') {
                return await this.analyzeWithOpenAI(base64Image);
            } else {
                return await this.analyzeWithClaude(base64Image, mediaType);
            }

        } catch (error: any) {
            new Notice('이미지 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            return '이미지 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }
    }

    private async analyzeWithClaude(base64Image: string, mediaType: string): Promise<string> {
        const systemPrompt = `당신은 최고의 OCR(광학 문자 인식) 전문가입니다.
이미지에서 모든 종류의 텍스트를 완벽하게 추출하고 원본 형식을 정확히 보존하는 능력을 갖추고 있습니다.

전문 분야:
- 인쇄된 텍스트 인식 (다양한 서체, 크기, 스타일)
- 손글씨 텍스트 인식 (필기체, 타이핑 여부 무관)
- 수학 표기법 및 수식 변환 (LaTeX 형식으로 정확한 변환)
- 특수 기호 및 문자 인식 (과학, 수학, 화학, 물리학 등)
- 다국어 텍스트 처리 (한글, 영어, 중국어, 일본어 등)
- 표, 차트, 그래프 내 텍스트 추출
- 이미지 품질 문제 극복 (흐림, 회전, 왜곡, 노이즈)

OCR 처리 원칙:
- 원본의 모든 텍스트를 누락 없이 추출
- 텍스트의 논리적 구조와 포맷팅 보존
- 줄바꿈, 단락 구분, 들여쓰기 등 레이아웃 구조 유지
- 수식은 이해하기 쉽고 정확한 LaTeX 형식으로 변환
- 표와 목록의 구조적 배치 보존
- 텍스트 순서의 논리적 흐름 유지
- 추출 불확실한 부분은 [?] 또는 설명으로 표시

출력 형식 규칙:
- 모든 텍스트는 읽기 흐름에 따라 논리적으로 구성
- 문단과 섹션 구분 유지
- 모든 수학 수식은 $ 기호로 감싸서 표현 (인라인 수식)
- 복잡하거나 여러 줄의 수식은 $$ 기호로 감싸서 표현 (블록 수식)
- 표와 그리드 데이터는 마크다운 테이블 형식으로 보존
- 특수 서식(볼드, 이탤릭)은 가능한 경우 마크다운으로 표시
- 첨자와 윗첨자는 LaTeX 표기법으로 정확히 변환`;

        const userPrompt = `${systemPrompt}

이미지에서 모든 텍스트를 추출해주세요.

다음 요소들을 정확히 포함해주세요:
- 모든 텍스트 (손글씨, 인쇄물)
- 수학 수식은 반드시 $ 또는 $$ 기호로 감싸서 표현
- 특수 기호 및 문자
- 원본의 줄바꿈과 단락 구분

원본 텍스트만 출력하고 다른 설명은 추가하지 마세요.`;

        const anthropic = new Anthropic({
            apiKey: this.plugin.settings.claudeAPIKey,
            dangerouslyAllowBrowser: true
        });

        const response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 4000,
            temperature: 0.25,
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: userPrompt },
                    {
                        type: "image",
                        source: {
                            type: "base64",
                            media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                            data: base64Image
                        }
                    }
                ]
            }]
        });

        if (response.content && response.content[0] && 'text' in response.content[0]) {
            return response.content[0].text;
        }

        throw new Error('AI 응답을 받지 못했습니다.');
    }

    private async analyzeWithOpenAI(base64Image: string): Promise<string> {
        const url = 'https://api.openai.com/v1/chat/completions';
        const headers = {
            'Authorization': `Bearer ${this.plugin.settings.openAIAPIKey}`,
            'Content-Type': 'application/json'
        };

        const systemPrompt = `당신은 최고의 OCR 및 문서 디지털화 전문가입니다.
이미지에서 텍스트를 완벽하게 추출하고, 문서의 구조와 형식을 정확히 재현할 수 있습니다.

핵심 역량:
- 모든 형태의 텍스트 인식 (인쇄물, 손글씨, 특수 폰트 등)
- 수학적 표현의 LaTeX 변환 전문성
- 복잡한 레이아웃과 다단 구조 보존
- 다양한 언어 및 특수 문자 인식
- 표, 도표, 도식의 구조적 추출
- 이미지 품질 저하에도 강건한 인식 능력

처리 방식:
- 텍스트의 시각적/논리적 구조 완전히 보존
- 수식은 LaTeX 문법으로 정확하게 변환
- 글꼴 특성(굵게, 기울임 등)을 가능한 보존
- 요소 간 관계 및 계층 구조 유지
- 페이지 레이아웃의 논리적 흐름 재구성
- 모든 수학 표현은 $ 또는 $$ 기호로 정확히 감싸기`;

        const userPrompt = `${systemPrompt}

이미지에서 모든 텍스트를 추출해주세요. 수식은 LaTeX로 변환하고, 줄바꿈과 단락 구분을 유지해주세요. 
원본 텍스트만 출력하고 다른 설명은 추가하지 마세요.`;

        const data = {
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: userPrompt
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 4000,
            temperature: 0.3
        };

        const response = await requestUrl({
            url: url,
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        });

        if (response.status === 200) {
            return response.json.choices[0].message.content.trim();
        }

        throw new Error('OpenAI API 응답을 받지 못했습니다.');
    }
}
