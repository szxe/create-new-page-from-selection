

Obsidian 插件：Create New Page from Selection


插件简介
此Obsidian插件允许用户从当前编辑器中的选中文本快速创建一个新页面，并在当前文件的编辑器中直接打开该新页面。新页面的名称基于选中的文本，并且会在当前文件所在目录的下一级目录中创建。此外，插件还会在当前文件中插入一个指向新页面的链接。


功能特点

• 快速创建新页面：从选中文本快速创建新页面。

• 自动创建目录：如果目标目录不存在，插件会自动创建。

• 插入链接：在当前文件中插入指向新页面的链接。

• 直接打开：新页面会在当前文件的编辑器中直接打开，不会打开新的选项页。


安装方法

• 下载插件文件：

• 将`main.js`文件下载到你的Obsidian插件目录中。通常路径为`Vault/.obsidian/plugins/your-plugin-name/`。

• 如果你没有插件目录，可以手动创建一个。


• 启用插件：

• 在Obsidian中，打开设置（`Settings`）。

• 转到`Third-party plugins`选项卡。

• 点击`Browse community plugins`。

• 搜索`CreateNewPageFromSelection`并启用它。


使用方法


创建新页面

• 选择文本：

• 在Obsidian编辑器中选择一段文本。例如，选择文本`NewPage`。


• 右键菜单：

• 右键点击选中的文本`NewPage`，选择“新建页面”选项。


• 创建新页面：

• 插件会在当前文件所在目录的下一级目录中创建一个新页面。例如，如果当前文件路径为`/currentFolder/currentFile.md`，则新页面的路径为`/currentFolder/currentFile/NewPage.md`。


• 插入链接：

• 在`currentFile.md`中插入链接`[[currentFile/NewPage|NewPage]]`。


• 打开新页面：

• 新页面`NewPage.md`会在当前文件的编辑器中直接打开。


示例


示例 1：创建新页面
假设你有以下文件结构：

```
currentFile.md
```



• 选择文本：

• 在`currentFile.md`中选择文本`NewPage`。


• 右键菜单：

• 右键点击选中的文本`NewPage`，选择“新建页面”选项。


• 创建新页面：

• 插件会在`/currentFolder/currentFile`目录下创建一个新文件`NewPage.md`。


• 插入链接：

• 在`currentFile.md`中插入链接`[[currentFile/NewPage|NewPage]]`。


• 文件结构：

• 创建后，文件结构如下：

```
     /currentFolder
       /currentFile
         NewPage.md
       currentFile.md
 ```



• 打开新页面：

• 新页面`NewPage.md`会在当前文件的编辑器中直接打开。


注意事项

• 文件名冲突：确保选中的文本不包含特殊字符，以避免文件名冲突。如果文件名已存在，插件会直接打开该文件。

• 当前文件路径：新页面会在当前文件所在目录的下一级目录中创建，不会在子目录中创建。

• 编辑器行为：新页面会在当前文件的编辑器中直接打开，不会打开一个新的选项页。


贡献
欢迎任何贡献！如果你有任何改进建议或遇到问题，请随时提交issue或pull request。

