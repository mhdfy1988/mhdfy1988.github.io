# mhdfy1988.github.io

个人工作台主页仓库，对应站点：

- https://mhdfy1988.github.io/

这个站点不是传统单页展示页，而是按“首页 + 多个独立工作区页面”的方式组织。首页负责入口和总览，具体内容进入各自目录页面。

## 当前结构

- `index.html`
  - 首页，总控台与工作区入口
- `agent/`
  - Agent 学习与架构实验工作区
- `homepage/`
  - 个人主页重构记录页
- `notes/`
  - 知识库首页与分类目录
- `toolbox/`
  - 自动化工具箱页面
- `content/knowledge/`
  - 知识点 Markdown 原文与 `manifest.json`
- `content/study-records/`
  - Agent 学习记录 Markdown 原文与 `manifest.json`
- `styles.css`
  - 全站共享样式
- `script.js`
  - 首页与通用交互
- `content-pages.js`
  - 知识库目录页、详情页的运行时内容加载逻辑

## 内容组织规则

- 首页只放入口、状态和导航，不堆深内容。
- `agent/` 只讲专题推进过程、路线和阶段记录。
- `notes/` 只做知识库入口和资料目录。
- 知识点正文优先放在 `content/knowledge/*.md`，页面通过清单渲染，不重复保存多份正文。
- 学习记录正文优先放在 `content/study-records/*.md`，页面通过清单渲染，入口在 `agent/records/`。

## 本地预览

这是一个纯静态 GitHub Pages 仓库，没有构建流程。

在仓库根目录执行：

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

然后打开：

- `http://127.0.0.1:4173/`

## 更新方式

常规更新流程：

1. 修改页面、样式或 `content/knowledge/` 下的内容。
2. 如有缓存版本号，顺手更新 HTML 里的资源查询参数。
3. 本地预览确认首页、工作区入口和知识库目录跳转正常。
4. 提交并同步到 GitHub。

## 说明

- 当前图片主要使用外链图片，预览时需要确认浏览器真实可渲染。
- 仓库已按 GitHub Pages 直接发布方式组织，不依赖额外打包工具。
