const { Plugin, TFile, normalizePath } = require('obsidian');

module.exports = class CreateNewPageFromSelection extends Plugin {
  async onload() {
    // 注册全局右键菜单
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        // 只在 markdown 文件里生效
        if (!(view.file instanceof TFile)) return;
        const selection = editor.getSelection();
        if (!selection.trim()) return; // 没选中文本就不显示

        menu.addItem((item) => {
          item
            .setTitle("新建页面")
            .setIcon("document")
            .onClick(async () => {
              await this.createNoteFromSelection(view.file, selection, editor);
            });
        });
      })
    );
  }

  async createNoteFromSelection(currentFile, selectedText, editor) {
    const { vault, workspace, fileManager } = this.app;

    // 1. 计算文件夹：与当前文件同名
    const folderName = currentFile.basename;
    const folderPath = normalizePath(currentFile.parent.path + "/" + folderName);

    // 如果不存在则创建
    if (!vault.getAbstractFileByPath(folderPath)) {
      await vault.createFolder(folderPath);
    }

    // 2. 计算新文件路径
    const newFileName = selectedText.trim() + ".md";
    const newFilePath = normalizePath(folderPath + "/" + newFileName);

    // 如果文件已存在就打开，不再重复创建
    let newFile = vault.getAbstractFileByPath(newFilePath);
    if (!newFile) {
      newFile = await vault.create(newFilePath, "");
    }

    // 3. 把选中文本替换为 [[绝对路径]] 链接
    //    绝对路径格式：从库根开始，例如 [[folder/subfolder/xxx]]
    const linkPath = newFile.path.replace(/\.md$/, ""); // 去掉 .md
    const linkText = `[[${linkPath}]]`;
    editor.replaceSelection(linkText);

    // 4. 在新标签页打开
    await workspace.openLinkText(newFile.path, "", true, { active: true });
  }

  onunload() {}
}
