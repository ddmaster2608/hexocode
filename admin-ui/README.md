# Goodnut 博客管理台

本地 WebUI，用于管理 Hexo 博客并一键发布到 `ddmaster2608.github.io`（替代 Qexo）。

## 启动

双击桌面的 **「Goodnut 博客管理台」** 快捷方式（或 `admin-ui/start-admin.cmd`）：未运行则自动启动服务（最小化窗口），然后自动打开浏览器。

也可以在仓库根目录手动执行：

```
npm run admin
```

然后浏览器打开 **http://127.0.0.1:4210**

> 图标文件：`admin-ui/goodnut.ico`（桌面快捷方式）、`admin-ui/public/favicon.svg` / `favicon.ico`（浏览器标签页）。快捷方式若被删除，可用 `admin-ui/start-admin.cmd` 重新创建（右键 → 发送到 → 桌面快捷方式，再在属性里选择图标）。

> 首次使用前需要 `npm ci` 安装依赖（管理台"发布"页里也有安装按钮）。

## 功能

| 页面 | 说明 |
|---|---|
| 文章 | 列表 / 搜索 / 新建 / 编辑 / 删除。编辑器为 Toast UI Editor，工具栏右侧可切换 **Markdown ⇄ 所见即所得（富文本）**，支持直接粘贴图片自动上传 |
| 图床 | 图片统一存放在仓库 `source/images/uploads/年/月/`，随站点一起发布。支持拖拽 / 点击 / Ctrl+V 上传，点击图片可复制站点链接、相对路径或 Markdown 代码 |
| 发布 | 一键发布：提交源码 → `hexo generate` → 强推 `public/` 到 `ddmaster2608.github.io` → 推送源码到 `hexocode`。也可单独构建、启动本地预览（http://127.0.0.1:4000） |

文章「设置」面板里可以填标签、分类、封面图（cover）、abbrlink 等 front-matter 字段，未列出的字段（如已有文章的自定义 meta）会原样保留。

## 发布前必须配置：GitHub Token

发布需要推送权限。编辑 `admin-ui/admin.env`（此文件已被 gitignore，不会提交）：

1. 打开 https://github.com/settings/tokens → **Generate new token (classic)**
2. 勾选 **repo** 权限，生成后复制
3. 填入 `admin.env` 的 `GITHUB_TOKEN=` 后面，重启管理台

## 可选：Cloudflare Pages 镜像（国内访问备用入口）

在 `admin.env` 中填写 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`（见 `admin.env.example` 里的注释步骤）并重启管理台后，每次「发布」会在推送 GitHub Pages 之后自动把站点同步部署到 Cloudflare Pages，地址为 `https://goodnut-blog.pages.dev`（项目名可用 `CLOUDFLARE_PAGES_PROJECT` 修改）。首次发布会自动创建项目。Cloudflare 部署失败不会影响 GitHub Pages 主发布。

其它可选配置（`admin.env`）：

- `ADMIN_USERNAME` / `ADMIN_PASSWORD`：填写后访问管理台需要登录（默认只监听 127.0.0.1，仅本机可访问）
- `ADMIN_PORT`：管理台端口（默认 4210）
- `HEXO_PREVIEW_PORT`：本地预览端口（默认 4000）

## 维护说明

- 编辑器前端 bundle 由 esbuild 打包（npm 包自带的 UMD 版本外部化了 ProseMirror，浏览器不能直接用）。升级 `@toast-ui/editor` 后重新执行：`npm run build:editor`
- Windows 下 Node ≥18.20 禁止 `spawn` 直接调用 `.cmd`（CVE-2024-27980），`server.mjs` 中的 `spawnProcess` 已做兼容
- Linux 部署可参考 `hexo-admin.service` / `hexo-static.service`
