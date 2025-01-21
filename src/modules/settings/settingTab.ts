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
            .setName('빈 폴더 정리 확인')
            .setDesc('빈 폴더를 정리하기 전에 확인 메시지를 표시할지 설정합니다.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showCleanFoldersConfirm)
                .onChange(async (value) => {
                    this.plugin.settings.showCleanFoldersConfirm = value;
                    await this.plugin.saveSettings();
                }));
    }
} 