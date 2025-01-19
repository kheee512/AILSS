import { App, PluginSettingTab, Setting } from 'obsidian';
import type AILSSPlugin from '../../../main';

export class AILSSSettingTab extends PluginSettingTab {
    plugin: AILSSPlugin;

    constructor(app: App, plugin: AILSSPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('새 탭에서 열기')
            .setDesc('새 노트를 생성할 때 새 탭에서 열지 여부를 설정합니다.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.openInNewTab)
                .onChange(async (value) => {
                    this.plugin.settings.openInNewTab = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('기본 태그')
            .setDesc('새 노트 생성 시 자동으로 추가될 태그들을 설정합니다. (쉼표로 구분)')
            .addText(text => text
                .setValue(this.plugin.settings.defaultTags.join(', '))
                .onChange(async (value) => {
                    this.plugin.settings.defaultTags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('강화 대기 시간')
            .setDesc('다음 강화까지 대기해야 하는 시간을 설정합니다. (분 단위)')
            .addText(text => text
                .setValue(String(this.plugin.settings.potentiateDelay))
                .onChange(async (value) => {
                    this.plugin.settings.potentiateDelay = Number(value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('강화 증가값')
            .setDesc('한 번 강화할 때 증가하는 값을 설정합니다.')
            .addText(text => text
                .setValue(String(this.plugin.settings.potentiateValue))
                .onChange(async (value) => {
                    this.plugin.settings.potentiateValue = Number(value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('최대 강화 지수')
            .setDesc('노트의 최대 강화 지수를 설정합니다.')
            .addText(text => text
                .setValue(String(this.plugin.settings.maxPotentiation))
                .onChange(async (value) => {
                    this.plugin.settings.maxPotentiation = Number(value);
                    await this.plugin.saveSettings();
                }));
    }
} 