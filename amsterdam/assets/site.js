const state = {
  manifest: null,
  activeDocId: null
};

const els = {
  app: document.querySelector(".app-shell"),
  pathList: document.querySelector("#pathList"),
  docList: document.querySelector("#docList"),
  pathCards: document.querySelector("#pathCards"),
  activeGroup: document.querySelector("#activeGroup"),
  activeTitle: document.querySelector("#activeTitle"),
  activeSubtitle: document.querySelector("#activeSubtitle"),
  frame: document.querySelector("#readerFrame"),
  readerMode: document.querySelector("#readerMode"),
  readerTags: document.querySelector("#readerTags")
};

init();

async function init() {
  state.manifest = window.STUDY_MANIFEST;
  if (!state.manifest) {
    const response = await fetch("manifest.json");
    state.manifest = await response.json();
  }
  state.manifest.documents.sort((a, b) => a.priority - b.priority);

  renderPaths();
  renderMap();
  renderDocuments();

  const initial = state.manifest.documents[0];
  openDocument(initial.id);
}

function renderPaths() {
  if (!els.pathList) return;
  els.pathList.innerHTML = "";
  state.manifest.paths.forEach((path, index) => {
    const button = document.createElement("button");
    button.className = "path-button";
    button.type = "button";
    button.innerHTML = `<strong>${index + 1}. ${escapeHtml(path.title)}</strong><span>${escapeHtml(path.description)}</span>`;
    button.addEventListener("click", () => openPath(path.id));
    els.pathList.appendChild(button);
  });
}

function renderMap() {
  if (!els.pathCards) return;
  els.pathCards.innerHTML = "";
  state.manifest.paths.forEach((path, index) => {
    const card = document.createElement("article");
    card.className = "path-card";
    const docs = path.docs.map(id => getDoc(id)).filter(Boolean);
    card.innerHTML = `
      <h4>${escapeHtml(path.title)}</h4>
      <p>${escapeHtml(path.description)}</p>
      <ol>${docs.map(doc => `<li>${escapeHtml(doc.title)}</li>`).join("")}</ol>
    `;
    els.pathCards.appendChild(card);
  });
}


function renderDocuments() {
  const groups = new Map();
  state.manifest.documents
    .forEach(doc => {
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
          <span class="doc-level">${escapeHtml(doc.level)}</span>
          <span class="doc-tags">${doc.tags.slice(0, 3).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</span>
        </span>
      `;
      button.addEventListener("click", () => openDocument(doc.id));
      items.appendChild(button);
    });

    els.docList.appendChild(groupEl);
  });
}

function openPath(pathId) {
  const path = state.manifest.paths.find(item => item.id === pathId);
  if (!path || path.docs.length === 0) return;
  openDocument(path.docs[0]);
}

function openDocument(id) {
  const doc = getDoc(id);
  if (!doc) return;

  state.activeDocId = id;
  els.activeGroup.textContent = `${doc.group} / ${doc.level}`;
  els.activeTitle.textContent = doc.title;
  els.activeSubtitle.textContent = doc.subtitle;
  els.frame.src = doc.path;

  renderDocuments();
}



function getDoc(id) {
  return state.manifest.documents.find(doc => doc.id === id);
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
