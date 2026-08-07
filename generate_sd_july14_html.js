const fs = require("fs");
const path = require("path");

const sourcePath = path.join(__dirname, "sd_july14.md");
const outputPath = path.join(__dirname, "sd_july14.html");
const routeDir = path.join(__dirname, "sd_july14");

const ROUTES = [
  {
    slug: "01-method",
    title: "Interview Method",
    subtitle: "Senior+ System Design 的统一答题框架、45 分钟节奏、工程原则与 28 题地图。",
    start: "## 0. 先学会答题：Senior+ System Design 的统一方法",
    end: "## 1. Design WhatsApp：实时消息、群聊与多设备同步",
    tags: ["Framework", "Interview", "Checklist"],
  },
  {
    slug: "02-realtime-streaming",
    title: "Realtime & Streaming",
    subtitle: "WhatsApp、YouTube、Uber、Netflix：实时通信、媒体流水线、地理派单与全球播放。",
    start: "## 1. Design WhatsApp：实时消息、群聊与多设备同步",
    end: "## 5. Design Amazon：电商平台、库存与订单处理",
    tags: ["Realtime", "Media", "Geo"],
  },
  {
    slug: "03-commerce-social-storage",
    title: "Commerce, Social & Cloud Storage",
    subtitle: "Amazon、Instagram、X、Google Drive：事务、Feed、Fan-out、同步与权限。",
    start: "## 5. Design Amazon：电商平台、库存与订单处理",
    end: "## 9. Design Spotify：Music Streaming、Playlist 与 Personalized Recommendation",
    tags: ["Commerce", "Feed", "Storage"],
  },
  {
    slug: "04-media-core-infra",
    title: "Media & Core Infrastructure",
    subtitle: "Spotify、Zoom、S3、URL Shortener：内容分发、实时媒体、对象存储与全球 Key Lookup。",
    start: "## 9. Design Spotify：Music Streaming、Playlist 与 Personalized Recommendation",
    end: "## 13. Design a Webhook Platform：可靠事件路由与出向 HTTP 交付",
    tags: ["CDN", "WebRTC", "Storage"],
  },
  {
    slug: "05-delivery-orchestration",
    title: "Delivery, Orchestration & Concurrency",
    subtitle: "Webhook、CI/CD、Job Scheduler、Conflict Control：可靠交付、DAG、Lease/Fencing 与 Lost Update。",
    start: "## 13. Design a Webhook Platform：可靠事件路由与出向 HTTP 交付",
    end: "## 17. Design ChatGPT Playground（Streaming LLM Application Backend）",
    tags: ["Workflow", "Fencing", "Reliability"],
  },
  {
    slug: "06-ai-ml-systems",
    title: "AI / ML Systems",
    subtitle: "ChatGPT Playground、Batch Inference、Model Distribution、Real-time Top-K。",
    start: "## 17. Design ChatGPT Playground（Streaming LLM Application Backend）",
    end: "## 21. Design Online Game Leaderboard（Exact Rank, Neighbors, Friends, Seasons）",
    tags: ["LLM", "GPU", "Streaming"],
  },
  {
    slug: "07-ranking-workflows",
    title: "Ranking, Search & Workflows",
    subtitle: "Leaderboard、Crossword、Calendar、Lowest-Cost Book：Exact Rank、分布式搜索、Recurrence 与 Saga。",
    start: "## 21. Design Online Game Leaderboard（Exact Rank, Neighbors, Friends, Seasons）",
    end: "## 25. Design Online Chess：实时对局状态机、棋钟与观战",
    tags: ["Ranking", "Search", "Saga"],
  },
  {
    slug: "08-collaboration-finance-local",
    title: "Collaboration, Payments & Local Search",
    subtitle: "Online Chess、Slack、Stripe、Yelp：权威状态机、企业消息、账本与地理检索。",
    start: "## 25. Design Online Chess：实时对局状态机、棋钟与观战",
    end: "## 29. 跨题复盘：把二十八个系统压缩成可迁移的设计模式",
    tags: ["Realtime", "Payments", "Geo"],
  },
  {
    slug: "09-review-checklist",
    title: "Review & Self-Check",
    subtitle: "把 28 个系统压缩成可迁移模式，并用 Senior+ checklist 完成面试收尾。",
    start: "## 29. 跨题复盘：把二十八个系统压缩成可迁移的设计模式",
    end: null,
    tags: ["Review", "Patterns", "Checklist"],
  },
];

function slugify(text, used) {
  const base = text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "section";
  let slug = base;
  let i = 2;
  while (used.has(slug)) {
    slug = `${base}-${i++}`;
  }
  used.add(slug);
  return slug;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(text) {
  let html = escapeHtml(text);
  html = html.replace(/\$([^$\n]+)\$/g, (whole, expression) => {
    const math = expression.trim();
    return /^(?:\\?[A-Za-z]|[({])/.test(math) ? `\\(${math}\\)` : whole;
  });
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return html;
}

function renderTable(lines) {
  const rows = lines
    .filter((line) => !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line))
    .map((line) => {
      const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
      return trimmed.split("|").map((cell) => inline(cell.trim()));
    });

  if (!rows.length) return "";
  const [head, ...body] = rows;
  return [
    '<div class="table-wrap"><table>',
    "<thead><tr>",
    head.map((cell) => `<th>${cell}</th>`).join(""),
    "</tr></thead>",
    "<tbody>",
    body.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("\n"),
    "</tbody></table></div>",
  ].join("");
}

function mermaidToAscii(source) {
  const labels = new Map();
  const nodePattern = /\b([A-Za-z][A-Za-z0-9_]*)\s*(?:\[\("([\s\S]*?)"\)\]|\["([\s\S]*?)"\]|\[([^\]\n]+)\]|\("([\s\S]*?)"\)|\(([^)\n]+)\))/g;
  for (const line of source.split("\n")) {
    for (const match of line.matchAll(nodePattern)) {
      labels.set(match[1], (match[2] || match[3] || match[4] || match[5] || match[6] || match[1]).replace(/\\n/g, " / "));
    }
  }

  const edges = [];
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line || /^(flowchart|graph|subgraph|end\b|classDef|style|linkStyle)\b/i.test(line)) continue;
    if (!/(-->|<-->|-.+?->|==>)/.test(line)) continue;
    const protectedLabels = [];
    let readable = line.replace(nodePattern, (_, id, a, b, c, d, e) => {
      const token = `@@NODE_${protectedLabels.length}@@`;
      protectedLabels.push(`[${(a || b || c || d || e || labels.get(id) || id).replace(/\\n/g, " / ")}]`);
      return token;
    });
    for (const [id, label] of [...labels.entries()].sort((a, b) => b[0].length - a[0].length)) {
      readable = readable.replace(new RegExp(`\\b${id}\\b`, "g"), `[${label}]`);
    }
    readable = readable
      .replace(/<-->/g, " @@BIDIR@@ ")
      .replace(/-\.\s*"?([^".]*)"?\s*\.->/g, " --$1--> ")
      .replace(/\s*==>\s*/g, " ==> ")
      .replace(/\s*-->\s*/g, " --> ")
      .replace(/@@BIDIR@@/g, "<-->")
      .replace(/\s{2,}/g, " ")
      .trim();
    protectedLabels.forEach((label, index) => {
      readable = readable.replace(`@@NODE_${index}@@`, label);
    });
    edges.push(readable);
  }
  return edges.join("\n");
}

function renderMarkdown(markdown, options = {}) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const used = new Set();
  const toc = [];
  const out = [];
  let paragraph = [];
  let listType = null;
  let inCode = false;
  let codeLang = "";
  let codeFence = "";
  let code = [];
  let skippedSourceTitle = false;
  const tocLevels = options.tocLevels || new Set([2, 3]);

  function flushParagraph() {
    if (!paragraph.length) return;
    out.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!listType) return;
    out.push(`</${listType}>`);
    listType = null;
  }

  function openList(type) {
    if (listType === type) return;
    closeList();
    out.push(`<${type}>`);
    listType = type;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (inCode) {
      if (line.trim().startsWith(codeFence)) {
        const codeText = code.join("\n");
        if (codeLang.toLowerCase() === "mermaid") {
          const ascii = mermaidToAscii(codeText);
          out.push(`<figure class="architecture"><figcaption>Architecture Diagram</figcaption><pre class="mermaid">${escapeHtml(codeText)}</pre><div class="ascii-label">ASCII Architecture · copy-friendly</div><pre class="ascii-diagram"><code>${escapeHtml(ascii)}</code></pre></figure>`);
        } else {
          out.push(`<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeText)}</code></pre>`);
        }
        inCode = false;
        codeLang = "";
        codeFence = "";
        code = [];
      } else {
        code.push(raw);
      }
      continue;
    }

    const fence = line.trim().match(/^(```+|~~~+)\s*([\w+-]+)?\s*$/);
    if (fence) {
      flushParagraph();
      closeList();
      inCode = true;
      codeFence = fence[1][0].repeat(fence[1].length);
      codeLang = fence[2] || "";
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    if (/^\s*\|?.+\|.+/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1])) {
      flushParagraph();
      closeList();
      const table = [];
      while (i < lines.length && lines[i].trim() && /\|/.test(lines[i])) {
        table.push(lines[i]);
        i++;
      }
      i--;
      out.push(renderTable(table));
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      const text = heading[2].trim();
      if (!skippedSourceTitle && level === 1) {
        skippedSourceTitle = true;
        continue;
      }
      const id = slugify(text, used);
      if (tocLevels.has(level)) toc.push({ id, text: text.replace(/`/g, ""), level });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      continue;
    }

    const hr = line.match(/^---+$/);
    if (hr) {
      flushParagraph();
      closeList();
      out.push("<hr/>");
      continue;
    }

    const quote = line.match(/^>\s*(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }

    const bullet = line.match(/^\s*-\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      openList("ul");
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }

    const numbered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      openList("ol");
      out.push(`<li>${inline(numbered[1])}</li>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();
  if (inCode) throw new Error(`Unclosed code fence ${codeFence}`);
  return { html: out.join("\n"), toc };
}

function extractRoute(source, route) {
  const start = source.indexOf(route.start);
  if (start < 0) throw new Error(`Missing route start marker: ${route.start}`);
  const end = route.end ? source.indexOf(route.end, start + route.start.length) : source.length;
  if (end < 0) throw new Error(`Missing route end marker: ${route.end}`);
  return source.slice(start, end).trim();
}

function splitH2Sections(markdown) {
  const matches = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  return matches.map((match, index) => ({
    heading: match[1].trim(),
    markdown: markdown.slice(match.index, matches[index + 1]?.index ?? markdown.length).trim(),
  }));
}

function childNavTitle(heading) {
  const number = heading.match(/^(\d+)\./)?.[1] || "";
  if (number === "0") return "0. Interview Method";
  if (number === "29") return "29. Cross-Case Review";
  if (number === "30") return "30. Senior+ Final Checklist";
  const concise = heading.split("：")[0].replace(/（.*$/, "").trim();
  return concise;
}

function pageChrome({ title, subtitle, body, toc, itemIndex, routeIndex, allItems, generatedAt }) {
  const previous = itemIndex > 0 ? allItems[itemIndex - 1] : null;
  const next = itemIndex + 1 < allItems.length ? allItems[itemIndex + 1] : null;
  const tocHtml = toc.length
    ? `<nav class="jump" aria-label="本路线快速跳转">${toc.map((item) => `<a href="#${item.id}">${inline(item.text)}</a>`).join("")}</nav>`
    : "";
  const pager = `<nav class="pager" aria-label="Case navigation">
    ${previous ? `<a href="${previous.slug}.html">← ${inline(previous.navTitle)}</a>` : `<span></span>`}
    ${next ? `<a class="next" href="${next.slug}.html">${inline(next.navTitle)} →</a>` : `<a class="next" href="../sd_july14.html">Back to reader →</a>`}
  </nav>`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(title)} - System Design 28</title>
  <link rel="icon" type="image/svg+xml" href="../how_assets_small/logos/system-logo.svg"/>
  <link rel="stylesheet" href="../how_assets_small/vendor/katex/katex.min.css"/>
  <style>
    :root {
      color-scheme: dark;
      --bg: #080b10;
      --panel: #101722;
      --ink: #edf5ff;
      --muted: #9fb0c5;
      --line: #263347;
      --accent: #5eead4;
      --accent-2: #fde68a;
      --code: #07111f;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: linear-gradient(180deg, rgba(94,234,212,.08), transparent 360px), var(--bg);
      color: var(--ink);
      font: 16px/1.75 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", Arial, sans-serif;
    }
    a { color: inherit; }
    .shell {
      width: min(1040px, calc(100% - 28px));
      margin: 0 auto;
      padding: 22px 0 56px;
    }
    main {
      min-width: 0;
      border: 1px solid var(--line);
      background: rgba(10, 15, 23, .76);
    }
    .content { padding: 22px 40px 46px; }
    .route-head { padding: 4px 0 22px; border-bottom: 1px solid var(--line); }
    .eyebrow { margin: 0 0 8px; color: var(--accent); font-size: 12px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    .route-title { margin: 0; color: #f8fafc; font-size: clamp(28px, 5vw, 44px); line-height: 1.08; }
    .route-subtitle { max-width: 820px; margin: 12px 0 0; color: var(--muted); }
    .jump { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0 8px; }
    .jump a { padding: 6px 10px; border: 1px solid rgba(94,234,212,.28); background: rgba(94,234,212,.07); color: #dffcf6; text-decoration: none; font-size: 12px; font-weight: 750; }
    .jump a:hover { border-color: var(--accent); background: rgba(94,234,212,.13); }
    h2 {
      margin: 36px 0 14px;
      padding-top: 8px;
      color: var(--accent);
      font-size: 26px;
      line-height: 1.2;
      letter-spacing: 0;
    }
    h3 {
      margin: 28px 0 10px;
      color: #f8fafc;
      font-size: 20px;
      line-height: 1.3;
      letter-spacing: 0;
    }
    h4, h5, h6 { margin: 20px 0 8px; color: #dbeafe; letter-spacing: 0; }
    p, li { color: #d6e0ee; }
    p { margin: 11px 0; }
    ul, ol { margin: 10px 0 16px 24px; padding: 0; }
    li { margin: 6px 0; }
    hr { height: 1px; margin: 30px 0; border: 0; background: var(--line); }
    blockquote {
      margin: 18px 0;
      padding: 14px 18px;
      border-left: 4px solid var(--accent);
      background: rgba(94, 234, 212, .08);
      color: #eef9ff;
      font-weight: 650;
    }
    code {
      padding: 2px 5px;
      border: 1px solid rgba(148, 163, 184, .22);
      background: rgba(7, 17, 31, .9);
      color: #fde68a;
      font: 13px/1.5 "JetBrains Mono", Consolas, "SFMono-Regular", monospace;
    }
    pre {
      overflow: auto;
      margin: 16px 0 22px;
      padding: 16px 18px;
      border: 1px solid rgba(148, 163, 184, .22);
      background: var(--code);
    }
    pre code { display: block; padding: 0; border: 0; background: transparent; color: #dbeafe; white-space: pre; }
    .architecture { margin: 18px 0 26px; }
    .architecture > figcaption, .ascii-label { color: #b8c9dc; font-size: 12px; font-weight: 850; letter-spacing: .06em; text-transform: uppercase; }
    pre.mermaid { display: flex; min-height: 220px; justify-content: center; align-items: center; overflow-x: auto; background: #0a0f17; color: #dbeafe; border-color: rgba(94,234,212,.28); }
    pre.mermaid svg { min-width: 720px; max-width: 100%; height: auto; }
    .ascii-label { margin-top: 12px; color: var(--accent); }
    pre.ascii-diagram { margin-top: 7px; background: #070b10; border-color: rgba(148,163,184,.28); }
    pre.ascii-diagram code { color: #cde7df; font-size: 12px; line-height: 1.55; }
    .katex { color: #eef6ff; font-size: 1.05em; }
    .katex-display { margin: 16px 0 20px; padding: 12px 14px; overflow-x: auto; overflow-y: hidden; border: 1px solid rgba(94,234,212,.2); background: rgba(7,17,31,.72); }
    .table-wrap { overflow-x: auto; margin: 16px 0 24px; }
    table { width: 100%; min-width: 650px; border-collapse: collapse; background: rgba(16, 23, 34, .7); }
    th, td { padding: 11px 12px; border: 1px solid rgba(148, 163, 184, .24); text-align: left; vertical-align: top; }
    th { color: #f8fafc; background: rgba(94, 234, 212, .12); font-size: 13px; text-transform: uppercase; }
    strong { color: #fff; }
    .pager { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--line); }
    .pager a { display: block; padding: 12px 14px; border: 1px solid rgba(148,163,184,.28); background: rgba(16,23,34,.72); color: #dce8f8; text-decoration: none; font-weight: 800; }
    .pager a:hover { border-color: var(--accent); }
    .pager .next { text-align: right; }
    @media (max-width: 860px) {
      .shell { width: min(100% - 20px, 760px); padding-top: 12px; }
      .content { padding-left: 20px; padding-right: 20px; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <main>
      <article class="content">
        <header class="route-head">
          <p class="eyebrow">Case ${itemIndex + 1} / ${allItems.length} · Route ${routeIndex + 1} / ${ROUTES.length}</p>
          <h1 class="route-title">${inline(title)}</h1>
          <p class="route-subtitle">${inline(subtitle)}</p>
          ${tocHtml}
        </header>
        ${body}
        ${pager}
      </article>
    </main>
  </div>
  <script src="../how_assets_small/vendor/katex/katex.min.js"></script>
  <script src="../how_assets_small/vendor/katex/contrib/auto-render.min.js"></script>
  <script>
    renderMathInElement(document.querySelector("article.content"), {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\\\[", right: "\\\\]", display: true },
        { left: "\\\\(", right: "\\\\)", display: false }
      ],
      throwOnError: false,
      strict: "warn",
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"]
    });
  </script>
  <script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "strict",
      flowchart: { htmlLabels: false, curve: "linear", useMaxWidth: true },
      themeVariables: {
        background: "#0a0f17",
        primaryColor: "#142235",
        primaryTextColor: "#eef6ff",
        primaryBorderColor: "#5eead4",
        lineColor: "#93c5fd",
        secondaryColor: "#172033",
        tertiaryColor: "#111827",
        clusterBkg: "#101827",
        clusterBorder: "#475569"
      }
    });
    const diagrams = document.querySelectorAll("pre.mermaid");
    const renderDiagram = async (node) => {
      if (node.dataset.rendered) return;
      node.dataset.rendered = "true";
      await mermaid.run({ nodes: [node] });
    };
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          renderDiagram(entry.target);
        }
      }, { rootMargin: "900px 0px" });
      diagrams.forEach((node) => observer.observe(node));
      const warmDiagrams = async () => {
        await new Promise((resolve) => setTimeout(resolve, 700));
        for (const node of diagrams) {
          if (node.dataset.rendered) continue;
          await new Promise((resolve) => {
            if ("requestIdleCallback" in window) requestIdleCallback(resolve, { timeout: 2500 });
            else setTimeout(resolve, 80);
          });
          await renderDiagram(node);
        }
      };
      warmDiagrams();
    } else {
      diagrams.forEach(renderDiagram);
    }
  </script>
</body>
</html>`;
}

function shellPage(routes, generatedAt) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>System Design 28 - Senior+ SWE / MLE</title>
  <link rel="icon" type="image/svg+xml" href="how_assets_small/logos/system-logo.svg"/>
  <style>
    :root {
      color-scheme: dark;
      --bg: #080b10;
      --panel: #101722;
      --ink: #edf5ff;
      --muted: #9fb0c5;
      --line: #263347;
      --accent: #5eead4;
      --accent-2: #fde68a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: linear-gradient(180deg, rgba(94,234,212,.08), transparent 400px), var(--bg);
      color: var(--ink);
      font: 15px/1.6 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", Arial, sans-serif;
    }
    a { color: inherit; }
    .home {
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 20;
      display: inline-flex;
      align-items: center;
      padding: 8px 11px;
      border: 1px solid rgba(148, 163, 184, .35);
      border-radius: 999px;
      background: rgba(8, 11, 16, .86);
      color: #e5eefb;
      text-decoration: none;
      font-size: 12px;
      font-weight: 800;
    }
    .app {
      display: grid;
      grid-template-columns: 286px minmax(0, 1fr);
      min-height: 100vh;
    }
    aside {
      border-right: 1px solid var(--line);
      background: rgba(16, 23, 34, .9);
      padding: 54px 12px 16px;
      overflow: auto;
      max-height: 100vh;
      position: sticky;
      top: 0;
    }
    h1 {
      margin: 0 0 14px;
      color: var(--accent);
      font-size: 28px;
      line-height: 1;
      letter-spacing: 0;
    }
    .meta { margin: -4px 0 16px; color: var(--muted); font-size: 12px; line-height: 1.5; }
    .route-list {
      display: grid;
      gap: 6px;
    }
    .route-group { min-width: 0; }
    .route, .child-link {
      display: block;
      padding: 8px 9px;
      border-left: 3px solid transparent;
      color: var(--muted);
      text-decoration: none;
    }
    .route { border: 1px solid rgba(148,163,184,.14); border-left: 3px solid transparent; background: rgba(8,11,16,.28); }
    .route:hover, .route.active, .child-link:hover, .child-link.active {
      border-left-color: var(--accent);
      color: var(--ink);
      background: rgba(94, 234, 212, .09);
    }
    .route strong {
      display: block;
      font-size: 13px;
      line-height: 1.25;
    }
    .route small { display: block; margin-top: 3px; color: #7f93aa; font-size: 10px; font-weight: 750; text-transform: uppercase; letter-spacing: .06em; }
    .child-list { display: grid; gap: 2px; margin: 3px 0 2px 12px; padding-left: 8px; border-left: 1px solid rgba(94,234,212,.22); }
    .child-list[hidden] { display: none; }
    .child-link { padding: 6px 8px; border-left-width: 2px; font-size: 11.5px; line-height: 1.3; overflow-wrap: anywhere; }
    main {
      min-width: 0;
      padding: 18px;
    }
    iframe {
      display: block;
      width: 100%;
      height: calc(100vh - 36px);
      border: 1px solid var(--line);
      background: #080b10;
    }
    @media (max-width: 900px) {
      .home { position: static; margin: 10px 0 0 10px; }
      .app { display: block; }
      aside { position: relative; max-height: none; padding-top: 18px; border-right: 0; border-bottom: 1px solid var(--line); }
      .route-list { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
      iframe { height: 72vh; }
    }
  </style>
</head>
<body>
  <a class="home" href="index.html">Index</a>
  <div class="app">
    <aside>
      <h1>SD 28</h1>
      <p class="meta">Senior+ SWE / MLE<br/>28 cases · ${routes.length} routes</p>
      <nav class="route-list" aria-label="System Design 28 routes">
        ${routes.map((route, index) => `<div class="route-group" data-group="${route.slug}">
          <a class="route${index === 0 ? " active" : ""}" href="sd_july14/${route.children[0].slug}.html" target="readerFrame" data-route="${route.slug}" data-child="${route.children[0].slug}">
            <strong>${index + 1}. ${inline(route.title)}</strong>
            <small>${route.children.length} ${route.children.length === 1 ? "item" : "items"}</small>
          </a>
          <div class="child-list"${index === 0 ? "" : " hidden"}>
            ${route.children.map((child, childIndex) => `<a class="child-link${index === 0 && childIndex === 0 ? " active" : ""}" href="sd_july14/${child.slug}.html" target="readerFrame" data-route="${route.slug}" data-child="${child.slug}">${inline(child.navTitle)}</a>`).join("\n            ")}
          </div>
        </div>`).join("\n        ")}
      </nav>
    </aside>
    <main>
      <iframe name="readerFrame" id="readerFrame" src="sd_july14/${routes[0].children[0].slug}.html" title="System Design 28 case reader"></iframe>
    </main>
  </div>
  <script>
    const groups = Array.from(document.querySelectorAll(".route-group"));
    const routeLinks = Array.from(document.querySelectorAll(".route"));
    const childLinks = Array.from(document.querySelectorAll(".child-link"));
    const frame = document.getElementById("readerFrame");
    let preserveGroupHashOnLoad = false;
    const activate = (link, hash, updateHash = true) => {
      routeLinks.forEach((item) => item.classList.remove("active"));
      childLinks.forEach((item) => item.classList.remove("active"));
      groups.forEach((group) => { group.querySelector(".child-list").hidden = group !== link.closest(".route-group"); });
      link.closest(".route-group").querySelector(".route").classList.add("active");
      const child = link.classList.contains("child-link") ? link : link.closest(".route-group").querySelector(".child-link");
      child.classList.add("active");
      if (updateHash) history.replaceState(null, "", "#" + hash);
    };
    routeLinks.forEach((link) => link.addEventListener("click", () => {
      preserveGroupHashOnLoad = true;
      activate(link, link.dataset.route);
    }));
    childLinks.forEach((link) => link.addEventListener("click", () => activate(link, link.dataset.child)));
    frame.addEventListener("load", () => {
      try {
        const slug = new URL(frame.contentWindow.location.href).pathname.split("/").pop().replace(/\.html$/, "");
        const child = childLinks.find((link) => link.dataset.child === slug);
        if (child) activate(child, slug, !preserveGroupHashOnLoad);
      } finally {
        preserveGroupHashOnLoad = false;
      }
    });
    const requested = location.hash.slice(1);
    const initialChild = childLinks.find((link) => link.dataset.child === requested);
    const initialRoute = routeLinks.find((link) => link.dataset.route === requested);
    (initialChild || initialRoute || routeLinks[0]).click();
  </script>
</body>
</html>`;
}

const source = fs.readFileSync(sourcePath, "utf8");
const generatedAt = new Date().toISOString().slice(0, 10);
const usedChildSlugs = new Set();

for (let routeIndex = 0; routeIndex < ROUTES.length; routeIndex++) {
  const route = ROUTES[routeIndex];
  route.children = splitH2Sections(extractRoute(source, route)).map((section) => {
    const navTitle = childNavTitle(section.heading);
    const number = section.heading.match(/^(\d+)\./)?.[1] || String(usedChildSlugs.size);
    const name = navTitle.replace(/^\d+\.\s*/, "");
    return {
      ...section,
      navTitle,
      routeIndex,
      slug: `case-${number.padStart(2, "0")}-${slugify(name, usedChildSlugs)}`,
    };
  });
}
const allItems = ROUTES.flatMap((route) => route.children);

fs.mkdirSync(routeDir, { recursive: true });
for (const file of fs.readdirSync(routeDir)) {
  if (/\.html$/.test(file)) {
    fs.unlinkSync(path.join(routeDir, file));
  }
}

for (let itemIndex = 0; itemIndex < allItems.length; itemIndex++) {
  const item = allItems[itemIndex];
  const route = ROUTES[item.routeIndex];
  const { html, toc } = renderMarkdown(item.markdown, { tocLevels: new Set([3]) });
  const page = pageChrome({
    title: item.navTitle,
    subtitle: route.subtitle,
    body: html,
    toc,
    itemIndex,
    routeIndex: item.routeIndex,
    allItems,
    generatedAt,
  });
  fs.writeFileSync(path.join(routeDir, `${item.slug}.html`), page, "utf8");
}

fs.writeFileSync(outputPath, shellPage(ROUTES, generatedAt), "utf8");
console.log(`Wrote ${path.basename(outputPath)} shell with ${ROUTES.length} route groups and ${allItems.length} child pages.`);
