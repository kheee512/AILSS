import { requestUrl, RequestUrlParam, Notice } from 'obsidian';
import AILSSPlugin from '../../../../main';
import Anthropic from '@anthropic-ai/sdk';

interface AIPrompt {
    systemPrompt: string;
    userPrompt: string;
    temperature: number;  // 필수값으로 변경
    max_tokens: number;
}

function logAPIRequest(provider: string, prompt: AIPrompt) {
    //console.log(`=== ${provider} 요청 정보 ===`);
    //console.log('시스템 프롬프트:', prompt.systemPrompt);
    //console.log('사용자 프롬프트:', prompt.userPrompt);
    //console.log('온도:', prompt.temperature);
    //console.log('최대 토큰:', prompt.max_tokens);
    //console.log('=====================');
}

function logAPIResponse(provider: string, response: string, usage: any): string {
    const usageInfo = {
        입력_토큰: usage.prompt_tokens || usage.input_tokens || 0,
        출력_토큰: usage.completion_tokens || usage.output_tokens || 0,
        전체_토큰: usage.total_tokens || (usage.input_tokens + usage.output_tokens) || 0
    };

    const usageMessage = `📊 토큰 사용량 (${provider}):\n` +
                        `입력: ${usageInfo.입력_토큰}\n` +
                        `출력: ${usageInfo.출력_토큰}\n` +
                        `전체: ${usageInfo.전체_토큰}`;

    //console.log(`=== ${provider} 응답 정보 ===`);
    //console.log('응답:', response);
    //console.log('토큰 사용량:', usageInfo);
    //console.log('=====================');

    new Notice(usageMessage, 5000);

    return response;
}

export async function requestToAI(plugin: AILSSPlugin, prompt: AIPrompt): Promise<string> {
    const { selectedAIModel, openAIModel, claudeModel, perplexityModel } = plugin.settings;
    
    const modelName = selectedAIModel === 'openai' ? openAIModel : 
                    selectedAIModel === 'claude' ? claudeModel : perplexityModel;
    
    // 사용자에게 보여줄 초기 메시지
    const userMessage = `🤖 AI 요청 정보:\n` +
                       `서비스: ${selectedAIModel.toUpperCase()}\n` +
                       `모델: ${modelName}\n` +
                       `처리 중...`;
    
    // Notice로 통일
    new Notice(userMessage, 5000);

    // 시스템 프롬프트를 유저 프롬프트에 통합
    const combinedPrompt = {
        ...prompt,
        userPrompt: prompt.systemPrompt ? `${prompt.systemPrompt}\n\n${prompt.userPrompt}` : prompt.userPrompt
    };

    try {
        let response = '';
        if (selectedAIModel === 'openai') {
            response = await requestToOpenAI(plugin.settings.openAIAPIKey, combinedPrompt, openAIModel);
        } else if (selectedAIModel === 'claude') {
            response = await requestToClaude(plugin.settings.claudeAPIKey, combinedPrompt, claudeModel);
        } else if (selectedAIModel === 'perplexity') {
            response = await requestToPerplexity(plugin.settings.perplexityAPIKey, combinedPrompt, perplexityModel);
        } else {
            throw new Error('유효하지 않은 AI 모델이 선택되었습니다.');
        }
        return response;
    } catch (error) {
        console.error('AI 요청 중 오류 발생:', error);
        throw error;
    }
}

async function requestToOpenAI(apiKey: string, prompt: AIPrompt, model: string): Promise<string> {
    new Notice('OpenAI API 요청 시작');
    
    const url = 'https://api.openai.com/v1/chat/completions';
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
    
    // 모든 모델에서 유저 프롬프트만 사용하도록 수정
    const data = {
        model: model,
        messages: [
            { role: 'user', content: prompt.userPrompt }
        ]
    };

    const params: RequestUrlParam = {
        url: url,
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
    };

    try {
        const response = await requestUrl(params);
        if (response.status === 200) {
            const aiResponse = response.json.choices[0].message.content.trim();
            return logAPIResponse('OpenAI', aiResponse, response.json.usage);
        } else {
            //console.error('OpenAI API 오류 응답:', response);
            new Notice('OpenAI API 오류 응답:', response.status);
            const errorBody = JSON.parse(response.text);
            throw new Error(`OpenAI API 요청 실패: 상태 코드 ${response.status}, 오류 타입: ${errorBody.error.type}, 메시지: ${errorBody.error.message}`);
        }
    } catch (error) {
        //console.error('OpenAI API 요청 중 오류 발생:', error);
        new Notice('OpenAI API 요청 중 오류 발생:', error);
        if (error instanceof Error) {
            if ('response' in error) {
                const responseError = error as any;
                const errorBody = JSON.parse(responseError.response.text);
                throw new Error(`OpenAI API 오류: 상태 코드 ${responseError.response.status}, 오류 타입: ${errorBody.error.type}, 메시지: ${errorBody.error.message}`);
            } else {
                throw new Error(`OpenAI API 오류: ${error.message}`);
            }
        } else {
            throw new Error('OpenAI API 요청 중 알 수 없는 오류 발생');
        }
    }
}

async function requestToClaude(apiKey: string, prompt: AIPrompt, model: string): Promise<string> {
    //logAPIRequest('Claude', prompt);
    //console.log('Claude 요청 정보:', {
    //    systemPrompt: prompt.systemPrompt,
    //    userPrompt: prompt.userPrompt,
    //    temperature: prompt.temperature,
    //    max_tokens: prompt.max_tokens
    //});
    
    const anthropic = new Anthropic({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
    });

    try {
        //console.log('Claude API 요청 시작');
        new Notice('Claude API 요청 시작');
        const response = await anthropic.messages.create({
            model: model,
            max_tokens: prompt.max_tokens,
            messages: [
                { role: "user", content: prompt.userPrompt }
            ],
        });
        
        if (response.content && response.content.length > 0) {
            const content = response.content[0];
            if ('text' in content) {
                return logAPIResponse('Claude', content.text, response.usage);
            } else {
                //console.error('Claude API 응답 형식 오류:', response);
                new Notice('Claude API 응답 형식 오류');
                throw new Error('Claude API 응답의 내용 형식이 예상과 다릅니다.');
            }
        } else {
            //console.error('Claude API 빈 응답:', response);
            new Notice('Claude API 빈 응답');
            throw new Error('Claude API 응답에 내용이 없습니다.');
        }
    } catch (error) {
        //console.error('Claude API 요청 중 예외 발생:', error);
        new Notice('Claude API 요청 중 예외 발생:', error);
        if (error instanceof Anthropic.APIError) {
            //console.error('Claude API 오류 상세:', {
            //    status: error.status,
            //    message: error.message,
            //    name: error.name
            //});
            new Notice(`Claude API 오류: ${error.message}, 상태: ${error.status}, 유형: ${error.name}`);
            throw new Error(`Claude API 오류: ${error.message}, 상태: ${error.status}, 유형: ${error.name}`);
        } else if (error instanceof Error) {
            throw new Error(`Claude API 오류: ${error.message}`);
        } else {
            throw new Error('Claude API 요청 중 알 수 없는 오류 발생');
        }
    }
}

async function requestToPerplexity(apiKey: string, prompt: AIPrompt, model: string): Promise<string> {
    //logAPIRequest('Perplexity', prompt);
    //console.log('Perplexity 요청 정보:', {
    //    systemPrompt: prompt.systemPrompt,
    //    userPrompt: prompt.userPrompt,
    //    temperature: prompt.temperature,
    //    max_tokens: prompt.max_tokens
    //});

    new Notice('Perplexity API 요청 시작');
    const url = 'https://api.perplexity.ai/chat/completions';
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
    const data = {
        model: model,
        messages: [
            { role: 'user', content: prompt.userPrompt }
        ]
    };

    const params: RequestUrlParam = {
        url: url,
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
    };

    try {
        const response = await requestUrl(params);
        if (response.status === 200) {
            const aiResponse = response.json.choices[0].message.content.trim();
            return logAPIResponse('Perplexity', aiResponse, response.json.usage);
        } else {
            //console.error('Perplexity API 오류 응답:', response);
            new Notice('Perplexity API 오류 응답:', response.status);
            throw new Error(`Perplexity API 요청 실패: 상태 코드 ${response.status}`);
        }
    } catch (error) {
        //console.error('Perplexity API 요청 중 오류 발생:', error);
        new Notice('Perplexity API 요청 중 오류 발생:', error);
        if (error instanceof Error) {
            throw new Error(`Perplexity API 오류: ${error.message}`);
        } else {
            throw new Error('Perplexity API 요청 중 알 수 없는 오류 발생');
        }
    }
}

