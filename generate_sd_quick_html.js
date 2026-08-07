const fs = require("fs");
const path = require("path");

const sourcePath = path.join(__dirname, "system design quick.txt");
const outputPath = path.join(__dirname, "SD.html");
const routeDir = path.join(__dirname, "sd");

const ROUTES = [
  {
    slug: "01-foundations",
    title: "Foundations",
    subtitle: "Interview communication, global chat, scheduler, DynamoDB, locks, replica lag, indexing, sharding, and scaling.",
    start: "## 0. 面试沟通原则",
    end: "## 9. Kafka / Queue / Stream",
    tags: ["Core", "DB", "Scaling"],
  },
  {
    slug: "02-events-state-consistency",
    title: "Events & Consistency",
    subtitle: "Kafka, outbox, stateless servers, multi-region data, concurrency control, cache, idempotency, CAP, and realtime communication.",
    start: "## 9. Kafka / Queue / Stream",
    end: "## 17. Ticketmaster / Seat Reservation",
    tags: ["Kafka", "Consistency", "Reliability"],
  },
  {
    slug: "03-product-systems",
    title: "Product Systems",
    subtitle: "Ticketmaster, Airbnb reservation, payment safety, request signing, webhook reliability, dependency isolation, and provider guardrails.",
    start: "## 17. Ticketmaster / Seat Reservation",
    end: "## 22. Classic System Design Question Bank",
    tags: ["Booking", "Payment", "Webhook"],
  },
  {
    slug: "04-classic-system-design",
    title: "Classic Designs",
    subtitle: "Rewritten interview solutions for URL shortener, rate limiter, crawler, Dropbox, Google Docs, Yelp, Uber, live comments, trading, and ad clicks.",
    start: "## 22. Classic System Design Question Bank",
    end: "## 23. More Product System Design Interview Bank",
    tags: ["Question Bank", "LLD", "System Design"],
  },
  {
    slug: "05-more-product-designs",
    title: "Product Designs II",
    subtitle: "News feed, Instagram, LeetCode, auction, price tracking, dating, local delivery, reactions, and search.",
    start: "## 23. More Product System Design Interview Bank",
    end: "## 24. Low Level Design Interview Bank",
    tags: ["Feed", "Search", "Product"],
  },
  {
    slug: "06-low-level-design",
    title: "Low Level Design",
    subtitle: "Amazon Locker, parking lot, elevator, inventory, rate limiter, spreadsheet formulas, Connect Four, and LLD delivery framework.",
    start: "## 24. Low Level Design Interview Bank",
    end: "## 25. Advanced Infra Patterns Interview Bank",
    tags: ["LLD", "OOP", "State"],
  },
  {
    slug: "07-infra-patterns",
    title: "Infra Patterns",
    subtitle: "API gateway, Redis, Elasticsearch, Flink, read/write scaling, blobs, long-running jobs, saga, realtime, time-series, and staff-level structure.",
    start: "## 25. Advanced Infra Patterns Interview Bank",
    end: "## 26. Data Modeling & Storage Design Interview Bank",
    tags: ["Infra", "Scaling", "Patterns"],
  },
  {
    slug: "08-data-modeling-storage",
    title: "Data Modeling & Storage",
    subtitle: "Data modeling framework, Dropbox metadata, NewsFeed, ride-sharing, streaming video, Cassandra, Kafka, big-data structures, and storage choice.",
    start: "## 26. Data Modeling & Storage Design Interview Bank",
    end: "## 27. Advanced Follow-up Playbooks",
    tags: ["Data Model", "Storage", "Kafka"],
  },
  {
    slug: "09-follow-up-playbooks",
    title: "Follow-up Playbooks",
    subtitle: "Robust payments, price tracking, notification fanout, realtime feed optimization, social search, indexing, networking, scheduling, read scaling, and realtime recommendations.",
    start: "## 27. Advanced Follow-up Playbooks",
    end: "## 28. Interview Strategy & Edge Design Cases",
    tags: ["Playbook", "Scale", "Reliability"],
  },
  {
    slug: "10-interview-strategy-edge-cases",
    title: "Interview Strategy & Edge Cases",
    subtitle: "Messaging app, Pastebin, CAP framing, ML blueprint, behavioral/system-design stories, manager adoption, and staff-level Yelp follow-up.",
    start: "## 28. Interview Strategy & Edge Design Cases",
    end: "## 29. ML System Design Interview Bank",
    tags: ["Interview", "CAP", "Messaging"],
  },
  {
    slug: "11-ml-system-design",
    title: "ML System Design",
    subtitle: "Recommendation, video recommendation, bot detection, harmful content, ML evaluation, feature store, rollout, monitoring, and drift.",
    start: "## 29. ML System Design Interview Bank",
    end: "## 30. Specialized System Design & LLD Extras",
    tags: ["ML", "Recommendation", "Evaluation"],
  },
  {
    slug: "12-specialized-systems",
    title: "Specialized Systems",
    subtitle: "Strava, Google News, YouTube Top K, Uber location index, Reddit feed, high-scale bidding, Design SQL, multithreaded crawler, Gmail, realtime framework, and OOP follow-ups.",
    start: "## 30. Specialized System Design & LLD Extras",
    end: "## 31. Multi-GPU LLM Inference Serving",
    tags: ["Specialized", "Geo", "Crawler"],
  },
  {
    slug: "13-llm-serving",
    title: "Multi-GPU LLM Serving",
    subtitle: "LLM serving architecture, prefill vs decode, PagedAttention-style KV cache management, admission control, preemption, swap, and recomputation.",
    start: "## 31. Multi-GPU LLM Inference Serving",
    end: "### Vision / Video Generation Inference 重点",
    tags: ["LLM", "KV Cache", "Multi-GPU"],
  },
  {
    slug: "14-vision-video-inference",
    title: "Vision / Video",
    subtitle: "Frame loading, preprocessing, multi-GPU communication, memory strategy, OOM debugging, and performance breakdown for video generation MLE roles.",
    start: "### Vision / Video Generation Inference 重点",
    end: "### 更完整的白板架构：Video Generation Serving",
    tags: ["Video", "OOM", "Profiler"],
  },
  {
    slug: "15-video-serving-deep-dive",
    title: "Video Serving Deep Dive",
    subtitle: "Cost estimator, Diffusion / DiT lifecycle, shape bucketing, micro-batching, CUDA Graph, quantization, LoRA, 8-GPU options, and case studies.",
    start: "### 更完整的白板架构：Video Generation Serving",
    end: "## 32. Quick Capacity / Scaling Reference",
    tags: ["DiT", "Scheduler", "8-GPU"],
  },
  {
    slug: "16-quick-reference",
    title: "Quick Reference",
    subtitle: "Capacity triggers and short interview-ready sentences for database choice, consistency, Kafka, outbox, idempotency, cache, and multi-region.",
    start: "## 32. Quick Capacity / Scaling Reference",
    end: null,
    tags: ["Cheatsheet", "Templates", "Review"],
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

function renderMarkdown(markdown, options = {}) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const used = new Set();
  const toc = [];
  const out = [];
  let paragraph = [];
  let listType = null;
  let inCode = false;
  let codeLang = "";
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
      if (/^```/.test(line.trim())) {
        out.push(`<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(code.join("\n"))}</code></pre>`);
        inCode = false;
        codeLang = "";
        code = [];
      } else {
        code.push(raw);
      }
      continue;
    }

    const fence = line.trim().match(/^```(\w+)?/);
    if (fence) {
      flushParagraph();
      closeList();
      inCode = true;
      codeLang = fence[1] || "";
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
      if (!skippedSourceTitle && level === 1 && text === "System Design Quick Notes") {
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
  if (inCode) out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  return { html: out.join("\n"), toc };
}

function extractRoute(source, route) {
  const start = source.indexOf(route.start);
  if (start < 0) throw new Error(`Missing route start marker: ${route.start}`);
  const end = route.end ? source.indexOf(route.end, start + route.start.length) : source.length;
  if (end < 0) throw new Error(`Missing route end marker: ${route.end}`);
  return source.slice(start, end).trim();
}

function pageChrome({ title, subtitle, body, toc, routeIndex, generatedAt }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(title)} - SD</title>
  <link rel="icon" type="image/svg+xml" href="../how_assets_small/logos/system-logo.svg"/>
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
    .table-wrap { overflow-x: auto; margin: 16px 0 24px; }
    table { width: 100%; min-width: 650px; border-collapse: collapse; background: rgba(16, 23, 34, .7); }
    th, td { padding: 11px 12px; border: 1px solid rgba(148, 163, 184, .24); text-align: left; vertical-align: top; }
    th { color: #f8fafc; background: rgba(94, 234, 212, .12); font-size: 13px; text-transform: uppercase; }
    strong { color: #fff; }
    @media (max-width: 860px) {
      .shell { width: min(100% - 20px, 760px); padding-top: 12px; }
      .content { padding-left: 20px; padding-right: 20px; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <main>
      <article class="content">${body}</article>
    </main>
  </div>
</body>
</html>`;
}

function shellPage(routes, generatedAt) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>SD - System Design Routes</title>
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
      grid-template-columns: 210px minmax(0, 1fr);
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
    .route-list {
      display: grid;
      gap: 4px;
    }
    .route {
      display: block;
      padding: 8px 9px;
      border-left: 3px solid transparent;
      color: var(--muted);
      text-decoration: none;
    }
    .route:hover, .route.active {
      border-left-color: var(--accent);
      color: var(--ink);
      background: rgba(94, 234, 212, .09);
    }
    .route strong {
      display: block;
      font-size: 13px;
      line-height: 1.25;
    }
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
      .route-list { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
      iframe { height: 72vh; }
    }
  </style>
</head>
<body>
  <a class="home" href="index.html">Index</a>
  <div class="app">
    <aside>
      <h1>SD</h1>
      <nav class="route-list" aria-label="SD routes">
        ${routes.map((route, index) => `<a class="route${index === 0 ? " active" : ""}" href="sd/${route.slug}.html" target="readerFrame" data-route="${route.slug}">
          <strong>${index + 1}. ${inline(route.title)}</strong>
        </a>`).join("\n        ")}
      </nav>
    </aside>
    <main>
      <iframe name="readerFrame" id="readerFrame" src="sd/${routes[0].slug}.html" title="SD route reader"></iframe>
    </main>
  </div>
  <script>
    const links = Array.from(document.querySelectorAll(".route"));
    links.forEach((link) => {
      link.addEventListener("click", () => {
        links.forEach((item) => item.classList.remove("active"));
        link.classList.add("active");
      });
    });
  </script>
</body>
</html>`;
}

const source = fs.readFileSync(sourcePath, "utf8");
const generatedAt = new Date().toISOString().slice(0, 10);

fs.mkdirSync(routeDir, { recursive: true });
for (const file of fs.readdirSync(routeDir)) {
  if (/^\d\d-[a-z0-9-]+\.html$/.test(file)) {
    fs.unlinkSync(path.join(routeDir, file));
  }
}

for (let i = 0; i < ROUTES.length; i++) {
  const route = ROUTES[i];
  const markdown = extractRoute(source, route);
  const { html, toc } = renderMarkdown(markdown);
  const page = pageChrome({
    title: route.title,
    subtitle: route.subtitle,
    body: html,
    toc,
    routeIndex: i,
    generatedAt,
  });
  fs.writeFileSync(path.join(routeDir, `${route.slug}.html`), page, "utf8");
}

fs.writeFileSync(outputPath, shellPage(ROUTES, generatedAt), "utf8");
console.log(`Wrote ${path.basename(outputPath)} shell and ${ROUTES.length} split route pages.`);
