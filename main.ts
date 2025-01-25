import { Plugin, TFile } from 'obsidian';
import { NewNote } from './src/modules/command/create/newNote';
import { LinkNote } from './src/modules/command/create/linkNote';
import { UpdateTags } from './src/modules/command/update/updateTags';
import { Potentiate } from './src/modules/command/update/potentiate';
import { DeleteLink } from './src/modules/command/delete/deleteLink';
import { DeleteCurrentNote } from './src/modules/command/delete/deleteCurrentNote';
import { DeactivateNotes } from './src/modules/command/move/deactivateNotes';
import { ActivateNotes } from './src/modules/command/move/activateNotes';
import { GraphManager } from './src/modules/maintenance/utils/graph/graphManager';
import { AILSSSettings, DEFAULT_SETTINGS, AILSSSettingTab } from './src/modules/maintenance/settings/settings';
import { AIImageAnalysis } from './src/modules/ai/image/aiImageAnalysis';
import { AIImageAnalyzer } from './src/modules/ai/image/aiImageAnalyzer';
import { AIAnswer } from './src/modules/ai/text/aiAnswer';
import { AILinkNote } from './src/modules/ai/text/aiLinkNote';
import { AILatexMath } from './src/modules/ai/text/aiLatexMath';
import { AIVisualizer } from './src/modules/ai/text/aiVisualizer';
import { FileCountManager } from './src/modules/maintenance/utils/fileCountManager';
import { AIStructureNote } from './src/modules/ai/text/aiStructureNote';
import { UpdateAttachments } from './src/modules/command/update/updateAttachments';
import { IntegrityCheck } from './src/modules/maintenance/utils/integrityCheck';
import { CreateDummy } from './src/modules/maintenance/utils/dev/createDummy';
import { EmbedNote } from './src/modules/command/create/embedNote';
import { RecoverNote } from './src/modules/command/create/recoverNote';
import { GlobalGraphManager } from './src/modules/maintenance/utils/graph/global/globalGraphManager';
import { RenewNote } from './src/modules/command/move/renewNote';
import { ReformatNotes } from './src/modules/maintenance/utils/dev/reformatNotes';



export default class AILSSPlugin extends Plugin {
	settings: AILSSSettings;
	private newNoteManager: NewNote;
	private linkNoteManager: LinkNote;
	private updateTagsManager: UpdateTags;
	
	private potentiateManager: Potentiate;
	private deleteLinkManager: DeleteLink;
	private deleteCurrentNoteManager: DeleteCurrentNote;
	
	private deactivateNotesManager: DeactivateNotes;
	private activateNotesManager: ActivateNotes;
	private pendingRename: boolean = false;
	private renameTimeout: number | null = null;
	private graphManager: GraphManager;
	private aiImageAnalysis: AIImageAnalysis;
	private aiImageAnalyzer: AIImageAnalyzer;
	private aiAnswer: AIAnswer;
	private aiLinkNote: AILinkNote;
	private aiLatexMath: AILatexMath;
	private aiVisualizer: AIVisualizer;
	private fileCountManager: FileCountManager;
	private aiStructureNote: AIStructureNote;
	private updateAttachmentsManager: UpdateAttachments;
	private integrityCheck: IntegrityCheck;
	private createDummyManager: CreateDummy;
	private embedNoteManager: EmbedNote;
	private recoverNoteManager: RecoverNote;
	private globalGraphManager: GlobalGraphManager;
	private renewNoteManager: RenewNote;
	private reformatNotesManager: ReformatNotes;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new AILSSSettingTab(this.app, this));
		
		this.newNoteManager = new NewNote(this.app, this);
		this.linkNoteManager = new LinkNote(this.app, this);
		this.updateTagsManager = new UpdateTags(this.app, this);
		
		this.potentiateManager = new Potentiate(this.app, this);
		this.deleteLinkManager = new DeleteLink(this.app, this);
		this.deleteCurrentNoteManager = new DeleteCurrentNote(this.app, this);
		
		this.deactivateNotesManager = new DeactivateNotes(this.app, this);
		this.activateNotesManager = new ActivateNotes(this.app, this);

		// GraphManager 초기화
		this.graphManager = new GraphManager(this.app, this);

		// AI 모듈 초기화
		this.aiImageAnalysis = new AIImageAnalysis(this.app, this);
		this.aiImageAnalyzer = new AIImageAnalyzer(this.app, this);
		this.aiAnswer = new AIAnswer(this.app, this);
		this.aiLinkNote = new AILinkNote(this.app, this);
		this.aiLatexMath = new AILatexMath(this.app, this);
		this.aiVisualizer = new AIVisualizer(this.app, this);

		// FileCountManager 초기화
		this.fileCountManager = FileCountManager.getInstance(this.app, this);

		// AIStructureNote 초기화
		this.aiStructureNote = new AIStructureNote(this.app, this);

		// UpdateAttachments 초기화
		this.updateAttachmentsManager = new UpdateAttachments(this.app, this);

		// IntegrityCheck 초기화
		this.integrityCheck = new IntegrityCheck(this.app, this);

		// CreateDummy 초기화
		this.createDummyManager = new CreateDummy(this.app, this);

		// EmbedNote 초기화
		this.embedNoteManager = new EmbedNote(this.app, this);

		// RecoverNote 초기화
		this.recoverNoteManager = new RecoverNote(this.app, this);

		// GlobalGraphManager 초기화
		this.globalGraphManager = new GlobalGraphManager(this.app, this);

		// RenewNote 초기화
		this.renewNoteManager = new RenewNote(this.app, this);

		// ReformatNotes 초기화
		this.reformatNotesManager = new ReformatNotes(this.app, this);

		// 리본 메뉴 아이콘들 업데이트
		this.addRibbonIcon('plus', '새 뉴런 생성', () => {
			this.newNoteManager.createNewNote();
		});

		this.addRibbonIcon('copy-plus', '시냅스 연결', () => {
			this.linkNoteManager.createLinkNote();
		});

		this.addRibbonIcon('delete', '시냅스 제거', () => {
			this.deleteLinkManager.deleteLink();
		});

		this.addRibbonIcon('tags', '시냅스 태그 동기화', () => {
			this.updateTagsManager.updateCurrentNoteTags();
		});

		this.addRibbonIcon('zap', '뉴런 강화', () => {
			this.potentiateManager.potentiateNote();
		});

		this.addRibbonIcon('x', '뉴런 제거', () => {
			this.deleteCurrentNoteManager.deleteNote();
		});

		this.addRibbonIcon('heart-off', '뉴런 비활성화', () => {
			this.deactivateNotesManager.deactivateNotesByTag();
		});

		this.addRibbonIcon('heart-pulse', '뉴런 활성화', () => {
			this.activateNotesManager.activateNotes();
		});

		this.addRibbonIcon('image-plus', '이미지 자동 분석', () => {
			this.aiImageAnalysis.main();
		});

		this.addRibbonIcon('scan-search', '이미지 분석기', () => {
			this.aiImageAnalyzer.main();
		});

		this.addRibbonIcon('messages-square', 'AI 응답 생성', () => {
			this.aiAnswer.main();
		});

		this.addRibbonIcon('dna', 'AI 시냅스 형성', () => {
			this.aiLinkNote.createAILinkNote();
		});

		this.addRibbonIcon('sigma', 'LaTeX 변환', () => {
			this.aiLatexMath.main();
		});

		this.addRibbonIcon('view', '뉴런 시각화', () => {
			this.aiVisualizer.main();
		});

		this.addRibbonIcon('brain-circuit', '뉴런 구조 최적화', () => {
			this.aiStructureNote.main();
		});

		this.addRibbonIcon('folder-sync', '부속물 동기화', () => {
			this.updateAttachmentsManager.updateAttachments();
		});

		this.addRibbonIcon('shield-check', '신경망 무결성 검사', () => {
			this.integrityCheck.checkIntegrity();
		});

		this.addRibbonIcon('git-branch', '서브뉴런 생성', () => {
			this.embedNoteManager.createEmbedNote();
		});

		this.addRibbonIcon('blend', '시냅스 재생성', () => {
			this.recoverNoteManager.recoverNote();
		});

		this.addRibbonIcon('waypoints', '글로벌 신경망 재구성', () => {
			this.globalGraphManager.applyGlobalGraphConfig();
		});

		this.addRibbonIcon('activity', '뉴런 재활성화', () => {
			this.renewNoteManager.renewCurrentNote();
		});

		this.addRibbonIcon('flask-conical', '테스트 뉴런 생성', () => {
			this.createDummyManager.createDummyNotes();
		});

		this.addRibbonIcon('file-code', '노트 경로 및 프론트매터 재구성', () => {
			this.reformatNotesManager.reformatAllNotes();
		});

		// 새 노트 생성 명령어 추가
		this.addCommand({
			id: 'create-new-note',
			name: '새 뉴런 생성',
			icon: 'plus',
			callback: () => this.newNoteManager.createNewNote()
		});

		// 선택 텍스트로 링크 노트 생성 명령어 추가
		this.addCommand({
			id: 'create-link-note',
			name: '시냅스 연결',
			icon: 'copy-plus',
			editorCallback: () => this.linkNoteManager.createLinkNote()
		});

		// 커맨드 추가
		this.addCommand({
			id: 'update-linked-notes-tags',
			name: '시냅스 태그 동기화',
			icon: 'tags',
			callback: () => this.updateTagsManager.updateCurrentNoteTags()
		});

		// 강화 명령어 추가
		this.addCommand({
			id: 'potentiate-note',
			name: '뉴런 강화',
			icon: 'zap',
			callback: () => this.potentiateManager.potentiateNote()
		});

		// 링크 삭제 명령어 추가
		this.addCommand({
			id: 'delete-link',
			name: '선택한 링크와 파일 삭제',
			icon: 'delete',
			editorCallback: () => this.deleteLinkManager.deleteLink()
		});

		// 노트 삭제 명령어 추가
		this.addCommand({
			id: 'delete-current-note',
			name: '현재 노트 삭제',
			icon: 'x',
			callback: () => this.deleteCurrentNoteManager.deleteNote()
		});

		// 비활성화 명령어 추가
		this.addCommand({
			id: 'deactivate-notes-by-tag',
			name: '뉴런 비활성화',
			icon: 'heart-off',
			callback: () => this.deactivateNotesManager.deactivateNotesByTag()
		});

		// 활성화 명령어 추가
		this.addCommand({
			id: 'activate-notes',
			name: '뉴런 활성화',
			icon: 'heart-pulse',
			callback: () => this.activateNotesManager.activateNotes()
		});

		this.addCommand({
			id: 'ai-image-analysis',
			name: '이미지 자동 분석',
			icon: 'image-plus',
			editorCallback: () => this.aiImageAnalysis.main()
		});

		this.addCommand({
			id: 'ai-image-analyzer',
			name: '이미지 분석기',
			icon: 'scan-search',
			editorCallback: () => this.aiImageAnalyzer.main()
		});

		this.addCommand({
			id: 'ai-answer',
			name: 'AI 응답 생성',
			icon: 'messages-square',
			editorCallback: () => this.aiAnswer.main()
		});

		this.addCommand({
			id: 'ai-link-note',
			name: 'AI 시냅스 형성',
			icon: 'dna',
			editorCallback: () => this.aiLinkNote.createAILinkNote()
		});

		this.addCommand({
			id: 'ai-latex-math',
			name: 'LaTeX 변환',
			icon: 'sigma',
			editorCallback: () => this.aiLatexMath.main()
		});

		this.addCommand({
			id: 'ai-visualizer',
			name: '뉴런 시각화',
			icon: 'view',
			editorCallback: () => this.aiVisualizer.main()
		});

		// 구조화 명령어 추가
		this.addCommand({
			id: 'ai-structure-note',
			name: '뉴런 구조 최적화',
			icon: 'brain-circuit',
			editorCallback: () => this.aiStructureNote.main()
		});

		// 첨부 파일 이름 변경 명령어 추가
		this.addCommand({
			id: 'update-attachments',
			name: '부속물 동기화',
			icon: 'folder-sync',
			callback: () => this.updateAttachmentsManager.updateAttachments()
		});

		// 무결성 검사 명령어 추가
		this.addCommand({
			id: 'check-integrity',
			name: '신경망 무결성 검사',
			icon: 'shield-check',
			callback: () => this.integrityCheck.checkIntegrity()
		});

		// 더미 노트 생성 명령어 추가
		this.addCommand({
			id: 'create-dummy-notes',
			name: '테스트 뉴런 생성',
			icon: 'flask-conical',
			callback: () => this.createDummyManager.createDummyNotes()
		});

		// 임베드 노트 생성 명령어 추가
		this.addCommand({
			id: 'create-embed-note',
			name: '서브뉴런 생성',
			icon: 'git-branch',
			editorCallback: () => this.embedNoteManager.createEmbedNote()
		});

		// 복구 명령어 추가
		this.addCommand({
			id: 'recover-note',
			name: '시냅스 재생성',
			icon: 'blend',
			editorCallback: () => this.recoverNoteManager.recoverNote()
		});

		// 글로벌 그래프 설정 적용 명령어 추가
		this.addCommand({
			id: 'apply-global-graph-config',
			name: '글로벌 신경망 재구성',
			icon: 'waypoints',
			callback: () => this.globalGraphManager.applyGlobalGraphConfig()
		});

		// 노트 갱신 명령어 추가
		this.addCommand({
			id: 'renew-note',
			name: '뉴런 재활성화',
			icon: 'activity',
			callback: () => this.renewNoteManager.renewCurrentNote()
		});

		// 노트 재포맷 명령어 추가
		this.addCommand({
			id: 'reformat-notes',
			name: '노트 경로 및 프론트매터 재구성',
			icon: 'file-code',
			callback: () => this.reformatNotesManager.reformatAllNotes()
		});
	}

	onunload() {
		if (this.renameTimeout) {
			window.clearTimeout(this.renameTimeout);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

