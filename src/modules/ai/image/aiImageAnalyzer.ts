import { App, Notice } from 'obsidian';
import AILSSPlugin from '../../../../main';
import { AIImageUtils } from '../ai_utils/aiImageUtils';
import { AIEditorUtils } from '../ai_utils/aiEditorUtils';
import { AIBatchProcessor } from '../ai_utils/aiBatchProcessor';
import { AIOCR } from './aiOCR';
import Anthropic from '@anthropic-ai/sdk';
import { requestUrl } from 'obsidian';

export class AIImageAnalyzer {
    private app: App;
    private plugin: AILSSPlugin;
    private ocr: AIOCR;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.ocr = new AIOCR(app, plugin);
    }

    async main() {
        try {
            new Notice('이미지 분석 프로세스 시작');
            const editor = AIEditorUtils.getActiveEditor(this.app);
            const selectedText = editor.getSelection();
            
            // 선택된 텍스트에서 지시사항과 이미지 링크 분리
            const imageLinks = AIImageUtils.extractImageLinks(selectedText);
            const instruction = selectedText.replace(/!\[\[.*?\]\]/g, '').trim();

            if (imageLinks.length === 0) {
                new Notice('선택된 텍스트에서 이미지를 찾을 수 없습니다.');
                return;
            }

            // 지시사항이 없는 경우 OCR 모드로 전환
            if (!instruction) {
                await this.ocr.main();
                return;
            }

            new Notice(`발견된 이미지 링크: ${imageLinks.length}개`);
            new Notice('이미지 분석을 시작합니다...');

            const analyses = await AIBatchProcessor.processBatch(
                imageLinks,
                async (link, index, total) => {
                    return await this.analyzeImage(link, instruction);
                },
                3,
                '이미지 분석'
            );

            new Notice('분석된 내용을 노트에 추가하는 중...');
            const updatedSelection = await AIEditorUtils.updateNoteContent(selectedText, analyses);
            editor.replaceSelection(updatedSelection);

            new Notice('이미지 분석이 완료되었습니다.');
        } catch (error) {
            new Notice('이미지 분석 중 오류가 발생했습니다.');
        }
    }

    private async analyzeImage(imagePath: string, instruction: string): Promise<string> {
        try {
            const { base64Image, mediaType } = await AIImageUtils.processImageForVision(this.app, imagePath);

            if (this.plugin.settings.selectedVisionModel === 'openai') {
                return await this.analyzeWithOpenAI(base64Image, instruction);
            } else {
                return await this.analyzeWithClaude(base64Image, mediaType, instruction);
            }
        } catch (error) {
            new Notice('이미지 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            return '이미지 분석 중 오류가 발생했습니다.';
        }
    }

    private async analyzeWithClaude(base64Image: string, mediaType: string, instruction: string): Promise<string> {
        const systemPrompt = `당신은 최고의 이미지 분석 및 해석 전문가입니다.
사용자의 지시사항에 따라 이미지를 정확하게 분석하고, 고품질의 통찰력 있는 정보를 추출합니다.

전문 분야:
- 시각적 내용 상세 설명 및 해석
- 텍스트 및 문자 인식과 해석
- 객체, 패턴, 색상, 구도 분석
- 다이어그램, 차트, 그래프 해석
- 수학적 표현 및 수식 이해
- 역사적, 문화적 맥락 파악
- 과학적 이미지 및 의학 영상 분석
- 예술 작품 및 디자인 요소 평가

분석 원칙:
- 사용자 지시사항을 최우선으로 정확히 따르기
- 객관적 사실과 주관적 해석을 명확히 구분
- 이미지의 맥락과 목적을 고려한 분석
- 세부 정보부터 전체 맥락까지 다층적 분석
- 불확실한 내용은 명시적으로 표현
- 관련 배경 지식 적절히 활용
- 전문 용어는 필요시 간략한 설명 추가
- 논리적이고 구조화된 형식으로 분석 결과 제시

출력 형식:
- 분석 결과는 명확한 섹션으로 구조화
- 핵심 내용을 강조하여 가독성 향상
- 중요 발견은 불릿 포인트로 목록화
- 복잡한 내용은 단계적으로 설명
- 모든 수학 수식은 $ 또는 $$ 기호로 정확히 감싸기
- 출력은 사용자 지시에 따라 맞춤형으로 조정
- 분석 결과만 출력하고 불필요한 메타 설명 제외`;

        const userPrompt = `${systemPrompt}

다음 지시사항에 따라 이미지를 분석해주세요:
${instruction}

분석 결과만 출력하고 다른 설명은 추가하지 마세요.`;

        const anthropic = new Anthropic({
            apiKey: this.plugin.settings.claudeAPIKey,
            dangerouslyAllowBrowser: true
        });

        const response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 4000,
            temperature: 0.3,
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

    private async analyzeWithOpenAI(base64Image: string, instruction: string): Promise<string> {
        const url = 'https://api.openai.com/v1/chat/completions';
        const headers = {
            'Authorization': `Bearer ${this.plugin.settings.openAIAPIKey}`,
            'Content-Type': 'application/json'
        };

        const systemPrompt = `당신은 최고의 이미지 분석 및 시각적 정보 해석 전문가입니다. 
다양한 분야의 이미지를 정확하게 분석하고, 사용자의 지시사항에 따라 맞춤형 정보를 추출합니다.

이미지 분석 능력:
- 이미지 내 모든 시각적 요소와 텍스트의 완벽한 인식
- 다이어그램, 차트, 그래프의 정확한 해석
- 복잡한 수학 수식과 기호의 정확한 인식
- 객체 간 관계와 구조적 패턴 식별
- 이미지의 맥락과 의도 파악
- 시각적 정보의 계층적 중요도 평가

분석 방법론:
- 사용자 지시사항을 철저히 준수
- 객관적 관찰과 분석적 해석 균형 유지
- 명확한 구조와 논리적 흐름으로 분석 결과 전달
- 불확실한 요소는 투명하게 표시
- 관련 전문 지식 적절히 활용
- 결과는 간결하고 직접적으로 제시`;
        
        const userPrompt = `${systemPrompt}

다음 지시사항에 따라 이미지를 분석해주세요:
${instruction}

분석 결과만 출력하고 다른 설명은 추가하지 마세요.`;

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