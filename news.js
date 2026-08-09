const SECTIONS = ["saanich", "victoria", "vancouver", "canada"];

function formatRelativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.max(0, Math.round((now - then) / 60000));
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.round(diffHour / 24);
  return `${diffDay}일 전`;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function renderSection(key, sectionData) {
  const el = document.getElementById(`news-${key}`);
  if (!sectionData || !sectionData.articles || sectionData.articles.length === 0) {
    el.innerHTML = '<p class="loading-text">첫 GitHub Actions 실행 후 데이터가 표시됩니다.</p>';
    return;
  }
  el.innerHTML = sectionData.articles
    .map((a) => {
      const meta = [a.source, formatRelativeTime(a.published)].filter(Boolean).join(" · ");
      const titleLine = a.title_ko
        ? `${escapeHtml(a.title)} - ${escapeHtml(a.title_ko)}`
        : escapeHtml(a.title);
      return `
    <a class="news-item" href="${escapeHtml(a.link)}" target="_blank" rel="noopener noreferrer">
      <div class="news-title">${titleLine}</div>
      <div class="news-meta">${escapeHtml(meta)}</div>
    </a>
  `;
    })
    .join("");
}

async function loadNews() {
  const updatedEl = document.getElementById("page-updated-at");
  let data;
  try {
    const res = await fetch(`data/news.json?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    SECTIONS.forEach((key) => {
      document.getElementById(`news-${key}`).innerHTML =
        '<p class="loading-text">데이터를 불러오지 못했습니다.</p>';
    });
    updatedEl.textContent = "데이터 없음";
    return;
  }

  updatedEl.textContent = data.updated_at
    ? `마지막 갱신: ${formatDateTime(data.updated_at)} UTC`
    : "데이터 없음";

  SECTIONS.forEach((key) => renderSection(key, data.sections && data.sections[key]));
}

loadNews();
