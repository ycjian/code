const MMM_BASE_PATH = "mmm/";
const state = { manifest: null, activeDocId: null };
const els = {
  docList: document.querySelector("#docList"),
  activeGroup: document.querySelector("#activeGroup"),
  activeTitle: document.querySelector("#activeTitle"),
  activeSubtitle: document.querySelector("#activeSubtitle"),
  frame: document.querySelector("#readerFrame"),
  readerMode: document.querySelector("#readerMode"),
  readerTags: document.querySelector("#readerTags")
};

init();

function init() {
  state.manifest = window.MMM_MANIFEST;
  state.manifest.documents.sort((a, b) => a.priority - b.priority);
  renderDocuments();
  openDocument(state.manifest.documents[0].id);
}


function renderDocuments() {
  const groups = new Map();
  state.manifest.documents.forEach(doc => {
    if (!groups.has(doc.group)) groups.set(doc.group, []);
    groups.get(doc.group).push(doc);
  });

  els.docList.innerHTML = "";
  groups.forEach((docs, group) => {
    const groupEl = document.createElement("section");
    groupEl.className = "doc-group";
    groupEl.innerHTML = `<div class="doc-group-title">${escapeHtml(group)}</div><div class="doc-items"></div>`;
    const items = groupEl.querySelector(".doc-items");

    docs.forEach(doc => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `doc-button${doc.id === state.activeDocId ? " active" : ""}`;
      button.innerHTML = `
        <span class="doc-title">${escapeHtml(doc.title)}</span>
        <span class="doc-meta">
          <span class="doc-level">${escapeHtml(doc.kind)} / ${escapeHtml(doc.size)}</span>
          <span class="doc-tags">${doc.tags.slice(0, 3).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</span>
        </span>`;
      button.addEventListener("click", () => openDocument(doc.id));
      items.appendChild(button);
    });

    els.docList.appendChild(groupEl);
  });
}

function openDocument(id) {
  const doc = state.manifest.documents.find(item => item.id === id);
  if (!doc) return;

  state.activeDocId = id;
  els.activeGroup.textContent = `${doc.group} / ${doc.kind}`;
  els.activeTitle.textContent = doc.title;
  els.activeSubtitle.textContent = doc.subtitle;
  els.frame.src = MMM_BASE_PATH + doc.path;
  els.readerMode.textContent = `${doc.group} Console`;
  els.readerTags.innerHTML = doc.tags.slice(0, 5).map(tag => `<span class="mini-chip">${escapeHtml(tag)}</span>`).join("");

  renderDocuments();
}


function formatNumber(value) {
  const num = Number(value || 0);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}


function setupNavToggle() {
  const shell = document.querySelector('.app-shell');
  const library = document.querySelector('.library');
  if (!shell || !library || document.querySelector('.nav-toggle')) return;
  
  const button = document.createElement('button');
  button.className = 'nav-toggle';
  button.type = 'button';
  button.setAttribute('aria-label', 'Toggle navigation');
  button.setAttribute('aria-expanded', 'true');
  button.textContent = '<';
  button.addEventListener('click', () => {
    const collapsed = shell.classList.toggle('nav-collapsed');
    button.setAttribute('aria-expanded', String(!collapsed));
    button.textContent = collapsed ? '>' : '<';
  });
  library.appendChild(button);
}

setupNavToggle();
