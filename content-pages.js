const CONTENT_VERSION = document.documentElement.dataset.contentVersion ?? "";

function withVersion(url) {
  if (!CONTENT_VERSION) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(CONTENT_VERSION)}`;
}

async function fetchJson(url) {
  const response = await fetch(withVersion(url));
  if (!response.ok) {
    throw new Error(`读取 JSON 失败：${response.status} ${url}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(withVersion(url));
  if (!response.ok) {
    throw new Error(`读取文本失败：${response.status} ${url}`);
  }
  return response.text();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="inline-link">$1</span>');
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let paragraph = [];
  let listItems = [];
  let inCode = false;
  let codeLang = "";
  let codeLines = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    out.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }
    out.push(`<ul>${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  for (const line of lines) {
    const codeStart = line.match(/^```([\w-]*)\s*$/);
    if (codeStart && !inCode) {
      flushParagraph();
      flushList();
      inCode = true;
      codeLang = codeStart[1] ?? "";
      codeLines = [];
      continue;
    }

    if (line.trim() === "```" && inCode) {
      out.push(
        `<pre><code${codeLang ? ` data-lang="${escapeHtml(codeLang)}"` : ""}>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
      );
      inCode = false;
      codeLang = "";
      codeLines = [];
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(heading[1].length, 3);
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const list = line.match(/^\s*[-*]\s+(.+)$/);
    if (list) {
      flushParagraph();
      listItems.push(list[1]);
      continue;
    }

    const numbered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      listItems.push(numbered[1]);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  return out.join("\n");
}

function renderIndexGroups(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.group)) {
      groups.set(item.group, []);
    }
    groups.get(item.group).push(item);
  }

  return [...groups.entries()]
    .map(
      ([group, groupItems]) => `
        <article>
          <h3>${escapeHtml(group)}</h3>
          <ol>
            ${groupItems
              .map(
                (item) => `
                  <li>
                    <a href="${escapeHtml(item.pageUrl)}">
                      <strong>${escapeHtml(item.title)}</strong>
                      <span>${escapeHtml(item.summary)}</span>
                    </a>
                  </li>`,
              )
              .join("")}
          </ol>
        </article>`,
    )
    .join("");
}

function renderCategoryCards(items) {
  return items
    .map(
      (item) => `
        <a class="knowledge-item-card" href="${escapeHtml(item.pageUrl)}">
          <span class="knowledge-item-tag">${escapeHtml(item.group)}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary)}</p>
          <div class="card-meta">
            <span>单篇资料</span>
            <span>进入阅读</span>
          </div>
        </a>`,
    )
    .join("");
}

function renderDetail(item, markdown, options = {}) {
  const backLabel = options.backLabel ?? "回到知识点目录";

  return `
    <article class="knowledge-article" id="${escapeHtml(item.slug)}">
      <div class="article-label">${escapeHtml(item.group)}</div>
      ${markdownToHtml(markdown)}
      <div class="article-actions">
        <a class="back-to-index" href="../">${escapeHtml(backLabel)}</a>
      </div>
    </article>`;
}

function renderError(container, message) {
  container.innerHTML = `
    <article class="knowledge-error">
      <h3>内容加载失败</h3>
      <p>${escapeHtml(message)}</p>
    </article>`;
}

async function initKnowledgeIndexPage(options) {
  const container = document.querySelector(options.containerSelector);
  if (!container) {
    return;
  }

  try {
    const items = await fetchJson(options.manifestUrl);
    container.innerHTML = renderIndexGroups(items);
  } catch (error) {
    renderError(container, error instanceof Error ? error.message : String(error));
  }
}

async function initKnowledgeDetailPage(options) {
  const container = document.querySelector(options.containerSelector);
  if (!container) {
    return;
  }

  try {
    const items = await fetchJson(options.manifestUrl);
    const item = items.find((entry) => entry.slug === options.slug);

    if (!item) {
      throw new Error(`找不到内容：${options.slug}`);
    }

    const markdown = await fetchText(item.contentUrl);
    document.title = `${item.title} | 罗辑的个人工作台`;
    const pageTitle = document.querySelector("[data-detail-title]");
    if (pageTitle) {
      pageTitle.textContent = item.title;
    }
    const pageGroup = document.querySelector("[data-detail-group]");
    if (pageGroup) {
      pageGroup.textContent = item.group;
    }
    const pageSummary = document.querySelector("[data-detail-summary]");
    if (pageSummary) {
      pageSummary.textContent = item.summary;
    }
    container.innerHTML = renderDetail(item, markdown, options);
  } catch (error) {
    renderError(container, error instanceof Error ? error.message : String(error));
  }
}

async function initKnowledgeCategoryPage(options) {
  const container = document.querySelector(options.containerSelector);
  if (!container) {
    return;
  }

  try {
    const items = await fetchJson(options.manifestUrl);
    const itemsBySlug = new Map(items.map((item) => [item.slug, item]));
    const requestedSlugs = options.slugs ?? [];
    const missingSlugs = requestedSlugs.filter((slug) => !itemsBySlug.has(slug));

    if (missingSlugs.length > 0) {
      throw new Error(`找不到分类条目：${missingSlugs.join("、")}`);
    }

    const selectedItems = requestedSlugs.map((slug) => itemsBySlug.get(slug));

    if (selectedItems.length === 0) {
      throw new Error("当前分类还没有可展示的条目。");
    }

    container.innerHTML = renderCategoryCards(selectedItems);

    const countNode = document.querySelector("[data-category-count]");
    if (countNode) {
      countNode.textContent = `${selectedItems.length} 篇资料`;
    }
  } catch (error) {
    renderError(container, error instanceof Error ? error.message : String(error));
  }
}

window.ContentPages = {
  initKnowledgeCategoryPage,
  initKnowledgeIndexPage,
  initKnowledgeDetailPage,
};
