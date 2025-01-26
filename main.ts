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
		this.addRibbonIcon('plus', '뉴런 생성', () => {
			this.newNoteManager.createNewNote();
		});

		this.addRibbonIcon('copy-plus', '뉴런 연결', () => {
			this.linkNoteManager.createLinkNote();
		});

		this.addRibbonIcon('delete', '뉴런 연결 해제', () => {
			this.deleteLinkManager.deleteLink();
		});

		this.addRibbonIcon('tags', '뉴런 태그 동기화', () => {
			this.updateTagsManager.updateCurrentNoteTags();
		});

		this.addRibbonIcon('zap', '뉴런 강화', () => {
			this.potentiateManager.potentiateNote();
		});

		this.addRibbonIcon('x', '뉴런 삭제', () => {
			this.deleteCurrentNoteManager.deleteNote();
		});

		this.addRibbonIcon('heart-off', '뉴런 비활성화', () => {
			this.deactivateNotesManager.deactivateNotesByTag();
		});

		this.addRibbonIcon('heart-pulse', '뉴런 활성화', () => {
			this.activateNotesManager.activateNotes();
		});

		this.addRibbonIcon('image-plus', '이미지 분석', () => {
			this.aiImageAnalysis.main();
		});

		this.addRibbonIcon('scan-search', '이미지 분석기 실행', () => {
			this.aiImageAnalyzer.main();
		});

		this.addRibbonIcon('messages-square', 'AI 답변 생성', () => {
			this.aiAnswer.main();
		});

		this.addRibbonIcon('dna', 'AI 뉴런 연결', () => {
			this.aiLinkNote.createAILinkNote();
		});

		this.addRibbonIcon('sigma', 'LaTeX 수식 변환', () => {
			this.aiLatexMath.main();
		});

		this.addRibbonIcon('view', '뉴런 시각화', () => {
			this.aiVisualizer.main();
		});

		this.addRibbonIcon('brain-circuit', '뉴런 구조화', () => {
			this.aiStructureNote.main();
		});

		this.addRibbonIcon('folder-sync', '첨부파일 동기화', () => {
			this.updateAttachmentsManager.updateAttachments();
		});

		this.addRibbonIcon('shield-check', '신경망 검사', () => {
			this.integrityCheck.checkIntegrity();
		});

		this.addRibbonIcon('git-branch', '하위 뉴런 생성', () => {
			this.embedNoteManager.createEmbedNote();
		});

		this.addRibbonIcon('blend', '뉴런 복구', () => {
			this.recoverNoteManager.recoverNote();
		});

		this.addRibbonIcon('waypoints', '전역 신경망 구성', () => {
			this.globalGraphManager.applyGlobalGraphConfig();
		});

		this.addRibbonIcon('activity', '뉴런 갱신', () => {
			this.renewNoteManager.renewCurrentNote();
		});

		this.addRibbonIcon('flask-conical', '테스트 뉴런 생성', () => {
			this.createDummyManager.createDummyNotes();
		});

		this.addRibbonIcon('file-code', '뉴런 구조 재구성', () => {
			this.reformatNotesManager.reformatAllNotes();
		});

		// 명령어 추가
		this.addCommand({
			id: 'create-neuron',
			name: '뉴런 생성',
			icon: 'plus',
			callback: () => this.newNoteManager.createNewNote()
		});

		this.addCommand({
			id: 'connect-neuron',
			name: '뉴런 연결',
			icon: 'copy-plus',
			editorCallback: () => this.linkNoteManager.createLinkNote()
		});

		this.addCommand({
			id: 'sync-neuron-tags',
			name: '뉴런 태그 동기화',
			icon: 'tags',
			callback: () => this.updateTagsManager.updateCurrentNoteTags()
		});

		this.addCommand({
			id: 'strengthen-neuron',
			name: '뉴런 강화',
			icon: 'zap',
			callback: () => this.potentiateManager.potentiateNote()
		});

		this.addCommand({
			id: 'disconnect-neuron',
			name: '뉴런 연결 해제',
			icon: 'delete',
			editorCallback: () => this.deleteLinkManager.deleteLink()
		});

		this.addCommand({
			id: 'delete-neuron',
			name: '뉴런 삭제',
			icon: 'x',
			callback: () => this.deleteCurrentNoteManager.deleteNote()
		});

		this.addCommand({
			id: 'deactivate-neuron',
			name: '뉴런 비활성화',
			icon: 'heart-off',
			callback: () => this.deactivateNotesManager.deactivateNotesByTag()
		});

		this.addCommand({
			id: 'activate-neuron',
			name: '뉴런 활성화',
			icon: 'heart-pulse',
			callback: () => this.activateNotesManager.activateNotes()
		});

		this.addCommand({
			id: 'analyze-image',
			name: '이미지 분석',
			icon: 'image-plus',
			editorCallback: () => this.aiImageAnalysis.main()
		});

		this.addCommand({
			id: 'run-image-analyzer',
			name: '이미지 분석기 실행',
			icon: 'scan-search',
			editorCallback: () => this.aiImageAnalyzer.main()
		});

		this.addCommand({
			id: 'generate-ai-answer',
			name: 'AI 답변 생성',
			icon: 'messages-square',
			editorCallback: () => this.aiAnswer.main()
		});

		this.addCommand({
			id: 'connect-ai-neuron',
			name: 'AI 뉴런 연결',
			icon: 'dna',
			editorCallback: () => this.aiLinkNote.createAILinkNote()
		});

		this.addCommand({
			id: 'convert-latex',
			name: 'LaTeX 수식 변환',
			icon: 'sigma',
			editorCallback: () => this.aiLatexMath.main()
		});

		this.addCommand({
			id: 'visualize-neuron',
			name: '뉴런 시각화',
			icon: 'view',
			editorCallback: () => this.aiVisualizer.main()
		});

		this.addCommand({
			id: 'structure-neuron',
			name: '뉴런 구조화',
			icon: 'brain-circuit',
			editorCallback: () => this.aiStructureNote.main()
		});

		this.addCommand({
			id: 'sync-attachments',
			name: '첨부파일 동기화',
			icon: 'folder-sync',
			callback: () => this.updateAttachmentsManager.updateAttachments()
		});

		this.addCommand({
			id: 'check-neural-network',
			name: '신경망 검사',
			icon: 'shield-check',
			callback: () => this.integrityCheck.checkIntegrity()
		});

		this.addCommand({
			id: 'create-test-neuron',
			name: '테스트 뉴런 생성',
			icon: 'flask-conical',
			callback: () => this.createDummyManager.createDummyNotes()
		});

		this.addCommand({
			id: 'create-sub-neuron',
			name: '하위 뉴런 생성',
			icon: 'git-branch',
			editorCallback: () => this.embedNoteManager.createEmbedNote()
		});

		this.addCommand({
			id: 'recover-neuron',
			name: '뉴런 복구',
			icon: 'blend',
			editorCallback: () => this.recoverNoteManager.recoverNote()
		});

		this.addCommand({
			id: 'configure-global-network',
			name: '전역 신경망 구성',
			icon: 'waypoints',
			callback: () => this.globalGraphManager.applyGlobalGraphConfig()
		});

		this.addCommand({
			id: 'refresh-neuron',
			name: '뉴런 갱신',
			icon: 'activity',
			callback: () => this.renewNoteManager.renewCurrentNote()
		});

		this.addCommand({
			id: 'restructure-neuron',
			name: '뉴런 구조 재구성',
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

