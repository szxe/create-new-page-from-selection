import {
	App, Editor, MarkdownView, Menu, Modal, Notice, Plugin,
	PluginSettingTab, Setting, TFile, TFolder
} from 'obsidian';

interface MyPluginSettings {
	jumpToNewPage: boolean;
	openWindowMode: 'current' | 'newTab' | 'split';
	saveLocation: 'currentFolder' | 'subFolder' | 'custom';
	linkType: 'wiki' | 'markdown';
	linkDisplayMode: 'short' | 'relative' | 'absolute';
	deleteLinkText: boolean;
	deleteEmptyFolder: boolean;
	showTitleLine: boolean;
	customSavePath: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	jumpToNewPage: true,
	openWindowMode: 'current',
	saveLocation: 'subFolder',
	linkType: 'markdown',
	linkDisplayMode: 'short',
	deleteLinkText: true,
	deleteEmptyFolder: true,
	showTitleLine: true,
	customSavePath: ''
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// 功能1: 新建页面
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
				const sel = editor.getSelection().trim();
				if (sel) {
					menu.addItem((i) =>
						i.setTitle('新建页面')
							.setIcon('file-plus')
							.onClick(async () => await this.createNewPage(sel, view.file))
					);
				}
			})
		);

		// 功能2: 撤销页面
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
				const linkInfo = this.getLinkInfoUnderCursor(editor, view.file);
				if (linkInfo) {
					menu.addItem((i) =>
						i.setTitle('删除页面')
							.setIcon('trash')
							.onClick(async () => await this.deleteLinkFile(linkInfo.file, editor, linkInfo.start, linkInfo.end))
					);
				}
			})
		);

		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	async createNewPage(selectedText: string, currentFile: TFile | null) {
		if (!currentFile) return;
		
		// 确定保存文件夹
		const folder = await this.chooseFolder({ currentFile });
		const safeName = selectedText.replace(/[\\/:#*?"<>|]/g, '_');
		const targetPath = `${folder.path}/${safeName}.md`;

		// 创建文件
		let targetFile = this.app.vault.getAbstractFileByPath(targetPath) as TFile;
		if (!targetFile) {
			const content = this.settings.showTitleLine ? `# ${selectedText}\n\n` : '';
			targetFile = await this.app.vault.create(targetPath, content);
		}

		// 插入链接
		const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
		if (editor) {
			const link = this.buildLink(targetFile, currentFile);
			editor.replaceSelection(link);
		}

		// 跳转到新页面
		if (this.settings.jumpToNewPage) {
			await this.jumpToFile(targetFile);
		}
	}

	async deleteLinkFile(file: TFile, editor: Editor, start: number, end: number) {
		// 获取文件所在文件夹
		const folder = file.parent;
		
		// 删除文件
		await this.app.vault.trash(file, true);
		new Notice(`已删除 ${file.basename}`);
		
		// 删除链接文字（根据设置）
		if (this.settings.deleteLinkText) {
			const line = editor.getCursor().line;
			const lineContent = editor.getLine(line);
			const newLineContent = lineContent.substring(0, start) + lineContent.substring(end);
			editor.setLine(line, newLineContent);
			
			// 调整光标位置
			const newPos = { line: line, ch: start };
			editor.setCursor(newPos);
		} else {
			// 仅删除链接符号，保留显示文字
			const line = editor.getCursor().line;
			const lineContent = editor.getLine(line);
			const linkText = lineContent.substring(start, end);
			
			let displayText = file.basename;
			if (this.settings.linkType === 'wiki') {
				// 处理Wiki链接 [[name]] 或 [[path|name]]
				const wikiMatch = linkText.match(/\[\[(?:.*?\|)?([^\]]*)\]\]/);
				if (wikiMatch) displayText = wikiMatch[1];
			} else {
				// 处理Markdown链接 [name](path)
				const mdMatch = linkText.match(/\[([^\]]*)\]\([^)]*\)/);
				if (mdMatch) displayText = mdMatch[1];
			}
			
			const newLineContent = lineContent.substring(0, start) + displayText + lineContent.substring(end);
			editor.setLine(line, newLineContent);
			
			// 调整光标位置
			const newPos = { line: line, ch: start + displayText.length };
			editor.setCursor(newPos);
		}
		
		// 延迟刷新工作区以清除导航历史
		setTimeout(() => {
			// 触发工作区更新，这有助于清除无效的导航历史
			this.app.workspace.trigger('layout-change');
		}, 100);
		
		// 删除空文件夹（根据设置）
		if (this.settings.deleteEmptyFolder && folder) {
			// 延迟一小段时间后再检查文件夹是否为空，确保文件已完全删除
			setTimeout(async () => {
				await this.deleteEmptyFolder(folder);
			}, 100);
		}
	}

	async deleteEmptyFolder(folder: TFolder) {
		// 等待一小段时间确保文件系统操作完成
		await new Promise(resolve => setTimeout(resolve, 50));
		
		// 重新获取文件夹以确保状态是最新的
		const freshFolder = this.app.vault.getAbstractFileByPath(folder.path);
		if (!freshFolder || !(freshFolder instanceof TFolder)) {
			return;
		}
		
		// 检查文件夹是否为空（只包含系统文件或无文件）
		const hasOnlySystemFiles = freshFolder.children.every(child => 
			child.name.startsWith('.') || child.name.startsWith('~')
		);
		
		if (freshFolder.children.length === 0 || 
			(freshFolder.children.length > 0 && hasOnlySystemFiles)) {
			// 删除空文件夹或只包含系统文件的文件夹
			await this.app.vault.trash(freshFolder, true);
			new Notice(`已删除空文件夹 ${freshFolder.name}`);
			
			// 递归检查父文件夹是否也为空
			const parent = freshFolder.parent;
			if (parent && parent instanceof TFolder) {
				// 延迟检查父文件夹
				setTimeout(async () => {
					await this.deleteEmptyFolder(parent);
				}, 100);
			}
		}
	}

	async chooseFolder({ currentFile }: { currentFile: TFile }): Promise<TFolder> {
		const parent = currentFile.parent!;
		
		switch (this.settings.saveLocation) {
			case 'currentFolder':
				return parent;
			case 'subFolder': {
				const subName = currentFile.basename;
				let sub = parent.children.find((f) => f.name === subName && f instanceof TFolder) as TFolder;
				if (!sub) {
					sub = await this.app.vault.createFolder(`${parent.path}/${subName}`);
				}
				return sub;
			}
			case 'custom': {
				const customPath = this.settings.customSavePath || '/';
				let folder = this.app.vault.getAbstractFileByPath(customPath);
				if (!folder) {
					folder = await this.app.vault.createFolder(customPath);
				}
				return folder as TFolder;
			}
			default:
				return parent;
		}
	}

	buildLink(targetFile: TFile, currentFile: TFile): string {
		const displayText = targetFile.basename;
		let linkPath: string;
		
		switch (this.settings.linkDisplayMode) {
			case 'relative':
				// 基于当前笔记的相对路径
				linkPath = this.app.metadataCache.fileToLinktext(targetFile, currentFile.path);
				break;
			case 'absolute':
				// 基于仓库根目录的绝对路径
				linkPath = targetFile.path;
				break;
			case 'short':
			default:
				// 尽可能简短的形式
				linkPath = targetFile.basename;
				break;
		}
		
		// 根据链接类型生成链接
		if (this.settings.linkType === 'wiki') {
			// Wiki链接格式
			switch (this.settings.linkDisplayMode) {
				case 'relative':
				case 'absolute':
					// 当使用相对或绝对路径时，总是添加别名
					return `[[${linkPath}|${displayText}]]`;
				case 'short':
				default:
					// 简短形式直接使用文件名
					return `[[${linkPath}]]`;
			}
		} else {
			// Markdown链接格式
			switch (this.settings.linkDisplayMode) {
				case 'relative':
				case 'absolute':
					return `[${displayText}](${linkPath})`;
				case 'short':
				default:
					// 简短形式使用文件名作为显示文本和链接路径
					return `[${displayText}](${linkPath})`;
			}
		}
	}

	async jumpToFile(file: TFile) {
		let leaf;
		switch (this.settings.openWindowMode) {
			case 'newTab':
				leaf = this.app.workspace.getLeaf('tab');
				break;
			case 'split':
				leaf = this.app.workspace.splitActiveLeaf();
				break;
			default:
				leaf = this.app.workspace.getLeaf();
		}
		await leaf.openFile(file);
	}

	getLinkInfoUnderCursor(editor: Editor, currentFile: TFile | null): { file: TFile; start: number; end: number } | null {
		if (!currentFile) return null;
		
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		const cursorPos = cursor.ch;
		
		// Wiki 链接 [[note]] 或 [[note|alias]]
		const wikiLinks = line.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g);
		for (const match of wikiLinks) {
			const start = match.index!;
			const end = start + match[0].length;
			if (cursorPos >= start && cursorPos <= end) {
				const linkpath = match[1];
				const file = this.app.metadataCache.getFirstLinkpathDest(linkpath, currentFile.path);
				if (file) {
					return { file, start, end };
				}
			}
		}
		
		// Markdown 链接 [text](path)
		const mdLinks = line.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g);
		for (const match of mdLinks) {
			const start = match.index!;
			const end = start + match[0].length;
			if (cursorPos >= start && cursorPos <= end) {
				const linkpath = match[2];
				const file = this.app.metadataCache.getFirstLinkpathDest(linkpath, currentFile.path);
				if (file) {
					return { file, start, end };
				}
			}
		}
		
		return null;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;
	
	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: '新建页面 & 删除页面设置' });

		// 选项1: 跳转页面
		new Setting(containerEl)
			.setName('跳转页面')
			.setDesc('控制创建新页面后是否自动跳转到新页面')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.jumpToNewPage)
					.onChange(async (value) => {
						this.plugin.settings.jumpToNewPage = value;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		// 选项2: 打开窗口方式
		if (this.plugin.settings.jumpToNewPage) {
			new Setting(containerEl)
				.setName('打开窗口方式')
				.setDesc('当跳转页面功能开启时，选择新页面的打开方式')
				.addDropdown(dropdown =>
					dropdown
						.addOption('current', '当前页')
						.addOption('newTab', '新标签页')
						.addOption('split', '分屏')
						.setValue(this.plugin.settings.openWindowMode)
						.onChange(async (value: any) => {
							this.plugin.settings.openWindowMode = value;
							await this.plugin.saveSettings();
						})
				);
		}

		// 选项3: 选择新建文件保存位置
		new Setting(containerEl)
			.setName('选择新建文件保存位置')
			.setDesc('指定新建笔记的保存位置')
			.addDropdown(dropdown =>
				dropdown
					.addOption('currentFolder', '当前文件所在文件夹下')
					.addOption('subFolder', '当前文件所在文件夹下子文件夹')
					.addOption('custom', '自定义位置')
					.setValue(this.plugin.settings.saveLocation)
					.onChange(async (value: any) => {
						this.plugin.settings.saveLocation = value;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		// 自定义路径输入框
		if (this.plugin.settings.saveLocation === 'custom') {
			new Setting(containerEl)
				.setName('自定义保存路径')
				.setDesc('请输入自定义文件夹路径')
				.addText(text =>
					text
						.setPlaceholder('例如: Notes/MyFolder')
						.setValue(this.plugin.settings.customSavePath)
						.onChange(async (value) => {
							this.plugin.settings.customSavePath = value;
							await this.plugin.saveSettings();
						})
				);
		}

		// 选项4: 链接显示类型
		new Setting(containerEl)
			.setName('链接显示类型')
			.setDesc('选择插入的链接格式类型')
			.addDropdown(dropdown =>
				dropdown
					.addOption('wiki', 'Wiki')
					.addOption('markdown', 'Markdown')
					.setValue(this.plugin.settings.linkType)
					.onChange(async (value: any) => {
						this.plugin.settings.linkType = value;
						await this.plugin.saveSettings();
					})
			);

		// 选项5: 链接显示方式
		new Setting(containerEl)
			.setName('链接显示方式')
			.setDesc('控制链接路径的显示方式')
			.addDropdown(dropdown =>
				dropdown
					.addOption('short', '尽可能简短的形式')
					.addOption('relative', '基于当前笔记的相对路径')
					.addOption('absolute', '基于仓库根目录的绝对路径')
					.setValue(this.plugin.settings.linkDisplayMode)
					.onChange(async (value: any) => {
						this.plugin.settings.linkDisplayMode = value;
						await this.plugin.saveSettings();
					})
			);

		// 选项6: 删除页面是否删除链接文字
		new Setting(containerEl)
			.setName('删除页面时是否删除链接文字')
			.setDesc('控制删除页面时如何处理链接文本')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.deleteLinkText)
					.onChange(async (value) => {
						this.plugin.settings.deleteLinkText = value;
						await this.plugin.saveSettings();
					})
			);

		// 选项7: 删除页面后是否删除文件夹
		new Setting(containerEl)
			.setName('删除页面后是否删除文件夹')
			.setDesc('控制删除页面后是否清理空文件夹')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.deleteEmptyFolder)
					.onChange(async (value) => {
						this.plugin.settings.deleteEmptyFolder = value;
						await this.plugin.saveSettings();
					})
			);

		// 选项8: 是否显示标题行
		new Setting(containerEl)
			.setName('是否显示标题行')
			.setDesc('控制新建页面是否自动生成标题行')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.showTitleLine)
					.onChange(async (value) => {
						this.plugin.settings.showTitleLine = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
