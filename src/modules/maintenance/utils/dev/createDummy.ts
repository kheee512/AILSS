import { App, Notice } from 'obsidian';
import type AILSSPlugin from 'main';
import { FrontmatterManager } from '../frontmatterManager';
import { showConfirmationDialog } from '../../../../components/confirmationModal';
import { InputModal } from '../../../../components/inputModal';

interface ClusterNode {
    title: string;
    tags: string[];
    links: string[];
}

export class CreateDummy {
    private readonly NODES_PER_CLUSTER = 295; // 1 + 6 + (6 * 8) + (6 * 8 * 6) = 295

    constructor(
        private app: App,
        private plugin: AILSSPlugin
    ) {}

    private getClusterPath(clusterIndex: number): string {
        // 5000부터 시작하여 각 단계별로 증가
        const year = 5000 + Math.floor(clusterIndex / (12 * 31));
        const month = 1 + Math.floor((clusterIndex % (12 * 31)) / 31);
        const day = 1 + (clusterIndex % 31);
        const hour = String(Math.floor((clusterIndex % 24))).padStart(2, '0');
        
        return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${hour}00`;
    }

    private getNodePath(clusterIndex: number, nodeIndex: number): string {
        // 클러스터당 더 넓은 시간 범위 할당 (1년)
        const baseYear = 5000 + clusterIndex;
        const totalMinutes = nodeIndex * 30; // 각 노드마다 30분 간격
        
        const daysInYear = 365;
        const hoursInDay = 24;
        
        const day = 1 + Math.floor(totalMinutes / (hoursInDay * 60)) % daysInYear;
        const month = 1 + Math.floor(day / 31);
        const hour = Math.floor((totalMinutes % (hoursInDay * 60)) / 60);
        
        return `${baseYear}/${String(month).padStart(2, '0')}/${String(day % 31 || 31).padStart(2, '0')}/${String(hour).padStart(2, '0')}00`;
    }

    private getClusterTags(clusterIndex: number): {
        rootTags: string[],
        level1Tags: string[],
        level2Tags: string[]
    } {
        return {
            rootTags: ['Initial', `그룹${clusterIndex + 1}`],
            level1Tags: [`그룹${clusterIndex + 1}`, `그룹${clusterIndex + 1}-2`],
            level2Tags: [`그룹${clusterIndex + 1}`, `그룹${clusterIndex + 1}-2`, `그룹${clusterIndex + 1}-3`]
        };
    }

    private async createNote(clusterIndex: number, nodeIndex: number, title: string, tags: string[], links: string[] = []): Promise<void> {
        const path = this.getNodePath(clusterIndex, nodeIndex);
        
        // 폴더가 없으면 생성
        if (!(await this.app.vault.adapter.exists(path))) {
            await this.app.vault.createFolder(path);
        }

        const frontmatterManager = new FrontmatterManager();
        let content = frontmatterManager.generateFrontmatter({ tags });
        
        if (links.length > 0) {
            content += '\n' + links.map(link => `[[${link}]]`).join('\n');
        }

        const filePath = `${path}/${title}.md`;
        await this.app.vault.create(filePath, content);
    }

    private async createCluster(clusterIndex: number): Promise<void> {
        let nodeIndex = 0;

        // 루트 노드 생성 (1개)
        const rootTitle = `dummy-root-${clusterIndex}`;
        const { rootTags, level1Tags, level2Tags } = this.getClusterTags(clusterIndex);
        await this.createNote(clusterIndex, nodeIndex++, rootTitle, rootTags);

        // 첫 번째 레벨 노드들 생성 (6개)
        const level1Nodes: ClusterNode[] = [];
        for (let i = 0; i < 6; i++) {
            const node: ClusterNode = {
                title: `dummy-l1-${clusterIndex}-${i}`,
                tags: level1Tags,
                links: [rootTitle]
            };
            level1Nodes.push(node);
            await this.createNote(clusterIndex, nodeIndex++, node.title, node.tags, node.links);
        }

        // 두 번째 레벨 노드들 생성 (각 레벨1 노드당 8개씩, 총 48개)
        const level2Nodes: ClusterNode[] = [];
        for (let i = 0; i < level1Nodes.length; i++) {
            for (let j = 0; j < 8; j++) {
                const node: ClusterNode = {
                    title: `dummy-l2-${clusterIndex}-${i}-${j}`,
                    tags: level2Tags,
                    links: [
                        level1Nodes[i].title,
                        ...level1Nodes.map(n => n.title)
                    ]
                };
                level2Nodes.push(node);
                await this.createNote(clusterIndex, nodeIndex++, node.title, node.tags, node.links);
            }
        }

        // 세 번째 레벨 노드들 생성 (각 레벨2 노드당 6개씩, 총 240개)
        for (let i = 0; i < level2Nodes.length; i++) {
            for (let j = 0; j < 6; j++) {
                const node: ClusterNode = {
                    title: `dummy-l3-${clusterIndex}-${i}-${j}`,
                    tags: level2Tags,
                    links: [
                        level2Nodes[i].title,
                        ...level1Nodes.map(n => n.title)
                    ]
                };
                await this.createNote(clusterIndex, nodeIndex++, node.title, node.tags, node.links);
            }
        }

        // 노드들 간의 상호 연결 업데이트 (파일 재생성 없이 내용만 수정)
        const rootPath = this.getNodePath(clusterIndex, 0);
        const rootFilePath = `${rootPath}/${rootTitle}.md`;
        const rootContent = await this.app.vault.adapter.read(rootFilePath);
        const updatedRootContent = this.updateNoteLinks(rootContent, level1Nodes.map(n => n.title));
        await this.app.vault.adapter.write(rootFilePath, updatedRootContent);
        
        for (let i = 0; i < level1Nodes.length; i++) {
            const node = level1Nodes[i];
            const linkedNodes = [
                rootTitle,
                ...level1Nodes.filter(n => n.title !== node.title).map(n => n.title),
                ...level2Nodes.filter(n => n.links.includes(node.title)).map(n => n.title)
            ];
            const nodePath = this.getNodePath(clusterIndex, i + 1);
            const nodeFilePath = `${nodePath}/${node.title}.md`;
            const nodeContent = await this.app.vault.adapter.read(nodeFilePath);
            const updatedNodeContent = this.updateNoteLinks(nodeContent, linkedNodes);
            await this.app.vault.adapter.write(nodeFilePath, updatedNodeContent);
        }
    }

    private updateNoteLinks(content: string, links: string[]): string {
        const frontMatterEnd = content.indexOf('---', 3) + 3;
        const frontMatter = content.slice(0, frontMatterEnd);
        const newLinks = links.map(link => `[[${link}]]`).join('\n');
        return frontMatter + '\n' + newLinks;
    }

    async createDummyNotes(): Promise<void> {
        try {
            const clusterCount = await new Promise<number>((resolve) => {
                new InputModal(this.app, {
                    title: "더미 노트 생성",
                    message: "생성할 클러스터의 수를 입력하세요:",
                    placeholder: "1",
                    submitText: "확인"
                }, (result) => {
                    resolve(parseInt(result) || 1);
                }).open();
            });

            const totalNodes = clusterCount * this.NODES_PER_CLUSTER;
            const confirmed = await showConfirmationDialog(this.app, {
                title: "더미 노트 생성 확인",
                message: `총 ${totalNodes}개의 노트가 생성됩니다.\n각 클러스터는 그룹1~그룹${clusterCount}의 태그를 가집니다.\n계속하시겠습니까?`,
                confirmText: "생성",
                cancelText: "취소"
            });

            if (!confirmed) return;

            new Notice("더미 노트 생성을 시작합니다...");
            for (let i = 0; i < clusterCount; i++) {
                await this.createCluster(i);
                new Notice(`클러스터 ${i + 1}/${clusterCount} 생성 완료 (그룹${i + 1} 태그)`);
            }
            
            new Notice(`${totalNodes}개의 더미 노트 생성이 완료되었습니다.`);
        } catch (error) {
            new Notice("더미 노트 생성 중 오류가 발생했습니다.");
            console.error("Error creating dummy notes:", error);
        }
    }
}
