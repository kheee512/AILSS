import { App } from 'obsidian';
import { DEFAULT_GRAPH_CONFIG } from './defaultGraphConfig';
import AILSSPlugin from '../../../../main';

export class GraphManager {
    constructor(
        private app: App,
        private plugin: AILSSPlugin
    ) {
        // 워크스페이스 레이아웃이 준비되면 로컬 그래프 설정을 적용
        this.app.workspace.onLayoutReady(() => {
            this.applyLocalGraphConfig();
        });

        // 새로운 로컬 그래프 뷰가 생성될 때마다 설정 적용
        this.app.workspace.on('layout-change', () => {
            this.applyLocalGraphConfig();
        });
    }

    private async applyLocalGraphConfig() {
        this.app.workspace.getLeavesOfType('localgraph').forEach(leaf => {
            const view = leaf.view as any;
            if (!view) return;

            // 기존의 설정 적용 로직
            if (view.options) {
                Object.assign(view.options, DEFAULT_GRAPH_CONFIG);
            }
            if (view.renderer?.settings) {
                Object.assign(view.renderer.settings, DEFAULT_GRAPH_CONFIG);
            }

            // 뷰 상태 업데이트
            const viewState = leaf.getViewState();
            if (!viewState.state) viewState.state = {};
            viewState.state.options = DEFAULT_GRAPH_CONFIG;
            leaf.setViewState(viewState);

            // 렌더러 리셋 및 새로고침
            if (view.renderer) {
                if (typeof view.renderer.reset === 'function') {
                    view.renderer.reset();
                }
                if (typeof view.renderer.onIframeLoad === 'function') {
                    view.renderer.onIframeLoad();
                }
            }
            if (typeof view.load === 'function') {
                view.load();
            }
        });
    }

    /**
     * 그래프 설정을 적용하는 메서드
     */
    async applyGraphConfig() {
        try {
            await this.applyLocalGraphConfig();
        } catch (error) {
            console.error('로컬 그래프 설정 적용 중 오류:', error);
        }
    }
}
