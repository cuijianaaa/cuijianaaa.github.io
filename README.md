# 个人主页

简历 / 项目经历的静态站点，内容直接由仓库目录结构生成。

## 快速开始

```bash
node build.js                                   # 生成到仓库根目录（GitHub Pages 直接发布根目录）
node build.js --out=site                        # 生成到 site/ 子目录（媒体会复制一份）
python -m http.server 8080                      # 本地预览 http://127.0.0.1:8080/
```

零依赖，只需要 Node.js。

## 目录即内容

新增项目**不需要改任何代码**，只要按约定放文件：

```
项目经历/
└── 4_机器人项目/                    ← 文件夹名 = 标题（「4_」前缀去掉，数字决定顺序）
    ├── readme.txt                   ← 标题下方的简介
    ├── 1.png                        ← 第 1 行
    ├── 2_1.png                      ← 第 2 行（与 2_2 并排）
    └── 2_2.png
```

### 规则

| 约定 | 说明 |
|---|---|
| 文件夹 = 层级 | 每嵌套一层，标题降一级（h2 → h3 → h4…） |
| `数字_` 前缀 | 决定排列顺序，**显示时会被去掉** |
| `readme.txt` / `readme.md` | 渲染为标题下方的简介 |
| `1.png` | 第 1 行 |
| `1_1.png`、`1_2.png` | 同一行并排显示 |
| `2.png` | 第 2 行 |
| 无数字前缀（如 `微信视频_xxx.mp4`） | 排在数字项之后，每个独占一行 |

### readme 支持的写法

- `输入：xxx` → 自动渲染成对齐的键值行
- `改进点细节：`（冒号结尾）→ 渲染成小节标题
- `1. xxx` / `- xxx` → 有序 / 无序列表
- `# xxx`、`**加粗**`、`` `代码` ``、Markdown 链接

## 顶部个人介绍

根目录的 `简介.txt`（或 `简介.md`）渲染为页面顶部信息区，**首行作为姓名加粗放大**：

```
崔健
性       别：男
邮       箱：cuijian2015@qq.com
研究方向：计算机视觉，深度学习，感知，大模型，端到端
```

## 文件结构

```
build.js          站点生成器（递归遍历 → 生成 index.html）
index.html        生成产物，请勿手动编辑
assets/
  style.css       样式（浅色主题）
  app.js          图片灯箱 + 目录滚动高亮
.nojekyll         让 GitHub Pages 跳过 Jekyll 处理
```

## 部署

仓库 `cuijianaaa.github.io` 通过 **Settings → Pages → Deploy from a branch → main / (root)** 发布。

改了内容后：

```bash
node build.js
git add -A && git commit -m "update" && git push
```

## 支持的媒体格式

- 图片：jpg / jpeg / png / gif / webp / avif / bmp / svg
- 视频：mp4 / webm / mov / m4v / ogv
- 附件：pdf / zip（显示为下载链接）
