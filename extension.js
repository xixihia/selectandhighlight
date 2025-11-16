const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// 持久化文件名
const DATA_FILE = "highlights.json";

// 装饰样式（你之后想加颜色只需在这里加）
const DECORATION_TYPES = {
  yellow: vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(255,255,0,0.5)",
    borderRadius: "3px"
  }),
  green: vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(0,255,0,0.3)",
    borderRadius: "3px"
  }),
  blue: vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(0,150,255,0.3)",
    borderRadius: "3px"
  })
};

// 内存缓存
let highlights = {}; // { filePath: { color: [ ranges ] } }

// 加载持久化文件
function loadData(context) {
  const filePath = path.join(context.globalStorageUri.fsPath, DATA_FILE);

  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      highlights = JSON.parse(raw);
    } catch (err) {
      console.error("Failed to load highlights:", err);
    }
  }
}

// 保存持久化数据
function saveData(context) {
  const folder = context.globalStorageUri.fsPath;
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

  const filePath = path.join(folder, DATA_FILE);
  fs.writeFileSync(filePath, JSON.stringify(highlights, null, 2));
}

// 将 ranges 转换为可装饰的 Range
function reviveRange(obj) {
  return new vscode.Range(
    new vscode.Position(obj.start.line, obj.start.character),
    new vscode.Position(obj.end.line, obj.end.character)
  );
}

// 恢复当前打开文件的高亮
function restoreHighlights(editor) {
  if (!editor) return;

  const file = editor.document.uri.fsPath;
  const data = highlights[file];
  if (!data) return;

  for (const color of Object.keys(data)) {
    const ranges = data[color].map(reviveRange);
    editor.setDecorations(DECORATION_TYPES[color], ranges);
  }
}

// 添加高亮
function addHighlight(context, color) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const file = editor.document.uri.fsPath;
  if (!highlights[file]) highlights[file] = {};
  if (!highlights[file][color]) highlights[file][color] = [];

  // 所有选区
  const newRanges = editor.selections
    .filter(sel => !sel.isEmpty)
    .map(sel => ({
      start: { line: sel.start.line, character: sel.start.character },
      end: { line: sel.end.line, character: sel.end.character }
    }));

  // 加入内存
  highlights[file][color].push(...newRanges);

  // 更新显示
  restoreHighlights(editor);

  saveData(context);
}

// 清除所有高亮
function clearHighlights(context) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const file = editor.document.uri.fsPath;
  delete highlights[file];

  // 清除 UI
  for (const type of Object.values(DECORATION_TYPES)) {
    editor.setDecorations(type, []);
  }

  saveData(context);
}

// 插件入口
function activate(context) {
  loadData(context);

  // 命令
  context.subscriptions.push(
    vscode.commands.registerCommand("highlightSelection.yellow", () => addHighlight(context, "yellow")),
    vscode.commands.registerCommand("highlightSelection.green", () => addHighlight(context, "green")),
    vscode.commands.registerCommand("highlightSelection.blue", () => addHighlight(context, "blue")),
    vscode.commands.registerCommand("highlightSelection.clear", () => clearHighlights(context))
  );

  // 打开文件时恢复
  vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor) restoreHighlights(editor);
  });

  // 刚启动恢复当前文件
  if (vscode.window.activeTextEditor) restoreHighlights(vscode.window.activeTextEditor);
}

function deactivate() {}

module.exports = { activate, deactivate };