// 打包 Toast UI Editor 为浏览器可用的完整 bundle（含中文语言包）
// 构建命令：npm run build:editor
import Editor from '@toast-ui/editor';
import '@toast-ui/editor/dist/i18n/zh-cn';

window.toastui = window.toastui || {};
window.toastui.Editor = Editor;
