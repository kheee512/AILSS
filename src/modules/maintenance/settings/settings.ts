import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import AILSSPlugin from '../../../../main';

export interface AILSSSettings {
    openAIAPIKey: string;
    claudeAPIKey: string;
    perplexityAPIKey: string;
    selectedAIModel: 'openai' | 'claude' | 'perplexity';
    openAIModel: string;
    claudeModel: string;
    perplexityModel: string;
}

export const DEFAULT_SETTINGS: AILSSSettings = {
    openAIAPIKey: '',
    claudeAPIKey: '',
    perplexityAPIKey: '',
    selectedAIModel: 'claude',
    openAIModel: 'gpt-4o',
    claudeModel: 'claude-3-5-sonnet-20241022',
    perplexityModel: 'llama-3.1-sonar-huge-128k-online',
};

export class AILSSSettingTab extends PluginSettingTab {
    plugin: AILSSPlugin;

    constructor(app: App, plugin: AILSSPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'AI 설정' });

        this.addAISettings(containerEl);
    }

    private addAISettings(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName('AI 모델 선택')
            .setDesc('사용할 AI 모델을 선택하세요')
            .addDropdown(dropdown => dropdown
                .addOption('openai', 'OpenAI')
                .addOption('claude', 'Claude')
                .addOption('perplexity', 'Perplexity')
                .setValue(this.plugin.settings.selectedAIModel)
                .onChange(async (value: 'openai' | 'claude' | 'perplexity') => {
                    this.plugin.settings.selectedAIModel = value;
                    await this.plugin.saveSettings();
                }));

        this.addMaskedApiKeySetting(containerEl, 'OpenAI API Key', 'openAIAPIKey');
        
        new Setting(containerEl)
            .setName('OpenAI 모델')
            .setDesc('사용할 OpenAI 모델을 선택하세요')
            .addDropdown(dropdown => dropdown
                .addOption('gpt-4o', 'GPT-4o')
                .addOption('gpt-4o-mini', 'GPT-4o mini')
                .addOption('o1-preview', 'o1-preview')
                .addOption('o1-mini', 'o1-mini')
                .addOption('gpt-4-turbo', 'GPT-4 Turbo')
                .setValue(this.plugin.settings.openAIModel)
                .onChange(async (value) => {
                    this.plugin.settings.openAIModel = value;
                    await this.plugin.saveSettings();
                }));

        this.addMaskedApiKeySetting(containerEl, 'Claude API Key', 'claudeAPIKey');

        new Setting(containerEl)
            .setName('Claude 모델')
            .setDesc('사용할 Claude 모델을 선택하세요')
            .addDropdown(dropdown => dropdown
                .addOption('claude-3-opus-20240229', 'Claude 3 Opus')
                .addOption('claude-3-sonnet-20240229', 'Claude 3 Sonnet')
                .addOption('claude-3-haiku-20240307', 'Claude 3 Haiku')
                .addOption('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet')
                .addOption('claude-3-5-haiku-20241022', 'Claude 3.5 Haiku')
                .setValue(this.plugin.settings.claudeModel)
                .onChange(async (value) => {
                    this.plugin.settings.claudeModel = value;
                    await this.plugin.saveSettings();
                }));

        this.addMaskedApiKeySetting(containerEl, 'Perplexity API Key', 'perplexityAPIKey');

        new Setting(containerEl)
            .setName('Perplexity 모델')
            .setDesc('사용할 Perplexity 모델을 선택하세요')
            .addDropdown(dropdown => dropdown
                .addOption('llama-3.1-sonar-small-128k-online', 'Sonar Small (8B)')
                .addOption('llama-3.1-sonar-large-128k-online', 'Sonar Large (70B)')
                .addOption('llama-3.1-sonar-huge-128k-online', 'Sonar Huge (405B)')
                .setValue(this.plugin.settings.perplexityModel)
                .onChange(async (value) => {
                    this.plugin.settings.perplexityModel = value;
                    await this.plugin.saveSettings();
                }));
    }

    private addMaskedApiKeySetting(containerEl: HTMLElement, name: string, settingKey: keyof AILSSSettings & string) {
        new Setting(containerEl)
            .setName(name)
            .setDesc(`${name}를 입력하세요`)
            .addText(text => text
                .setPlaceholder('새 값 입력')
                .setValue(this.plugin.settings[settingKey] ? '•••••••••••••' : '')
                .onChange(async (value) => {
                    if (value && value !== '•••••••••••••') {
                        if ((settingKey === 'openAIAPIKey' || settingKey === 'claudeAPIKey') && !value.startsWith('sk-')) {
                            new Notice(`유효하지 않은 ${name} 형식입니다. "sk-"로 시작해야 합니다`);
                            return;
                        }
                        (this.plugin.settings[settingKey] as string) = value;
                        await this.plugin.saveSettings();
                        text.setValue('•••••••••••••');
                    }
                }));
    }
}
