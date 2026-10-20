/**
 * 个人主页静态站点生成器（零依赖）
 *
 * 用法：
 *   node build.js                 生成到仓库根目录（GitHub Pages 直接发布根目录）
 *   node build.js --out=site      生成到 site/ 子目录（媒体会复制一份）
 *
 * 设计要点：默认「原地输出」，媒体文件不复制，仓库体积不翻倍。
 *   - build.js 放在仓库根目录，生成 index.html 到根目录，assets/ 即站点资源
 *   - GitHub Pages 设置 Deploy from a branch → main / (root) 即可上线
 *
 * 内容约定（可扩展）：
 *   - 根目录下的「简介.txt / 简介.md」→ 页面顶部的个人介绍，姓名自动加粗放大置顶
 *   - 每个文件夹 = 一个层级，标题去掉开头的「数字_」前缀，数字决定排列顺序
 *   - 文件夹内的 readme.txt / readme.md → 标题下方的简介
 *   - 文件夹内的图片 / 视频 → 按文件名数字顺序展示；
 *     文件名含下划线的（如 1_1.png、1_2.png）视为同一行，1.png 换到下一行
 *   - 新增项目：加一个「6_xxx」文件夹 + 里面的 readme 和图片视频即可，无需改代码
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ASSETS = path.join(ROOT, 'assets');

// --out=xxx 决定输出位置；默认原地（仓库根目录）
const outArg = process.argv.find((a) => a.startsWith('--out='));
const IN_PLACE = !outArg;
const OUT = IN_PLACE ? ROOT : path.join(ROOT, outArg.slice('--out='.length));

const IGNORE_DIRS = new Set([
  'site', 'node_modules', 'tmp', '.git', '.workbuddy', '.vscode', '.idea', 'assets',
]);
const README_RE = /^readme(\.md|\.txt|\.markdown)?$/i;
const INTRO_RE = /^简介(\.md|\.txt)?$/;

/**
 * 重点关键词：目录（顶部导航）里命中的项目会加粗高亮。
 *
 * 支持两种写法：
 *   '机械臂'      —— 标题包含即命中（匹配任意层级）
 *   '项目经历/小马智行项目' —— 按路径前缀匹配，该目录及其所有子项都会加粗
 *
 * 想强调别的项目，改这里即可，无需动样式。
 */
const FEATURED = ['项目经历/小马智行项目', '机械臂'];

/** 判断某个节点是否命中重点规则（node 带 ancestors 路径数组） */
function isFeatured(node) {
  const full = [...node.ancestors, node.title].join('/');
  return FEATURED.some((rule) =>
    rule.includes('/') ? full.includes(rule) : node.title.includes(rule)
  );
}

/** 需要原样拷贝到站点的媒体/附件扩展名 */
const MEDIA_EXT = {
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp', '.svg'],
  video: ['.mp4', '.webm', '.mov', '.m4v', '.ogv'],
  file: ['.pdf', '.zip'],
};

/* ------------------------------------------------------------------ 工具 */

/** 把数组按 size 分块，用于把简介字段排成一行几个 */
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const isDir = (p) => fs.existsSync(p) && fs.statSync(p).isDirectory();

function listDir(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => !d.name.startsWith('.'))
    .filter((d) => !IGNORE_DIRS.has(d.name))
    .map((d) => ({ name: d.name, dir: d.isDirectory() }))
    .sort((a, b) => naturalCompare(orderKey(a.name), orderKey(b.name)));
}

/** 自然排序：数字按数值比较，中文按拼音（浏览器端无关，这里用码点近似） */
function naturalCompare(a, b) {
  const ax = String(a).match(/\d+|\D+/g) || [];
  const bx = String(b).match(/\d+|\D+/g) || [];
  for (let i = 0; i < Math.max(ax.length, bx.length); i++) {
    const x = ax[i];
    const y = bx[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xn = /^\d/.test(x);
    const yn = /^\d/.test(y);
    if (xn && yn) {
      const d = Number(x) - Number(y);
      if (d !== 0) return d;
    } else if (xn !== yn) {
      return xn ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

/** 排序用的键：把开头的数字提出来，纯数字的排在最前并按数值排 */
function orderKey(name) {
  const m = name.match(/^(\d+)(.*)$/);
  if (m) return [0, Number(m[1]), m[2]];
  return [1, 0, name];
}

/** 标题清洗：只剥掉开头的一个「数字 + 分隔符」前缀（3_3D Occupancy → 3D Occupancy），并去掉结尾分隔符 */
function cleanTitle(name) {
  let t = name.replace(/\.[^.]+$/, '');
  t = t.replace(/^\d+[_\-. 、]+/, '');
  t = t.replace(/[_\-\s]+$/, '');
  return t || name;
}

/** 文件名 → 展示用标题：只去掉扩展名，保留 2_1 这类下划线编号（用于辨认行内顺序） */
function fileLabel(file) {
  return String(file).replace(/\.[^.]+$/, '');
}

/* ------------------------------------------------------- 轻量 markdown 渲染 */

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

/**
 * 把 readme 文本渲染成 HTML。
 * 针对技术项目描述的习惯写法做了适配：
 *   「输入：xxx」      → 键值行
 *   「改进点细节：」   → 小标题
 *   「1.数据增强」     → 有序列表
 *   「- xxx」/「* xxx」→ 无序列表
 *   「# xxx」          → 标题
 *   其余连续行        → 段落
 */
function renderRichText(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null; // 'ul' | 'ol'

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(' '))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  const flushAll = () => {
    flushPara();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) {
      flushAll();
      continue;
    }

    let m;
    // # 标题
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      flushAll();
      const lv = Math.min(6, m[1].length + 3);
      out.push(`<h${lv}>${inline(m[2])}</h${lv}>`);
      continue;
    }
    // 有序列表 1. / 1、
    if ((m = line.match(/^\s*(\d+)[.、)]\s*(.+)$/))) {
      flushPara();
      if (list !== 'ol') {
        flushList();
        out.push('<ol>');
        list = 'ol';
      }
      out.push(`<li>${inline(m[2])}</li>`);
      continue;
    }
    // 无序列表
    if ((m = line.match(/^\s*[-*+]\s+(.+)$/))) {
      flushPara();
      if (list !== 'ul') {
        flushList();
        out.push('<ul>');
        list = 'ul';
      }
      out.push(`<li>${inline(m[1])}</li>`);
      continue;
    }
    // 键值 / 小标题：「xxx：」 或 「xxx：yyy」
    if ((m = line.match(/^([^：:]{1,24})[：:]\s*(.*)$/))) {
      flushAll();
      const k = m[1].trim();
      const v = m[2].trim();
      if (!v) {
        out.push(`<p class="rt-label">${inline(k)}</p>`);
      } else {
        out.push(
          `<div class="rt-kv"><div class="rt-k">${inline(k)}</div><div class="rt-v">${inline(v)}</div></div>`
        );
      }
      continue;
    }
    // 普通段落
    flushList();
    para.push(line.trim());
  }
  flushAll();
  return out.join('\n');
}

/* ---------------------------------------------------------- 简介（个人信息） */

/** 解析根目录的简介文件：首行是姓名，其余是「标签：值」 */
function parseIntro(text) {
  const lines = String(text)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim());
  if (!lines.length) return { name: '', items: [] };

  const name = lines[0].trim();
  const items = [];
  for (const line of lines.slice(1)) {
    const m = line.match(/^([^：:]{1,24})[：:]\s*(.*)$/);
    if (m) {
      items.push({ k: m[1].replace(/\s+/g, ' ').trim(), v: m[2].trim() });
    } else {
      items.push({ k: '', v: line.trim() });
    }
  }
  return { name, items };
}

/* ---------------------------------------------------------- 媒体分组（行） */

/**
 * 把一个文件夹里的媒体文件按「行」分组。
 *   1.png        → 第 1 行
 *   1_1.png 1_2  → 第 1 行（同一行）
 *   2.png        → 第 2 行
 *   无数字前缀（如 微信视频_xxx.mp4）→ 排在数字项之后，每个文件独占一行，按名称自然排序
 */
function groupMedia(files) {
  const numbered = new Map();
  const unnumbered = [];

  for (const f of files) {
    const stem = f.name.replace(/\.[^.]+$/, '');
    const m = stem.match(/^(\d+)(?:_\d+)*$/);
    if (m) {
      const key = Number(m[1]);
      if (!numbered.has(key)) numbered.set(key, []);
      numbered.get(key).push({ ...f, sub: stem });
    } else {
      unnumbered.push({ ...f, sub: stem });
    }
  }

  const rows = [...numbered.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, list]) => list.sort((a, b) => naturalCompare(a.sub, b.sub)));

  // 无数字前缀的文件：按名称排序，每个独占一行
  unnumbered
    .sort((a, b) => naturalCompare(a.sub, b.sub))
    .forEach((f) => rows.push([f]));

  return rows;
}

function mediaKind(file) {
  const ext = path.extname(file.name).toLowerCase();
  if (MEDIA_EXT.image.includes(ext)) return 'image';
  if (MEDIA_EXT.video.includes(ext)) return 'video';
  if (MEDIA_EXT.file.includes(ext)) return 'file';
  return null;
}

/* ---------------------------------------------------------------- 扫描目录 */

function scanNode(absDir, relDir, depth, ancestors = []) {
  const entries = listDir(absDir);
  const folders = entries.filter((e) => e.dir);
  const files = entries.filter((e) => !e.dir);

  // readme
  let readmeFile = files.find((f) => README_RE.test(f.name));
  let introFile = null;
  if (depth === 0) introFile = files.find((f) => INTRO_RE.test(f.name));

  const media = files
    .filter((f) => mediaKind(f))
    .map((f) => ({ ...f, kind: mediaKind(f) }));

  // 其它说明性文本（不是 readme 也不是媒体）也当作简介的一部分
  const extraText = files.filter(
    (f) => !README_RE.test(f.name) && !INTRO_RE.test(f.name) && !mediaKind(f) && /\.(txt|md|markdown)$/i.test(f.name)
  );

  const title = cleanTitle(path.basename(absDir));

  return {
    title,
    ancestors,                                // 从根到父级的标题链，用于按路径匹配重点项
    relDir,
    depth,
    readme: readmeFile ? fs.readFileSync(path.join(absDir, readmeFile.name), 'utf8') : '',
    extraText: extraText.map((f) => ({
      title: fileLabel(f.name),
      text: fs.readFileSync(path.join(absDir, f.name), 'utf8'),
    })),
    rows: groupMedia(media),
    children: folders.map((f) =>
      scanNode(path.join(absDir, f.name), path.join(relDir, f.name), depth + 1, [...ancestors, title])
    ),
  };
}

/* ------------------------------------------------------------------ 拷贝 */

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const d of fs.readdirSync(src, { withFileTypes: true })) {
    if (d.name.startsWith('.')) continue;
    const s = path.join(src, d.name);
    const t = path.join(dest, d.name);
    if (d.isDirectory()) copyDir(s, t);
    else fs.copyFileSync(s, t);
  }
}

/* ------------------------------------------------------------------ 渲染 */

const urlPath = (p) => p.split(path.sep).map(encodeURIComponent).join('/');

/**
 * 媒体单元格：默认折叠，折叠头显示名称 + 「点击展开」，展开后显示实际内容。
 * 用原生 <details>/<summary> 实现：无需 JS、可访问性好、默认可折叠。
 * 视频/图片的 src 延迟到展开时才加载（见 app.js 的 lazy media），
 * 这样默认折叠状态下浏览器不会下载任何媒体，页面首屏极快。
 */
function renderCell(f, relBase) {
  const src = `${relBase}${encodeURIComponent(f.name)}`;
  const label = escapeHtml(fileLabel(f.name));
  const kindText = f.kind === 'video' ? '视频' : f.kind === 'image' ? '图片' : '附件';

  let body;
  if (f.kind === 'image') {
    body = `<img data-src="${src}" alt="${label}" decoding="async" />`;
  } else if (f.kind === 'video') {
    body = `<video data-src="${src}" controls preload="none" playsinline></video>`;
  } else {
    body = `<a href="${src}" target="_blank" rel="noopener">📎 ${label}</a>`;
  }

  return `<details class="cell cell-fold" data-kind="${f.kind}">
      <summary class="fold-head">
        <span class="fold-badge">${kindText}</span>
        <span class="fold-name">${label}</span>
        <span class="fold-toggle" aria-hidden="true">点击展开</span>
      </summary>
      <div class="fold-body">${body}</div>
    </details>`;
}

function renderMediaRows(node) {
  if (!node.rows.length) return '';
  const relBase = node.relDir ? urlPath(node.relDir) + '/' : '';
  return node.rows
    .map((row) => {
      const cells = row.map((f) => renderCell(f, relBase)).join('\n');
      // cols：用于 CSS 判断单个居中 / 多列等间距
      const cols = row.length === 1 ? 'single' : `multi n${Math.min(row.length, 4)}`;
      return `<div class="media-row" data-cols="${cols}">\n${cells}\n</div>`;
    })
    .join('\n');
}

function renderNode(node, ids) {
  const id = ids.get(node);
  const level = Math.min(node.depth + 2, 5); // 根=1，文件夹从 h2 开始
  const body = [];
  if (node.readme.trim()) body.push(`<div class="rich">\n${renderRichText(node.readme)}\n</div>`);
  for (const t of node.extraText) {
    body.push(`<div class="rich">\n${renderRichText(t.text)}\n</div>`);
  }
  const media = renderMediaRows(node);
  if (media) body.push(`<div class="media">\n${media}\n</div>`);

  const kids = node.children.map((c) => renderNode(c, ids)).join('\n');

  return `<section class="node node-d${node.depth}" id="${id}">
  <h${level} class="node-title"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${escapeHtml(node.title)}</h${level}>
  ${body.join('\n')}
  ${kids}
</section>`;
}

function assignIds(root) {
  const ids = new Map();
  const used = new Set();
  const slug = (t, d, n) => {
    let base =
      'n' + d + '-' + String(t).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '');
    if (!base || base === 'n' + d + '-') base = 'n' + d + '-' + n;
    let id = base;
    let i = 2;
    while (used.has(id)) id = `${base}-${i++}`;
    used.add(id);
    return id;
  };
  let counter = 0;
  const walk = (n, d) => {
    ids.set(n, slug(n.title, d, counter++));
    n.children.forEach((c) => walk(c, d + 1));
  };
  root.children.forEach((c) => walk(c, 0));
  return ids;
}

/**
 * 资源版本号：取文件内容的短哈希。
 * GitHub Pages 对静态资源有 max-age 缓存，文件名不带版本号会导致
 * 「改了样式但浏览器仍显示旧版」。加上 ?v=<hash> 后内容一变地址就变，浏览器必然重新拉取。
 */
function assetVersion(name) {
  try {
    const buf = fs.readFileSync(path.join(ASSETS, name));
    let h = 0x811c9dc5;
    for (let i = 0; i < buf.length; i++) {
      h ^= buf[i];
      h = (h * 0x01000193) >>> 0;
    }
    return `?v=${h.toString(36)}`;
  } catch {
    return '';
  }
}

function renderPage(root, intro) {
  const ids = assignIds(root);
  const navItems = [];
  const buildNav = (n) => {
    navItems.push({ id: ids.get(n), title: n.title, depth: n.depth, featured: isFeatured(n) });
    n.children.forEach(buildNav);
  };
  root.children.forEach(buildNav);

  const nav = navItems
    .map((i) => {
      const feat = i.featured ? ' nav-featured' : '';
      return `<a class="nav-i nav-d${i.depth}${feat}" href="#${i.id}">${escapeHtml(i.title)}</a>`;
    })
    .join('\n');

  const introHTML = intro
    ? `<header class="intro" id="top">
  <div class="intro-inner">
    <h1 class="intro-name">${escapeHtml(intro.name)}</h1>
    <div class="intro-meta">
      ${chunk(intro.items, 3)
        .map(
          (row) => `<div class="intro-row">
        ${row
          .map(
            (i) =>
              i.k
                ? `<div class="meta-item"><span class="meta-k">${escapeHtml(i.k)}</span><span class="meta-v">${inline(i.v)}</span></div>`
                : `<div class="meta-item"><span class="meta-v">${inline(i.v)}</span></div>`
          )
          .join('\n        ')}
      </div>`
        )
        .join('\n      ')}
    </div>
  </div>
</header>`
    : '';

  const toc =
    navItems.length > 1
      ? `<nav class="toc" aria-label="目录"><div class="toc-inner"><div class="toc-title">目录</div>\n${nav}\n<span class="fold-bar" id="foldAll"><span class="fold-count">0 / 0</span><button type="button" data-act="all">全部展开</button><button type="button" data-act="none">全部收起</button></span></div></nav>`
      : '';

  const cssV = assetVersion('style.css');
  const jsV = assetVersion('app.js');
  // data URI 的空 favicon，避免浏览器再去请求 /favicon.ico（404 会拖慢首屏）
  const favicon =
    '<link rel="icon" href="data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#2563eb"/><text x="16" y="23" font-size="19" font-family="sans-serif" font-weight="bold" fill="#fff" text-anchor="middle">C</text></svg>'
    ) +
    '" />';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${intro ? escapeHtml(intro.name) + ' 的主页' : '个人主页'}</title>
<meta name="description" content="${intro ? escapeHtml(intro.name) + ' 的个人主页与项目经历' : '个人主页'}" />
<link rel="stylesheet" href="assets/style.css${cssV}" />
${favicon}
</head>
<body>
<a class="skip" href="#main">跳到正文</a>
${introHTML}
${toc}
<main id="main">
${root.children.map((c) => renderNode(c, ids)).join('\n')}
</main>
<footer class="footer">由 build.js 自动生成 · 内容来自仓库目录</footer>
<div class="lightbox" id="lightbox" hidden><button class="lb-close" aria-label="关闭">✕</button><button class="lb-nav lb-prev" aria-label="上一张">‹</button><img alt="" /><button class="lb-nav lb-next" aria-label="下一张">›</button></div>
<script src="assets/app.js${jsV}"></script>
</body>
</html>
`;
}

/* -------------------------------------------------------------------- main */

function cleanOut() {
  // 尽量清空输出目录；若个别文件被占用则跳过（后续写入会覆盖同名文件）
  let entries = [];
  try {
    entries = fs.readdirSync(OUT);
  } catch {
    return;
  }
  for (const name of entries) {
    try {
      fs.rmSync(path.join(OUT, name), { recursive: true, force: true });
    } catch {
      /* 忽略：文件被占用等 */
    }
  }
}

function build() {
  const t0 = Date.now();

  // 原地输出时不清空目录（媒体就在原地）；--out 模式才需要先清空
  if (!IN_PLACE) cleanOut();
  fs.mkdirSync(OUT, { recursive: true });

  // 1. 简介
  let intro = null;
  for (const f of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!f.isFile() || f.name.startsWith('.')) continue;
    if (INTRO_RE.test(f.name)) {
      intro = parseIntro(fs.readFileSync(path.join(ROOT, f.name), 'utf8'));
      break;
    }
  }

  // 2. 内容目录（根目录下的每个文件夹 = 一个层级）
  const topFolders = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !IGNORE_DIRS.has(d.name))
    .map((d) => d.name)
    .sort((a, b) => naturalCompare(orderKey(a), orderKey(b)))
    .map((name) => scanNode(path.join(ROOT, name), name, 0));

  const root = { children: topFolders };

  // 3. 拷贝媒体文件：--out 模式复制一份；原地模式媒体已在 ROOT，不动
  if (!IN_PLACE) {
    for (const name of topFolders.map((f) => f.relDir)) {
      copyDir(path.join(ROOT, name), path.join(OUT, name));
    }
  }

  // 4. 静态资源（原地模式下 assets/ 已在根目录，无需复制）
  if (!IN_PLACE) {
    fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
    fs.copyFileSync(path.join(ASSETS, 'style.css'), path.join(OUT, 'assets', 'style.css'));
    fs.copyFileSync(path.join(ASSETS, 'app.js'), path.join(OUT, 'assets', 'app.js'));
  }
  fs.writeFileSync(path.join(OUT, '.nojekyll'), ''); // GitHub Pages 不走 Jekyll

  // 5. HTML
  fs.writeFileSync(path.join(OUT, 'index.html'), renderPage(root, intro), 'utf8');

  const count = (function c(n) {
    return n.children.reduce((s, k) => s + 1 + c(k), 0);
  })(root);
  console.log(
    `✅ 生成完成：${path.join(OUT, 'index.html')}（${count} 个文件夹 / ${topFolders.length} 个顶层分类，用时 ${Date.now() - t0}ms）`
  );
}

build();
