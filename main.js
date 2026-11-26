const PAGE_SIZE = 10;
const SOURCES = [
  {
    file: "ant.json",
    label: "Anthropic",
    list: "ant-list",
    count: "ant-count",
    pager: "ant-pager",
  },
  {
    file: "oai.json",
    label: "OpenAI",
    list: "oai-list",
    count: "oai-count",
    pager: "oai-pager",
  },
];

function todayIso() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function todaySentence(count, label) {
  if (!count) return `No new problems were added today for ${label}.`;
  return `${count} new ${count === 1 ? "problem was" : "problems were"} added today for ${label}.`;
}

function sortByLatest(items) {
  return [...items].sort(
    (a, b) => (b.date || "").localeCompare(a.date || "") || a.name.localeCompare(b.name),
  );
}

function makeLink(url, text, cls) {
  const a = document.createElement("a");
  a.className = cls;
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = text;
  return a;
}

function makeAction(label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pager__btn";
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function renderColumn(items, els, today, page) {
  els.list.replaceChildren();
  els.pager.replaceChildren();
  els.count.textContent = String(items.length);

  if (!items.length) {
    const empty = document.createElement("li");
    empty.className = "paper-list__empty";
    empty.textContent = "none";
    els.list.appendChild(empty);
    return;
  }

  const slice = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  for (const item of slice) {
    const li = document.createElement("li");
    li.className = item.date === today ? "paper-item paper-item--today" : "paper-item";

    const main = document.createElement("div");
    main.className = "paper-item__main";

    const name = document.createElement("span");
    name.className = "paper-item__name";
    name.textContent = item.name;
    main.append(name);

    const meta = document.createElement("div");
    meta.className = "paper-item__meta";

    const date = document.createElement("span");
    date.className = "paper-item__date";
    date.textContent = item.date || "no date";

    meta.append(makeLink(item.url, "[pdf]", "paper-item__pdf"), date);
    li.append(main, meta);
    els.list.appendChild(li);
  }

  const pages = Math.ceil(items.length / PAGE_SIZE);
  if (pages <= 1) return;

  const info = document.createElement("span");
  info.className = "pager__info";
  info.textContent = `${page + 1} / ${pages}`;

  const controls = document.createElement("div");
  controls.className = "pager__controls";
  if (page > 0)
    controls.append(makeAction("prev", () => renderColumn(items, els, today, page - 1)));
  if (page < pages - 1)
    controls.append(makeAction("next", () => renderColumn(items, els, today, page + 1)));

  els.pager.append(info, controls);
}

async function loadLastUpdated() {
  const el = document.getElementById("last-updated");
  try {
    const res = await fetch("meta.json");
    if (!res.ok) return;
    const { last_updated } = await res.json();
    if (!last_updated) return;

    const formatted = new Date(last_updated).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
    el.textContent = `Last updated: ${formatted}`;
  } catch {
    // Ignore missing/invalid meta.json
  }
}

async function init() {
  const today = todayIso();
  const summaryEl = document.getElementById("today-summary");
  const todayCounts = {};

  await Promise.all([
    ...SOURCES.map(async (src) => {
      const els = {
        list: document.getElementById(src.list),
        count: document.getElementById(src.count),
        pager: document.getElementById(src.pager),
      };
      todayCounts[src.label] = 0;

      try {
        const res = await fetch(src.file);
        if (!res.ok) throw new Error();
        const sorted = sortByLatest(await res.json());
        todayCounts[src.label] = sorted.filter((x) => x.date === today).length;
        renderColumn(sorted, els, today, 0);
      } catch {
        const li = document.createElement("li");
        li.className = "paper-list__empty";
        li.textContent = `failed to load ${src.file}`;
        els.list.appendChild(li);
      }
    }),
    loadLastUpdated(),
  ]);

  summaryEl.textContent = SOURCES.map((s) =>
    todaySentence(todayCounts[s.label], s.label),
  ).join(" ");
}

init();