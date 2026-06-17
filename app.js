const STORAGE_KEY = "onePieceDataBuilder.v3";
const LEGACY_STORAGE_KEY = "onePieceDataBuilder.v2";
const baseData = window.onePieceData;
const data = loadSavedData() || structuredClone(baseData);

const viewConfig = {
  techniques: { label: "기술명", title: "기술이 나온 화수 보기", listTitle: "기술 목록" },
  people: { label: "사람", title: "사람이 나온 화수 보기", listTitle: "사람 목록" },
  episodes: { label: "에피소드", title: "권별 에피소드 보기", listTitle: "권 목록" },
  organizations: { label: "조직", title: "조직과 세부 조직 보기", listTitle: "조직 목록" },
  devilFruits: { label: "악마의 열매", title: "계통별 악마의 열매 보기", listTitle: "열매 계통" },
  groups: { label: "그룹", title: "직접 만든 그룹 보기", listTitle: "그룹 목록" },
  timelines: { label: "연표", title: "인물별 연표 보기", listTitle: "연표 인물" },
  quiz: { label: "카드 퀴즈", title: "카테고리별 랜덤 카드 퀴즈", listTitle: "퀴즈 카테고리" },
  jobs: { label: "직업", title: "직업별 인물 보기", listTitle: "직업 목록" },
  stats: { label: "인물 정렬", title: "키·연령·현상금·생일 순서 보기", listTitle: "인물 목록" },
  bloodTypes: { label: "혈액형", title: "혈액형별 인물 보기", listTitle: "혈액형 목록" },
  origins: { label: "출신지", title: "출신지별 인물 보기", listTitle: "출신지 목록" },
  editor: { label: "수정", title: "웹에서 바로 데이터 수정", listTitle: "수정" }
};

const quizCategoryMeta = [
  { id: "name", title: "이름", search: "이름 얼굴 인물" },
  { id: "age", title: "나이", search: "나이 연령" },
  { id: "height", title: "키", search: "키 신장" },
  { id: "bounty", title: "현상금", search: "현상금" },
  { id: "bloodType", title: "혈액형", search: "혈액형" },
  { id: "birthday", title: "생일", search: "생일" },
  { id: "origin", title: "출신지", search: "출신지" },
  { id: "alias", title: "별명", search: "별명" },
  { id: "likes", title: "좋아하는 것", search: "좋아하는 것" },
  { id: "fruit", title: "악마의 열매", search: "악마의 열매" },
  { id: "organization", title: "조직", search: "조직 세부 조직" },
  { id: "timeline", title: "연표", search: "연표 사건" }
];

let currentView = "techniques";
let activeId = "";
let sortMode = "all";
let personSortMode = "appearance";
let personEditorQuery = "";
let episodeCharacterQuery = "";
let statMetric = "height";
let statDirection = "asc";
let editorMode = "people";
let activeFruitId = "";
let activeSubOrgId = "";
let activeEpisodeId = "";
let activeQuizCard = null;
let quizFlipped = false;
let quizSession = null;
let quizAnswerDraft = "";
let quizMode = "test";
let quizStudyFlipped = false;
const quizCardCache = new Map();

const tabs = document.querySelectorAll(".tab");
const viewLabel = document.querySelector("#viewLabel");
const viewTitle = document.querySelector("#viewTitle");
const listTitle = document.querySelector("#listTitle");
const countBadge = document.querySelector("#countBadge");
const itemList = document.querySelector("#itemList");
const detail = document.querySelector("#detail");
const detailPane = document.querySelector(".detail-pane");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const searchBox = document.querySelector("#searchBox");
const rangeControls = document.querySelector("#rangeControls");
const rangeButtons = document.querySelectorAll("[data-range]");
const personSortControls = document.querySelector("#personSortControls");
const personSortSelect = document.querySelector("#personSortSelect");
const statSortControls = document.querySelector("#statSortControls");
const statMetricSelect = document.querySelector("#statMetricSelect");
const statDirectionButtons = document.querySelectorAll("[data-stat-direction]");
const mobileViewSelect = document.querySelector("#mobileViewSelect");
const browseWorkspace = document.querySelector("#browseWorkspace");
const editorWorkspace = document.querySelector("#editorWorkspace");
const editorBody = document.querySelector("#editorBody");
const editorModeButtons = document.querySelectorAll(".editor-mode");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

mobileViewSelect.addEventListener("change", () => switchView(mobileViewSelect.value));

rangeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    sortMode = button.dataset.range;
    rangeButtons.forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

personSortSelect.addEventListener("change", () => {
  personSortMode = personSortSelect.value;
  activeId = "";
  render();
});

statMetricSelect.addEventListener("change", () => {
  statMetric = statMetricSelect.value;
  activeId = "";
  render();
});

statDirectionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    statDirection = button.dataset.statDirection;
    activeId = "";
    render();
  });
});

editorModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    editorMode = button.dataset.editorMode;
    editorModeButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderEditor();
  });
});

searchInput.addEventListener("input", render);

function switchView(view) {
  currentView = view;
  activeId = "";
  activeFruitId = "";
  activeSubOrgId = "";
  activeEpisodeId = "";
  sortMode = "all";
  if (view === "people") personSortMode = "appearance";
  searchInput.value = "";
  setActiveTab();
  rangeButtons.forEach((button) => button.classList.toggle("active", button.dataset.range === "all"));
  personSortSelect.value = personSortMode;
  render();
}

function isListOnlyView() {
  return currentView === "stats";
}

function render() {
  const config = viewConfig[currentView];
  viewLabel.textContent = config.label;
  viewTitle.textContent = config.title;

  const isEditor = currentView === "editor";
  const listOnly = isListOnlyView();
  browseWorkspace.classList.toggle("hidden", isEditor);
  browseWorkspace.classList.toggle("list-only-workspace", listOnly);
  browseWorkspace.classList.toggle("quiz-workspace", currentView === "quiz");
  editorWorkspace.classList.toggle("hidden", !isEditor);
  detailPane.classList.toggle("hidden", listOnly);
  searchBox.classList.toggle("hidden", isEditor || currentView === "quiz");

  if (isEditor) {
    renderEditor();
    return;
  }

  listTitle.textContent = config.listTitle;
  rangeControls.classList.add("hidden");
  personSortControls.classList.toggle("hidden", currentView !== "people");
  personSortSelect.value = personSortMode;
  statSortControls.classList.toggle("hidden", currentView !== "stats");
  statMetricSelect.value = statMetric;
  statDirectionButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.statDirection === statDirection);
  });

  const items = getItems();
  const query = searchInput.value.trim().toLowerCase();
  const filteredItems = query ? items.filter((item) => item.searchText.includes(query)) : items;

  countBadge.textContent = `${filteredItems.length}개`;
  itemList.innerHTML = filteredItems.map(renderListItem).join("");
  itemList.querySelectorAll(".item").forEach((button) => {
    button.addEventListener("click", () => {
      activeId = button.dataset.id;
      activeFruitId = "";
      activeSubOrgId = "";
      activeEpisodeId = "";
      render();
    });
  });

  if (listOnly) activeId = "";
  if (!listOnly && !activeId && filteredItems.length > 0) activeId = filteredItems[0].id;
  const activeItem = filteredItems.find((item) => item.id === activeId);
  itemList.querySelectorAll(".item").forEach((button) => {
    button.classList.toggle("active", button.dataset.id === activeId);
  });
  if (listOnly) {
    detail.innerHTML = "";
    return;
  }
  renderDetail(activeItem);
}

function getItems() {
  if (currentView === "techniques") {
    return data.techniques.map((technique) => {
      const owner = findPerson(technique.ownerId);
      return item(technique.id, technique.name, owner ? `사용자: ${owner.name}` : "사용자 미등록", technique, `${technique.name} ${owner?.name || ""}`);
    });
  }
  if (currentView === "people") return sortedPeople(personSortMode).map(personToItem);
  if (currentView === "episodes") return getEpisodeVolumeItems();
  if (currentView === "organizations") {
    return data.organizations.map((org) => {
      const people = data.people.filter((person) => person.organization === org.id);
      const children = data.subOrganizations.filter((sub) => sub.organizationId === org.id);
      return item(org.id, org.name, `세부 조직 ${children.length}개 · 인물 ${people.length}명`, { ...org, people, children }, `${org.name} ${children.map((sub) => sub.name).join(" ")}`);
    });
  }
  if (currentView === "devilFruits") {
    return data.devilFruitTypes.map((type) => {
      const fruits = data.devilFruits.filter((fruit) => fruit.type === type.id);
      return item(type.id, type.name, `열매 ${fruits.length}개`, { ...type, fruits }, `${type.name} ${fruits.map((fruit) => fruit.name).join(" ")}`);
    });
  }
  if (currentView === "groups") {
    return data.groups.map((group) => item(group.id, group.name, `멤버 ${group.memberIds.length}명`, group, `${group.name} ${group.description}`));
  }
  if (currentView === "timelines") {
    return [
      item("combined", "통합 연표", `${getCombinedTimeline().length}개 연도`, { mode: "combined" }, getCombinedTimeline().map((group) => group.year).join(" ")),
      ...data.people.map((person) => item(person.id, person.name, `연표 ${person.timeline.length}개`, person, `${person.name} ${person.aliases} ${person.timeline.map((entry) => `${timelineYear(entry)} ${timelineContent(entry)}`).join(" ")}`))
    ];
  }
  if (currentView === "quiz") return getQuizCategories();
  if (currentView === "jobs") return groupBy(data.people, "job").map((group) => groupToItem(group, "명"));
  if (currentView === "stats") return sortedStatPeople().map((person) => ({ ...personToItem(person), title: `${person.name} · ${statValueLabel(person)}` }));
  if (currentView === "bloodTypes") {
    return data.bloodTypes.map((type) => groupToItem({ id: type, name: type, people: data.people.filter((person) => person.bloodType === type) }, "명"));
  }
  if (currentView === "origins") {
    return data.originRegions.map((region) => {
      const people = data.people.filter((person) => person.originRegion === region.id);
      const countries = data.originCountries.filter((country) => country.regionId === region.id);
      return item(region.id, region.name, `국가 ${countries.length}개 · 인물 ${people.length}명`, { ...region, people, countries }, `${region.name} ${countries.map((country) => country.name).join(" ")}`);
    });
  }
  return [];
}

function renderListItem(listItem) {
  const showImage = ["people", "stats"].includes(currentView) && listItem.raw?.imageUrl;
  const image = showImage ? `<img class="item-thumb" src="${escapeAttribute(listItem.raw.imageUrl)}" alt="" loading="lazy" decoding="async" />` : "";
  return `
    <button class="item" type="button" data-id="${escapeAttribute(listItem.id)}">
      ${image}
      <span class="item-copy">
        <strong>${escapeHtml(listItem.title)}</strong>
        <span>${escapeHtml(listItem.sub)}</span>
      </span>
    </button>
  `;
}

function renderDetail(listItem) {
  emptyState.classList.toggle("hidden", Boolean(listItem));
  detail.classList.toggle("hidden", !listItem);
  if (!listItem) {
    detail.innerHTML = "";
    return;
  }

  if (currentView === "techniques") return renderTechniqueDetail(listItem.raw);
  if (currentView === "people") return renderPersonDetail(listItem.raw);
  if (currentView === "episodes") return renderEpisodeVolumeDetail(listItem.raw);
  if (currentView === "organizations") return renderOrganizationDetail(listItem.raw);
  if (currentView === "origins") return renderOriginRegionDetail(listItem.raw);
  if (currentView === "devilFruits") return renderDevilFruitTypeDetail(listItem.raw);
  if (currentView === "groups") return renderGroupDetail(listItem.raw);
  if (currentView === "timelines") return renderTimelineDetail(listItem.raw);
  if (currentView === "quiz") return renderQuizDetail(listItem.raw);

  detail.innerHTML = `
    <h3>${escapeHtml(listItem.title)}</h3>
    <div class="meta"><span class="chip">${listItem.raw.people.length}명</span></div>
    <div class="result-grid">${listItem.raw.people.map(renderPersonResult).join("") || renderEmptyResult("등록된 사람이 없습니다.")}</div>
  `;
}

function getEpisodeVolumeItems() {
  const volumes = new Map();
  data.episodes.forEach((episode) => {
    if (!volumes.has(episode.volume)) volumes.set(episode.volume, []);
    volumes.get(episode.volume).push(episode);
  });
  return Array.from(volumes.entries())
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([volume, episodes]) => {
      const sorted = episodes.sort((a, b) => Number(a.number) - Number(b.number));
      return item(
        String(volume),
        `${volume}권`,
        `${sorted.length}화`,
        { volume, episodes: sorted },
        `${volume}권 ${sorted.map((episode) => `${episode.number}화 ${episode.title}`).join(" ")}`
      );
    });
}

function renderEpisodeVolumeDetail(volumeData) {
  const selectedEpisode = activeEpisodeId
    ? volumeData.episodes.find((episode) => episode.id === activeEpisodeId)
    : volumeData.episodes[0];
  if (!activeEpisodeId && selectedEpisode) activeEpisodeId = selectedEpisode.id;

  detail.innerHTML = `
    <h3>${escapeHtml(volumeData.volume)}권</h3>
    <div class="sub-selector">
      ${volumeData.episodes.map((episode) => `
        <button class="sub-card ${selectedEpisode?.id === episode.id ? "active" : ""}" data-episode-id="${escapeAttribute(episode.id)}" type="button">
          ${episode.number}화
        </button>
      `).join("")}
    </div>
    ${selectedEpisode ? renderEpisodeDetail(selectedEpisode) : renderEmptyResult("등록된 에피소드가 없습니다.")}
  `;
  detail.querySelectorAll("[data-episode-id]").forEach((button) => {
    button.addEventListener("click", () => {
      activeEpisodeId = button.dataset.episodeId;
      render();
    });
  });
  bindEpisodeLinks();
}

function renderEpisodeDetail(episode) {
  const characters = episode.characterIds.map(findPerson).filter(Boolean);
  const techniques = episode.techniqueIds.map(findTechnique).filter(Boolean);
  return `
    <section class="nested-detail">
      <h4>${episode.number}화 · ${escapeHtml(episode.title || "제목 미등록")}</h4>
      <p class="note">${escapeHtml(episode.summary || "간략한 내용이 없습니다.")}</p>
      <div class="episode-columns">
        <section>
          <h5>등장 인물</h5>
          <div class="simple-list">${characters.map(renderPersonNameLink).join("") || renderEmptyResult("등록된 등장 인물이 없습니다.")}</div>
        </section>
        <section>
          <h5>나온 기술</h5>
          <div class="result-grid">${techniques.map(renderTechniqueResult).join("") || renderEmptyResult("등록된 기술이 없습니다.")}</div>
        </section>
      </div>
    </section>
  `;
}

function renderPersonNameLink(person) {
  return `
    <button class="name-link" type="button" data-person-link="${escapeAttribute(person.id)}">
      ${escapeHtml(person.name)}
    </button>
  `;
}

function getEpisodesForPerson(personId) {
  return data.episodes
    .filter((episode) => episode.characterIds.includes(personId))
    .sort(sortEpisodes);
}

function getEpisodesForTechnique(techniqueId) {
  return data.episodes
    .filter((episode) => episode.techniqueIds.includes(techniqueId))
    .sort(sortEpisodes);
}

function sortEpisodes(a, b) {
  return Number(a.volume) - Number(b.volume) || Number(a.number) - Number(b.number);
}

function renderTechniqueResult(technique) {
  const owner = findPerson(technique.ownerId);
  return `
    <div class="result">
      <strong>${escapeHtml(technique.name)}</strong>
      <span>${escapeHtml(owner?.name || "사용자 미등록")}</span>
    </div>
  `;
}

function renderTechniqueDetail(technique) {
  const owner = findPerson(technique.ownerId);
  const episodes = getEpisodesForTechnique(technique.id);
  detail.innerHTML = `
    <h3>${escapeHtml(technique.name)}</h3>
    <div class="meta">
      <span class="chip">사용자: ${escapeHtml(owner?.name || "미등록")}</span>
      <span class="chip">${episodes.length}개 화수</span>
    </div>
    <p class="note">${escapeHtml(technique.note || "")}</p>
    <div class="episode-chip-grid">${renderEpisodeLinks(episodes)}</div>
  `;
  bindEpisodeLinks();
}

function renderPersonDetail(person) {
  const image = person.imageUrl
    ? `<img class="portrait" src="${escapeAttribute(person.imageUrl)}" alt="${escapeAttribute(person.name)} 이미지" decoding="async" />`
    : `<div class="portrait placeholder">이미지 없음</div>`;
  const fruit = findFruit(person.devilFruitId);
  const episodes = getEpisodesForPerson(person.id);

  detail.innerHTML = `
    <div class="person-detail-head">
      ${image}
      <div>
        <h3>${escapeHtml(person.name)}</h3>
        <div class="quick-section">
          <div class="quick-section-head">
            <strong>태그</strong>
          </div>
          <div class="meta">
            ${quickChip("aliases", "별명", person.aliases || "미등록")}
            ${quickChip("organization", "조직", organizationName(person.organization))}
            ${quickChip("subOrganization", "세부 조직", subOrganizationName(person.subOrganization))}
            ${quickChip("job", "직업", person.job || "미등록")}
            ${quickChip("age", "연령", person.age ? `${person.age}세` : "미등록")}
            ${quickChip("birthday", "생일", person.birthday || "미등록")}
            ${quickChip("height", "키", currentHeight(person) ? `${currentHeight(person)}cm` : "미등록")}
            ${quickChip("bounty", "현상금", formatBounty(currentBounty(person)))}
            ${quickChip("bloodType", "혈액형", person.bloodType || "미등록")}
            ${quickChip("origin", "출신지", `${originRegionName(person.originRegion)} / ${originCountryName(person.originCountry)}`)}
            ${quickChip("devilFruitId", "악마의 열매", fruit?.name || "없음/미등록")}
            ${quickChip("haki", "무장색", person.haki?.armament ? "있음" : "없음")}
            ${quickChip("haki", "견문색", person.haki?.observation ? "있음" : "없음")}
            ${quickChip("haki", "패왕색", person.haki?.conqueror ? "있음" : "없음")}
          </div>
          <div class="quick-edit-slot" id="quickEdit-tags"></div>
        </div>
        ${renderQuickInfoBlock("likes", "좋아하는 것", person.likes || "미등록")}
        ${renderQuickInfoBlock("description", "인물 설명", person.description || person.note || "미등록")}
        ${renderWikiReferenceBlock(person)}
        ${renderHistoryBlock("키 이력", person.heightHistory, (entry) => `${entry.period || "시기 미등록"} · ${entry.cm || 0}cm`, "height")}
        ${renderHistoryBlock("현상금 이력", person.bountyHistory, (entry) => `${entry.period || "시기 미등록"} · ${formatBounty(entry.amount)}`, "bounty")}
        ${person.bodyMeasurementsEnabled ? renderHistoryBlock("B-W-H 이력", person.bodyMeasurementsHistory, (entry) => `${entry.period || "시기 미등록"} · B${entry.bust || 0} W${entry.waist || 0} H${entry.hip || 0}`) : ""}
      </div>
    </div>
    <div class="episode-chip-grid">${renderEpisodeLinks(episodes)}</div>
  `;
  bindEpisodeLinks();
  bindPersonQuickEdit(person);
}

function renderTimelineBlock(timeline) {
  return `
    <section class="timeline-block">
      <h4>연표</h4>
      <div class="timeline-list">
        ${timeline.map((entry) => `
          <div class="timeline-item">
            <strong>${escapeHtml(timelineYear(entry))}</strong>
            <div>
              <p>${escapeHtml(timelineContent(entry))}</p>
            </div>
          </div>
        `).join("") || "<p class=\"muted\">등록된 연표가 없습니다.</p>"}
      </div>
    </section>
  `;
}

function renderQuickInfoBlock(kind, title, text) {
  return `
    <div class="info-block quick-section">
      <div class="quick-section-head">
        <strong>${escapeHtml(title)}</strong>
        <button class="sub-card mini" type="button" data-quick-edit="${escapeAttribute(kind)}">수정</button>
      </div>
      <p>${escapeHtml(text)}</p>
      <div class="quick-edit-slot" id="quickEdit-${escapeAttribute(kind)}"></div>
    </div>
  `;
}

function renderWikiReferenceBlock(person) {
  if (!person.wikiUrl && !person.wikiTitle) return "";
  const fallbackUrl = person.wikiTitle ? `https://onepiece.fandom.com/wiki/${encodeURIComponent(String(person.wikiTitle).replaceAll(" ", "_"))}` : "";
  const href = person.wikiUrl || fallbackUrl;
  const label = person.wikiReferenceOnly ? "위키 참고" : "위키";
  const note = person.wikiReferenceOnly ? (person.wikiReferenceNote || "참고 페이지") : (person.wikiTitle || href);
  return `
    <div class="info-block wiki-reference">
      <strong>${escapeHtml(label)}</strong>
      <p><a class="wiki-reference-link" href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${escapeHtml(person.wikiTitle || href)}</a></p>
      ${person.wikiReferenceOnly ? `<p class="muted">${escapeHtml(note)}</p>` : ""}
    </div>
  `;
}

function quickChip(kind, label, value) {
  return `
    <button class="chip quick-chip" type="button" data-quick-edit="${escapeAttribute(kind)}">
      ${escapeHtml(label)}: ${escapeHtml(value)}
    </button>
  `;
}

function renderHistoryBlock(title, entries = [], formatter, quickKind = "") {
  return `
    <div class="info-block quick-section">
      <div class="quick-section-head">
        <strong>${escapeHtml(title)}</strong>
        ${quickKind ? `<button class="sub-card mini" type="button" data-quick-edit="${escapeAttribute(quickKind)}">수정</button>` : ""}
      </div>
      ${(entries || []).map((entry) => `<p>${escapeHtml(formatter(entry))}</p>`).join("") || "<p>미등록</p>"}
      ${quickKind ? `<div class="quick-edit-slot" id="quickEdit-${escapeAttribute(quickKind)}"></div>` : ""}
    </div>
  `;
}

function bindPersonQuickEdit(person) {
  detail.querySelectorAll("[data-quick-edit]").forEach((button) => {
    button.addEventListener("click", () => openPersonQuickEdit(person, button.dataset.quickEdit));
  });
}

function openPersonQuickEdit(person, kind) {
  detail.querySelectorAll(".quick-edit-slot").forEach((slot) => {
    if (slot.id !== `quickEdit-${kind}`) slot.innerHTML = "";
  });
  const slot = detail.querySelector(`#quickEdit-${kind}`) || detail.querySelector("#quickEdit-tags");
  if (!slot) return;
  slot.innerHTML = renderPersonQuickEditForm(person, kind);
  const form = slot.querySelector("form");
  if (!form) return;
  slot.querySelectorAll("[data-add-history-row]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.addHistoryRow;
      form.querySelector(`[data-history-rows="${type}"]`).insertAdjacentHTML("beforeend", renderMetricRow({}, type));
    });
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    savePersonQuickEdit(person, kind, form);
  });
  form.querySelector("[data-cancel-quick-edit]")?.addEventListener("click", () => {
    slot.innerHTML = "";
  });
}

function renderPersonQuickEditForm(person, kind) {
  if (kind === "aliases") {
    return `
      <form class="quick-edit-form">
        ${field("aliases", "별명", person.aliases || "")}
        ${quickEditActions()}
      </form>
    `;
  }
  if (kind === "job") {
    return `
      <form class="quick-edit-form">
        ${field("job", "직업", person.job || "")}
        ${quickEditActions()}
      </form>
    `;
  }
  if (kind === "age") {
    return `
      <form class="quick-edit-form">
        ${field("age", "연령", person.age || "", "number")}
        ${quickEditActions()}
      </form>
    `;
  }
  if (kind === "birthday") {
    return `
      <form class="quick-edit-form">
        ${birthdayField(person.birthday)}
        ${quickEditActions()}
      </form>
    `;
  }
  if (kind === "organization") {
    return `
      <form class="quick-edit-form">
        <label>조직<select name="organization">${organizationOptions(person.organization)}</select></label>
        ${quickEditActions()}
      </form>
    `;
  }
  if (kind === "subOrganization") {
    return `
      <form class="quick-edit-form">
        <label>세부 조직<select name="subOrganization">${subOrganizationOptions(person.subOrganization)}</select></label>
        ${quickEditActions()}
      </form>
    `;
  }
  if (kind === "bloodType") {
    return `
      <form class="quick-edit-form">
        <label>혈액형<select name="bloodType">${data.bloodTypes.map((type) => option(type, type, person.bloodType)).join("")}</select></label>
        ${quickEditActions()}
      </form>
    `;
  }
  if (kind === "origin") {
    return `
      <form class="quick-edit-form">
        <label>출신 바다/지역<select name="originRegion">${originRegionOptions(person.originRegion)}</select></label>
        <label>출신 국가<select name="originCountry">${originCountryOptions(person.originCountry)}</select></label>
        ${quickEditActions()}
      </form>
    `;
  }
  if (kind === "devilFruitId") {
    return `
      <form class="quick-edit-form">
        <label>악마의 열매<select name="devilFruitId"><option value="">없음/미등록</option>${data.devilFruits.map((fruit) => option(fruit.id, fruit.name, person.devilFruitId)).join("")}</select></label>
        ${quickEditActions()}
      </form>
    `;
  }
  if (kind === "haki") {
    return `
      <form class="quick-edit-form">
        <fieldset class="check-list compact">
          <legend>패기</legend>
          <label><input type="checkbox" name="hakiArmament" ${person.haki?.armament ? "checked" : ""} /> 무장색</label>
          <label><input type="checkbox" name="hakiObservation" ${person.haki?.observation ? "checked" : ""} /> 견문색</label>
          <label><input type="checkbox" name="hakiConqueror" ${person.haki?.conqueror ? "checked" : ""} /> 패왕색</label>
        </fieldset>
        ${quickEditActions()}
      </form>
    `;
  }
  if (kind === "tags") {
    return `
      <form class="quick-edit-form">
        ${field("aliases", "별명", person.aliases || "")}
        ${field("job", "직업", person.job || "")}
        ${field("age", "연령", person.age || "", "number")}
        ${birthdayField(person.birthday)}
        <label>조직<select name="organization">${organizationOptions(person.organization)}</select></label>
        <label>세부 조직<select name="subOrganization">${subOrganizationOptions(person.subOrganization)}</select></label>
        <label>혈액형<select name="bloodType">${data.bloodTypes.map((type) => option(type, type, person.bloodType)).join("")}</select></label>
        <label>출신 바다/지역<select name="originRegion">${originRegionOptions(person.originRegion)}</select></label>
        <label>출신 국가<select name="originCountry">${originCountryOptions(person.originCountry)}</select></label>
        <label>악마의 열매<select name="devilFruitId"><option value="">없음/미등록</option>${data.devilFruits.map((fruit) => option(fruit.id, fruit.name, person.devilFruitId)).join("")}</select></label>
        <fieldset class="check-list compact">
          <legend>패기</legend>
          <label><input type="checkbox" name="hakiArmament" ${person.haki?.armament ? "checked" : ""} /> 무장색</label>
          <label><input type="checkbox" name="hakiObservation" ${person.haki?.observation ? "checked" : ""} /> 견문색</label>
          <label><input type="checkbox" name="hakiConqueror" ${person.haki?.conqueror ? "checked" : ""} /> 패왕색</label>
        </fieldset>
        ${quickEditActions()}
      </form>
    `;
  }
  if (kind === "likes") {
    return `
      <form class="quick-edit-form">
        <label>좋아하는 것<textarea name="likes" rows="3">${escapeHtml(person.likes || "")}</textarea></label>
        ${quickEditActions()}
      </form>
    `;
  }
  if (kind === "description") {
    return `
      <form class="quick-edit-form">
        <label>인물 설명<textarea name="description" rows="5">${escapeHtml(person.description || "")}</textarea></label>
        ${quickEditActions()}
      </form>
    `;
  }
  if (kind === "height" || kind === "bounty") {
    const rows = kind === "height" ? person.heightHistory : person.bountyHistory;
    const label = kind === "height" ? "키 이력" : "현상금 이력";
    return `
      <form class="quick-edit-form">
        <fieldset class="timeline-editor">
          <legend>${label}</legend>
          <div data-history-rows="${kind}">${renderMetricRows(rows, kind)}</div>
          <button class="sub-card" type="button" data-add-history-row="${kind}">줄 추가</button>
        </fieldset>
        ${quickEditActions()}
      </form>
    `;
  }
  return "";
}

function quickEditActions() {
  return `
    <div class="form-actions">
      <button class="primary" type="submit">저장</button>
      <button class="sub-card" type="button" data-cancel-quick-edit>취소</button>
    </div>
  `;
}

function savePersonQuickEdit(person, kind, form) {
  if (kind === "aliases") person.aliases = value(form, "aliases");
  if (kind === "job") person.job = value(form, "job");
  if (kind === "age") person.age = Number(value(form, "age") || 0);
  if (kind === "birthday") person.birthday = readBirthday(form);
  if (kind === "organization") person.organization = value(form, "organization");
  if (kind === "subOrganization") person.subOrganization = value(form, "subOrganization");
  if (kind === "bloodType") person.bloodType = value(form, "bloodType");
  if (kind === "origin") {
    person.originRegion = value(form, "originRegion");
    person.originCountry = value(form, "originCountry");
    person.origin = `${originRegionName(person.originRegion)} / ${originCountryName(person.originCountry)}`;
  }
  if (kind === "devilFruitId") person.devilFruitId = value(form, "devilFruitId");
  if (kind === "haki") {
    person.haki = {
      armament: form.elements.hakiArmament.checked,
      observation: form.elements.hakiObservation.checked,
      conqueror: form.elements.hakiConqueror.checked
    };
  }
  if (kind === "tags") {
    Object.assign(person, {
      aliases: value(form, "aliases"),
      job: value(form, "job"),
      age: Number(value(form, "age") || 0),
      birthday: readBirthday(form),
      organization: value(form, "organization"),
      subOrganization: value(form, "subOrganization"),
      bloodType: value(form, "bloodType"),
      originRegion: value(form, "originRegion"),
      originCountry: value(form, "originCountry"),
      origin: `${originRegionName(value(form, "originRegion"))} / ${originCountryName(value(form, "originCountry"))}`,
      devilFruitId: value(form, "devilFruitId"),
      haki: {
        armament: form.elements.hakiArmament.checked,
        observation: form.elements.hakiObservation.checked,
        conqueror: form.elements.hakiConqueror.checked
      }
    });
  }
  if (kind === "likes") person.likes = value(form, "likes");
  if (kind === "description") person.description = value(form, "description");
  if (kind === "height") {
    person.heightHistory = readMetricRows(form, "height");
    person.heightCm = currentHeight(person);
  }
  if (kind === "bounty") {
    person.bountyHistory = readMetricRows(form, "bounty");
    person.bounty = currentBounty(person);
  }
  saveData();
  activeId = person.id;
  render();
}

function renderTimelineDetail(person) {
  if (person.mode === "combined") return renderCombinedTimelineDetail();
  detail.innerHTML = `
    <h3>${escapeHtml(person.name)} 연표</h3>
    <p class="note">수정 탭의 인물 수정에서 년도와 내용을 추가할 수 있습니다.</p>
    ${renderTimelineBlock(person.timeline)}
  `;
}

function renderCombinedTimelineDetail() {
  const groups = getCombinedTimeline();
  detail.innerHTML = `
    <h3>통합 연표</h3>
    <p class="note">같은 연도에 있는 사건을 한곳에 묶어서 보여줍니다.</p>
    <div class="timeline-list">
      ${groups.map((group) => `
        <div class="timeline-item">
          <strong>${escapeHtml(group.year)}</strong>
          <div>
            ${group.events.map((event) => `<p><b>${escapeHtml(event.personName)}</b> ${escapeHtml(event.content)}</p>`).join("")}
          </div>
        </div>
      `).join("") || "<p class=\"muted\">등록된 연표가 없습니다.</p>"}
    </div>
  `;
}

function renderOrganizationDetail(org) {
  const selectedSub = activeSubOrgId ? findSubOrganization(activeSubOrgId) : null;
  const subOrgs = data.subOrganizations.filter((sub) => sub.organizationId === org.id);
  const people = data.people.filter((person) => person.organization === org.id && (!selectedSub || person.subOrganization === selectedSub.id));

  detail.innerHTML = `
    <h3>${escapeHtml(org.name)}</h3>
    <div class="meta"><span class="chip">세부 조직 ${subOrgs.length}개</span><span class="chip">인물 ${people.length}명</span></div>
    <div class="sub-selector">
      <button class="sub-card ${!selectedSub ? "active" : ""}" data-sub-org-id="" type="button">전체</button>
      ${subOrgs.map((sub) => `<button class="sub-card ${selectedSub?.id === sub.id ? "active" : ""}" data-sub-org-id="${escapeAttribute(sub.id)}" type="button">${escapeHtml(sub.name)}</button>`).join("")}
    </div>
    ${selectedSub ? `<p class="note">${escapeHtml(selectedSub.description || "")}</p>` : ""}
    <div class="result-grid">${people.map(renderPersonResult).join("") || renderEmptyResult("등록된 사람이 없습니다.")}</div>
  `;
  detail.querySelectorAll("[data-sub-org-id]").forEach((button) => {
    button.addEventListener("click", () => {
      activeSubOrgId = button.dataset.subOrgId;
      render();
    });
  });
}

function renderOriginRegionDetail(region) {
  const selectedCountry = activeSubOrgId ? findOriginCountry(activeSubOrgId) : null;
  const countries = data.originCountries.filter((country) => country.regionId === region.id);
  const people = data.people.filter((person) => person.originRegion === region.id && (!selectedCountry || person.originCountry === selectedCountry.id));

  detail.innerHTML = `
    <h3>${escapeHtml(region.name)}</h3>
    <div class="meta"><span class="chip">국가 ${countries.length}개</span><span class="chip">인물 ${people.length}명</span></div>
    <div class="sub-selector">
      <button class="sub-card ${!selectedCountry ? "active" : ""}" data-origin-country-id="" type="button">전체</button>
      ${countries.map((country) => `<button class="sub-card ${selectedCountry?.id === country.id ? "active" : ""}" data-origin-country-id="${escapeAttribute(country.id)}" type="button">${escapeHtml(country.name)}</button>`).join("")}
    </div>
    <div class="result-grid">${people.map(renderPersonResult).join("") || renderEmptyResult("등록된 사람이 없습니다.")}</div>
  `;
  detail.querySelectorAll("[data-origin-country-id]").forEach((button) => {
    button.addEventListener("click", () => {
      activeSubOrgId = button.dataset.originCountryId;
      render();
    });
  });
}

function renderDevilFruitTypeDetail(type) {
  const selectedFruit = activeFruitId ? findFruit(activeFruitId) : type.fruits[0];
  if (!activeFruitId && selectedFruit) activeFruitId = selectedFruit.id;

  detail.innerHTML = `
    <h3>${escapeHtml(type.name)}</h3>
    <div class="meta"><span class="chip">열매 ${type.fruits.length}개</span></div>
    <div class="sub-selector">
      ${type.fruits.map((fruit) => `<button class="sub-card ${activeFruitId === fruit.id ? "active" : ""}" data-fruit-id="${escapeAttribute(fruit.id)}" type="button">${escapeHtml(fruit.name)}</button>`).join("") || "<span class=\"muted\">등록된 열매가 없습니다.</span>"}
    </div>
    ${selectedFruit ? renderFruitDetail(selectedFruit) : ""}
  `;
  detail.querySelectorAll("[data-fruit-id]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFruitId = button.dataset.fruitId;
      render();
    });
  });
}

function renderFruitDetail(fruit) {
  const currentUser = findPerson(fruit.currentUserId);
  const previousUsers = fruit.previousUserIds.map(findPerson).filter(Boolean);
  return `
    <section class="nested-detail">
      <h4>${escapeHtml(fruit.name)}</h4>
      <div class="meta">
        <span class="chip">각성: ${fruit.awakened ? "각성" : "미각성/미등록"}</span>
        ${fruit.type === "zoan" ? `<span class="chip">동물계 구분: ${escapeHtml(zoanSubtypeName(fruit.zoanSubtype))}</span>` : ""}
        ${fruit.type === "zoan" && fruit.model ? `<span class="chip">모델: ${escapeHtml(fruit.model)}</span>` : ""}
      </div>
      <p class="note">${escapeHtml(fruit.description || "")}</p>
      <div class="result-grid">
        ${currentUser ? `<div class="result"><strong>현재 능력자</strong>${renderPersonResult(currentUser)}</div>` : renderEmptyResult("현재 능력자가 미등록입니다.")}
        <div class="result"><strong>선대 능력자</strong>${previousUsers.map(renderPersonResult).join("") || "<span>등록된 선대 능력자가 없습니다.</span>"}</div>
      </div>
    </section>
  `;
}

function renderGroupDetail(group) {
  const members = group.memberIds.map(findPerson).filter(Boolean);
  detail.innerHTML = `
    <h3>${escapeHtml(group.name)}</h3>
    <p class="note">${escapeHtml(group.description || "")}</p>
    <div class="meta"><span class="chip">멤버 ${members.length}명</span></div>
    <div class="result-grid">${members.map(renderPersonResult).join("") || renderEmptyResult("선택된 멤버가 없습니다.")}</div>
  `;
}

function renderQuizDetail(category) {
  const cards = buildQuizCards(category.id);
  if (!cards.length) {
    detail.innerHTML = `
      <h3>${escapeHtml(category.name)} 카드 퀴즈</h3>
      ${renderQuizCategoryPicker(category.id)}
      ${renderEmptyResult("이 카테고리로 만들 수 있는 카드가 없습니다.")}
    `;
    bindQuizCategoryPicker();
    return;
  }
  if (!quizSession || quizSession.category !== category.id) {
    startQuizSession(category.id, cards, "all", cards.length);
  }
  const card = quizSession.index < quizSession.cards.length ? quizSession.cards[quizSession.index] : null;
  const isDone = !card;
  const limitValue = Math.min(10, cards.length);
  const progress = quizSession.cards.length ? `${Math.min(quizSession.index + 1, quizSession.cards.length)} / ${quizSession.cards.length}` : "0 / 0";
  const remainingCount = Math.max(quizSession.cards.length - quizSession.index - (quizSession.answered ? 1 : 0), 0);
  const showStudyBack = quizMode === "study" && quizStudyFlipped;
  const feedback = quizSession.answered && card ? `
    <div class="quiz-feedback ${quizSession.lastCorrect ? "correct" : "wrong"}">
      <strong>${quizSession.lastCorrect ? "정답" : "오답"}</strong>
      <span>내 답: ${escapeHtml(quizSession.lastAnswer || "미입력")}</span>
      <span>정답: ${escapeHtml(card.back)}</span>
    </div>
  ` : "";
  detail.innerHTML = `
    <h3>${escapeHtml(category.name)} 카드 퀴즈</h3>
    <div class="quiz-panel">
      <div class="quiz-topbar">
        ${renderQuizCategoryPicker(category.id)}
        <div class="quiz-mode-controls">
          <button class="range ${quizMode === "test" ? "active" : ""}" data-quiz-mode="test" type="button">문제 풀이</button>
          <button class="range ${quizMode === "study" ? "active" : ""}" data-quiz-mode="study" type="button">학습</button>
        </div>
      </div>
      ${isDone ? `
        <div class="quiz-complete">
          <strong>${quizMode === "study" ? "학습 완료" : "풀이 완료"}</strong>
          <span>${quizMode === "study" ? `${quizSession.cards.length}장을 모두 확인했습니다.` : `정답 ${quizSession.correct}개 · 오답 ${quizSession.wrong}개`}</span>
        </div>
        ` : `
        <div class="quiz-card ${showStudyBack ? "flipped" : ""}" id="quizCard">
          ${!showStudyBack && card.imageUrl ? `<img class="quiz-face" src="${escapeAttribute(card.imageUrl)}" alt="" loading="lazy" decoding="async" />` : ""}
          <strong>${escapeHtml(showStudyBack ? card.back : card.front)}</strong>
        </div>
        ${quizMode === "test" ? `
          <form class="quiz-answer" id="quizAnswerForm">
            <label>답 입력<input id="quizAnswerInput" name="quizAnswer" autocomplete="off" value="${escapeAttribute(quizAnswerDraft)}" ${quizSession.answered ? "disabled" : ""} /></label>
            <div class="form-actions">
              <button class="primary" type="submit" ${quizSession.answered ? "disabled" : ""}>채점</button>
              <button class="sub-card" id="markCorrectButton" type="button" ${quizSession.answered ? "disabled" : ""}>정답으로 기록</button>
              <button class="sub-card" id="markWrongButton" type="button" ${quizSession.answered ? "disabled" : ""}>오답으로 기록</button>
              <button class="sub-card" id="nextQuizButton" type="button">${quizSession.index >= quizSession.cards.length - 1 ? "결과 보기" : "다음 문제"}</button>
            </div>
          </form>
          ${feedback}
        ` : `
          <div class="form-actions quiz-study-actions">
            <button class="quiz-nav-button" id="prevQuizButton" type="button" ${quizSession.index <= 0 ? "disabled" : ""} title="이전 카드">
              <span aria-hidden="true">◀</span>
              <b>이전 카드</b>
            </button>
            <button class="quiz-nav-button primary" id="flipStudyQuizButton" type="button" title="${showStudyBack ? "문제 보기" : "정답 보기"}">
              <span aria-hidden="true">●</span>
              <b>${showStudyBack ? "문제 보기" : "정답 보기"}</b>
            </button>
            <button class="quiz-nav-button" id="nextQuizButton" type="button" title="${quizSession.index >= quizSession.cards.length - 1 ? "완료하기" : "다음 카드"}">
              <span aria-hidden="true">▶</span>
              <b>${quizSession.index >= quizSession.cards.length - 1 ? "완료" : "다음 카드"}</b>
            </button>
          </div>
        `}
      `}
      <div class="quiz-score">
        <span>진행 ${progress}</span>
        ${quizMode === "test" ? `<span>정답 ${quizSession.correct}</span><span>오답 ${quizSession.wrong}</span>` : `<span>학습 카드 ${quizSession.cards.length}장</span>`}
        <span>남은 문제 ${remainingCount}</span>
      </div>
      <div class="quiz-setup">
        <button class="sub-card" id="allQuizButton" type="button">전체 풀기</button>
        <label>랜덤 문제 수<input id="quizLimitInput" type="number" min="1" max="${cards.length}" value="${limitValue}" /></label>
        <button class="sub-card" id="randomQuizButton" type="button">랜덤 풀기</button>
      </div>
    </div>
  `;
  bindQuizCategoryPicker();
  document.querySelectorAll("[data-quiz-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      quizMode = button.dataset.quizMode;
      quizStudyFlipped = false;
      quizAnswerDraft = "";
      render();
    });
  });
  document.querySelector("#allQuizButton").addEventListener("click", () => {
    startQuizSession(category.id, cards, "all", cards.length);
    render();
  });
  document.querySelector("#randomQuizButton").addEventListener("click", () => {
    const limit = Number(document.querySelector("#quizLimitInput").value || limitValue);
    startQuizSession(category.id, cards, "random", limit);
    render();
  });
  const answerForm = document.querySelector("#quizAnswerForm");
  if (answerForm) {
    answerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      checkQuizAnswer();
    });
    document.querySelector("#quizAnswerInput").addEventListener("input", (event) => {
      quizAnswerDraft = event.target.value;
    });
    document.querySelector("#markCorrectButton").addEventListener("click", () => markQuizAnswer(true));
    document.querySelector("#markWrongButton").addEventListener("click", () => markQuizAnswer(false));
  }
  document.querySelector("#flipStudyQuizButton")?.addEventListener("click", () => {
    quizStudyFlipped = !quizStudyFlipped;
    render();
  });
  document.querySelector("#prevQuizButton")?.addEventListener("click", previousQuizCard);
  document.querySelector("#nextQuizButton")?.addEventListener("click", nextQuizCard);
}

function renderQuizCategoryPicker(selectedId) {
  ensureQuizCards();
  return `
    <label class="quiz-category-select">
      <span>퀴즈 카테고리</span>
      <select id="quizCategorySelect">
        ${quizCategoryMeta.map((category) => option(category.id, `${category.title} · ${buildQuizCards(category.id).length}장`, selectedId)).join("")}
      </select>
    </label>
  `;
}

function bindQuizCategoryPicker() {
  const select = detail.querySelector("#quizCategorySelect");
  if (!select) return;
  select.addEventListener("change", () => {
    activeId = select.value;
    quizSession = null;
    quizAnswerDraft = "";
    quizStudyFlipped = false;
    render();
  });
}

function renderEditor() {
  if (editorMode === "people") renderPeopleEditor();
  if (editorMode === "episodes") renderEpisodeEditor();
  if (editorMode === "techniques") renderTechniqueEditor();
  if (editorMode === "fruits") renderFruitEditor();
  if (editorMode === "organizations") renderOrganizationEditor();
  if (editorMode === "origins") renderOriginEditor();
  if (editorMode === "groups") renderGroupEditor();
  if (editorMode === "data") renderDataManager();
}

function renderEpisodeEditor() {
  editorBody.innerHTML = editorShell(
    "newEpisodeButton",
    "새 에피소드 추가",
    data.episodes
      .slice()
      .sort((a, b) => Number(a.volume) - Number(b.volume) || Number(a.number) - Number(b.number))
      .map((episode) => pickButton("episode", episode.id, `${episode.volume}권 ${episode.number}화`, episode.title || "제목 미등록"))
      .join(""),
    "episodeFormWrap"
  );
  document.querySelector("#newEpisodeButton").addEventListener("click", () => renderEpisodeForm());
  editorBody.querySelectorAll("[data-episode-id]").forEach((button) => {
    button.addEventListener("click", () => renderEpisodeForm(findEpisode(button.dataset.episodeId)));
  });
  renderEpisodeForm(data.episodes[0]);
}

function renderEpisodeForm(episode = null) {
  const isNew = !episode;
  const target = document.querySelector("#episodeFormWrap");
  const draft = episode || { id: makeId("episode"), volume: 1, number: 1, title: "", summary: "", characterIds: [], techniqueIds: [] };
  target.innerHTML = `
    <form id="episodeForm">
      ${formHead(isNew ? "새 에피소드 추가" : "에피소드 수정", "deleteEpisodeButton", isNew)}
      ${field("id", "고유 ID", draft.id)}
      ${field("volume", "권", draft.volume, "number")}
      ${field("number", "화", draft.number, "number")}
      ${field("title", "화 제목", draft.title)}
      <label>간략한 내용<textarea name="summary" rows="4">${escapeHtml(draft.summary || "")}</textarea></label>
      ${searchablePersonPicker(draft.characterIds || [])}
      ${checkboxListForItems("techniqueIds", "나온 기술", data.techniques, draft.techniqueIds || [])}
      <div class="form-actions"><button class="primary" type="submit">저장</button></div>
    </form>
  `;
  const form = document.querySelector("#episodeForm");
  bindEpisodeCharacterPicker(form, draft.characterIds || []);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    upsert(data.episodes, draft.id, {
      id: value(form, "id") || makeId("episode"),
      volume: Number(value(form, "volume") || 1),
      number: Number(value(form, "number") || 1),
      title: value(form, "title"),
      summary: value(form, "summary"),
      characterIds: checkedValues(form, "characterIds"),
      techniqueIds: checkedValues(form, "techniqueIds")
    });
    saveData();
    renderEpisodeEditor();
  });
  document.querySelector("#deleteEpisodeButton")?.addEventListener("click", () => {
    data.episodes = data.episodes.filter((item) => item.id !== draft.id);
    saveData();
    renderEpisodeEditor();
  });
}

function renderPeopleEditor() {
  const people = sortedPeople(personSortMode).filter((person) => {
    const query = personEditorQuery.trim().toLowerCase();
    if (!query) return true;
    return personToItem(person).searchText.includes(query);
  });
  editorBody.innerHTML = editorShell(
    "newPersonButton",
    "새 인물 추가",
    `
      <div class="edit-tools">
        <label>검색<input id="personEditorSearchInput" type="search" value="${escapeAttribute(personEditorQuery)}" placeholder="이름, 조직, 직업 검색" /></label>
        <label>정렬<select id="personEditorSortSelect">
          <option value="appearance" ${personSortMode === "appearance" ? "selected" : ""}>등장순</option>
          <option value="id" ${personSortMode === "id" ? "selected" : ""}>고유 ID 순</option>
          <option value="name" ${personSortMode === "name" ? "selected" : ""}>이름순</option>
          <option value="heightAsc" ${personSortMode === "heightAsc" ? "selected" : ""}>키 낮은 순</option>
          <option value="heightDesc" ${personSortMode === "heightDesc" ? "selected" : ""}>키 높은 순</option>
          <option value="ageAsc" ${personSortMode === "ageAsc" ? "selected" : ""}>나이 낮은 순</option>
          <option value="ageDesc" ${personSortMode === "ageDesc" ? "selected" : ""}>나이 높은 순</option>
          <option value="bountyAsc" ${personSortMode === "bountyAsc" ? "selected" : ""}>현상금 낮은 순</option>
          <option value="bountyDesc" ${personSortMode === "bountyDesc" ? "selected" : ""}>현상금 높은 순</option>
          <option value="birthday" ${personSortMode === "birthday" ? "selected" : ""}>생일순</option>
        </select></label>
      </div>
      ${people.map((person) => pickButton("person", person.id, person.name, `${organizationName(person.organization)} · ${subOrganizationName(person.subOrganization)}`, person.imageUrl)).join("")}
    `,
    "personFormWrap"
  );
  document.querySelector("#newPersonButton").addEventListener("click", () => renderPersonForm());
  document.querySelector("#personEditorSearchInput").addEventListener("input", (event) => {
    personEditorQuery = event.target.value;
    const cursor = event.target.selectionStart || personEditorQuery.length;
    renderPeopleEditor();
    const input = document.querySelector("#personEditorSearchInput");
    input.focus();
    input.setSelectionRange(cursor, cursor);
  });
  document.querySelector("#personEditorSortSelect").addEventListener("change", (event) => {
    personSortMode = event.target.value;
    renderPeopleEditor();
  });
  editorBody.querySelectorAll("[data-person-id]").forEach((button) => button.addEventListener("click", () => renderPersonForm(findPerson(button.dataset.personId))));
  renderPersonForm(people[0] || data.people[0]);
}

function renderPersonForm(person = null) {
  const isNew = !person;
  const target = document.querySelector("#personFormWrap");
  const draft = person || blankPerson();
  target.innerHTML = `
    <form id="personForm">
      ${formHead(isNew ? "새 인물 추가" : "인물 수정", "deletePersonButton", isNew)}
      ${field("id", "고유 ID", draft.id)}
      ${field("name", "이름", draft.name)}
      ${field("aliases", "별명", draft.aliases)}
      ${field("job", "직업", draft.job)}
      <label>조직<select name="organization">${organizationOptions(draft.organization)}</select></label>
      <label>세부 조직<select name="subOrganization">${subOrganizationOptions(draft.subOrganization)}</select></label>
      ${field("age", "연령", draft.age, "number")}
      ${birthdayField(draft.birthday)}
      <fieldset class="timeline-editor">
        <legend>키 이력</legend>
        <div id="heightRows">${renderMetricRows(draft.heightHistory, "height")}</div>
        <button class="sub-card" id="addHeightRowButton" type="button">키 줄 추가</button>
      </fieldset>
      <fieldset class="timeline-editor">
        <legend>현상금 이력</legend>
        <div id="bountyRows">${renderMetricRows(draft.bountyHistory, "bounty")}</div>
        <button class="sub-card" id="addBountyRowButton" type="button">현상금 줄 추가</button>
      </fieldset>
      <label>혈액형<select name="bloodType">${data.bloodTypes.map((type) => option(type, type, draft.bloodType)).join("")}</select></label>
      <label>출신 바다/지역<select name="originRegion">${originRegionOptions(draft.originRegion)}</select></label>
      <label>출신 국가<select name="originCountry">${originCountryOptions(draft.originCountry)}</select></label>
      ${field("likes", "좋아하는 것", draft.likes)}
      ${renderPersonFormImage(draft)}
      ${field("imageUrl", "이미지 주소", draft.imageUrl)}
      <label>이미지 파일<input name="imageFile" type="file" accept="image/*" /></label>
      <label>악마의 열매<select name="devilFruitId"><option value="">없음/미등록</option>${data.devilFruits.map((fruit) => option(fruit.id, fruit.name, draft.devilFruitId)).join("")}</select></label>
      <fieldset class="check-list">
        <legend>패기</legend>
        <label><input type="checkbox" name="hakiArmament" ${draft.haki?.armament ? "checked" : ""} /> 무장색</label>
        <label><input type="checkbox" name="hakiObservation" ${draft.haki?.observation ? "checked" : ""} /> 견문색</label>
        <label><input type="checkbox" name="hakiConqueror" ${draft.haki?.conqueror ? "checked" : ""} /> 패왕색</label>
      </fieldset>
      <fieldset class="timeline-editor">
        <legend>B-W-H</legend>
        <label class="inline-check"><input name="bodyMeasurementsEnabled" type="checkbox" ${draft.bodyMeasurementsEnabled ? "checked" : ""} /> B-W-H 사용</label>
        <div id="bodyRows">${renderMetricRows(draft.bodyMeasurementsHistory, "body")}</div>
        <button class="sub-card" id="addBodyRowButton" type="button">B-W-H 줄 추가</button>
      </fieldset>
      <fieldset class="timeline-editor">
        <legend>연표</legend>
        <div id="timelineRows">${renderTimelineRows(draft.timeline)}</div>
        <button class="sub-card" id="addTimelineRowButton" type="button">연표 줄 추가</button>
      </fieldset>
      <label>인물 설명<textarea name="description" rows="4">${escapeHtml(draft.description || "")}</textarea></label>
      <label>메모<textarea name="note" rows="3">${escapeHtml(draft.note || "")}</textarea></label>
      <div class="form-actions"><button class="primary" type="submit">저장</button></div>
    </form>
  `;
  const form = document.querySelector("#personForm");
  document.querySelector("#addHeightRowButton").addEventListener("click", () => {
    document.querySelector("#heightRows").insertAdjacentHTML("beforeend", renderMetricRow({}, "height"));
  });
  document.querySelector("#addBountyRowButton").addEventListener("click", () => {
    document.querySelector("#bountyRows").insertAdjacentHTML("beforeend", renderMetricRow({}, "bounty"));
  });
  document.querySelector("#addBodyRowButton").addEventListener("click", () => {
    document.querySelector("#bodyRows").insertAdjacentHTML("beforeend", renderMetricRow({}, "body"));
  });
  document.querySelector("#addTimelineRowButton").addEventListener("click", () => {
    document.querySelector("#timelineRows").insertAdjacentHTML("beforeend", renderTimelineRow({ year: "", content: "" }));
  });
  form.elements.imageUrl.addEventListener("input", () => {
    updatePersonImagePreview(form.elements.imageUrl.value, value(form, "name"));
  });
  form.elements.imageFile.addEventListener("change", async () => {
    const file = form.elements.imageFile.files[0];
    if (file) {
      form.elements.imageUrl.value = await fileToDataUrl(file);
      updatePersonImagePreview(form.elements.imageUrl.value, value(form, "name"));
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const next = formToPerson(form, draft);
    upsert(data.people, draft.id, next);
    saveData();
    renderPeopleEditor();
  });
  document.querySelector("#deletePersonButton")?.addEventListener("click", () => {
    data.people = data.people.filter((item) => item.id !== draft.id);
    data.techniques.forEach((technique) => { if (technique.ownerId === draft.id) technique.ownerId = ""; });
    data.devilFruits.forEach((fruit) => {
      if (fruit.currentUserId === draft.id) fruit.currentUserId = "";
      fruit.previousUserIds = fruit.previousUserIds.filter((id) => id !== draft.id);
    });
    data.groups.forEach((group) => { group.memberIds = group.memberIds.filter((id) => id !== draft.id); });
    saveData();
    renderPeopleEditor();
  });
}

function renderTechniqueEditor() {
  editorBody.innerHTML = editorShell(
    "newTechniqueButton",
    "새 기술 추가",
    data.techniques.map((technique) => pickButton("technique", technique.id, technique.name, findPerson(technique.ownerId)?.name || "사용자 미등록")).join(""),
    "techniqueFormWrap"
  );
  document.querySelector("#newTechniqueButton").addEventListener("click", () => renderTechniqueForm());
  editorBody.querySelectorAll("[data-technique-id]").forEach((button) => button.addEventListener("click", () => renderTechniqueForm(findTechnique(button.dataset.techniqueId))));
  renderTechniqueForm(data.techniques[0]);
}

function renderTechniqueForm(technique = null) {
  const isNew = !technique;
  const target = document.querySelector("#techniqueFormWrap");
  const draft = technique || { id: makeId("technique"), name: "", ownerId: "", note: "" };
  target.innerHTML = `
    <form id="techniqueForm">
      ${formHead(isNew ? "새 기술 추가" : "기술 수정", "deleteTechniqueButton", isNew)}
      ${field("id", "고유 ID", draft.id)}
      ${field("name", "기술명", draft.name)}
      <label>사용자<select name="ownerId"><option value="">미등록</option>${data.people.map((person) => option(person.id, person.name, draft.ownerId)).join("")}</select></label>
      <label>메모<textarea name="note" rows="4">${escapeHtml(draft.note || "")}</textarea></label>
      <div class="form-actions"><button class="primary" type="submit">저장</button></div>
    </form>
  `;
  const form = document.querySelector("#techniqueForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    upsert(data.techniques, draft.id, {
      id: value(form, "id") || makeId("technique"),
      name: value(form, "name"),
      ownerId: value(form, "ownerId"),
      note: value(form, "note")
    });
    saveData();
    renderTechniqueEditor();
  });
  document.querySelector("#deleteTechniqueButton")?.addEventListener("click", () => {
    data.techniques = data.techniques.filter((item) => item.id !== draft.id);
    saveData();
    renderTechniqueEditor();
  });
}

function renderFruitEditor() {
  editorBody.innerHTML = editorShell(
    "newFruitButton",
    "새 열매 추가",
    data.devilFruits.map((fruit) => pickButton("fruit", fruit.id, fruit.name, devilFruitTypeName(fruit.type))).join(""),
    "fruitFormWrap"
  );
  document.querySelector("#newFruitButton").addEventListener("click", () => renderFruitForm());
  editorBody.querySelectorAll("[data-fruit-id]").forEach((button) => button.addEventListener("click", () => renderFruitForm(findFruit(button.dataset.fruitId))));
  renderFruitForm(data.devilFruits[0]);
}

function renderFruitForm(fruit = null) {
  const isNew = !fruit;
  const target = document.querySelector("#fruitFormWrap");
  const draft = fruit || { id: makeId("fruit"), name: "", type: "paramecia", currentUserId: "", previousUserIds: [], description: "" };
  target.innerHTML = `
    <form id="fruitForm">
      ${formHead(isNew ? "새 열매 추가" : "열매 수정", "deleteFruitButton", isNew)}
      ${field("id", "고유 ID", draft.id)}
      ${field("name", "열매 이름", draft.name)}
      <label>계통<select name="type">${data.devilFruitTypes.map((type) => option(type.id, type.name, draft.type)).join("")}</select></label>
      <label>동물계 구분<select name="zoanSubtype">
        ${option("", "해당 없음", draft.zoanSubtype || "")}
        ${option("normal", "일반종", draft.zoanSubtype || "")}
        ${option("ancient", "고대종", draft.zoanSubtype || "")}
        ${option("mythical", "환수종", draft.zoanSubtype || "")}
      </select></label>
      ${field("model", "모델", draft.model || "")}
      <label class="inline-check"><input name="awakened" type="checkbox" ${draft.awakened ? "checked" : ""} /> 각성</label>
      <label>현재 능력자<select name="currentUserId"><option value="">미등록</option>${data.people.map((person) => option(person.id, person.name, draft.currentUserId)).join("")}</select></label>
      ${checkboxList("previousUserIds", "선대 능력자", data.people, draft.previousUserIds)}
      <label>설명<textarea name="description" rows="4">${escapeHtml(draft.description || "")}</textarea></label>
      <div class="form-actions"><button class="primary" type="submit">저장</button></div>
    </form>
  `;
  const form = document.querySelector("#fruitForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    upsert(data.devilFruits, draft.id, {
      id: value(form, "id") || makeId("fruit"),
      name: value(form, "name"),
      type: value(form, "type"),
      zoanSubtype: value(form, "zoanSubtype"),
      model: value(form, "model"),
      awakened: form.elements.awakened.checked,
      currentUserId: value(form, "currentUserId"),
      previousUserIds: checkedValues(form, "previousUserIds"),
      description: value(form, "description")
    });
    saveData();
    renderFruitEditor();
  });
  document.querySelector("#deleteFruitButton")?.addEventListener("click", () => {
    data.devilFruits = data.devilFruits.filter((item) => item.id !== draft.id);
    data.people.forEach((person) => { if (person.devilFruitId === draft.id) person.devilFruitId = ""; });
    saveData();
    renderFruitEditor();
  });
}

function renderOrganizationEditor() {
  editorBody.innerHTML = `
    <div class="stacked-editor">
      <section class="edit-form">
        <h3>세부 조직 추가</h3>
        <form id="subOrgForm">
          ${field("id", "고유 ID", makeId("sub-org"))}
          ${field("name", "세부 조직 이름", "")}
          <label>상위 조직<select name="organizationId">${organizationOptions("pirates")}</select></label>
          <label>설명<textarea name="description" rows="3"></textarea></label>
          <div class="form-actions"><button class="primary" type="submit">추가</button></div>
        </form>
      </section>
      <section class="edit-form">
        <h3>세부 조직 목록</h3>
        <div class="result-grid">${data.subOrganizations.map((sub) => `<div class="result"><strong>${escapeHtml(sub.name)}</strong><span>${escapeHtml(organizationName(sub.organizationId))}</span></div>`).join("")}</div>
      </section>
    </div>
  `;
  const form = document.querySelector("#subOrgForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    data.subOrganizations.push({ id: value(form, "id"), name: value(form, "name"), organizationId: value(form, "organizationId"), description: value(form, "description") });
    saveData();
    renderOrganizationEditor();
  });
}

function renderOriginEditor() {
  const countries = [...data.originCountries].sort((a, b) => {
    const regionCompare = originRegionName(a.regionId).localeCompare(originRegionName(b.regionId), "ko");
    return regionCompare || a.name.localeCompare(b.name, "ko");
  });
  editorBody.innerHTML = editorShell(
    "newOriginCountryButton",
    "새 출신지 추가",
    `
      <div class="edit-note">큰 바다/지역 아래의 국가, 마을, 섬 이름을 수정합니다.</div>
      ${countries.map((country) => pickButton("origin-country", country.id, country.name, originRegionName(country.regionId))).join("")}
    `,
    "originCountryFormWrap"
  );
  document.querySelector("#newOriginCountryButton").addEventListener("click", () => renderOriginCountryForm());
  editorBody.querySelectorAll("[data-origin-country-id]").forEach((button) => {
    button.addEventListener("click", () => renderOriginCountryForm(findOriginCountry(button.dataset.originCountryId)));
  });
  renderOriginCountryForm(countries[0]);
}

function renderOriginCountryForm(country = null) {
  const isNew = !country;
  const target = document.querySelector("#originCountryFormWrap");
  const draft = country || { id: makeId("origin"), regionId: "east-blue", name: "" };
  target.innerHTML = `
    <form id="originCountryForm">
      ${formHead(isNew ? "새 출신지 추가" : "출신지 수정", "deleteOriginCountryButton", isNew)}
      ${field("id", "고유 ID", draft.id)}
      ${field("name", "작은 카테고리 이름", draft.name)}
      <label>큰 카테고리<select name="regionId">${originRegionOptions(draft.regionId)}</select></label>
      <div class="form-actions"><button class="primary" type="submit">저장</button></div>
    </form>
  `;
  const form = document.querySelector("#originCountryForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const nextId = value(form, "id") || makeId("origin");
    const next = {
      id: nextId,
      regionId: value(form, "regionId"),
      name: value(form, "name")
    };
    upsert(data.originCountries, draft.id, next);
    data.people.forEach((person) => {
      if (person.originCountry === draft.id) {
        person.originCountry = nextId;
        person.originRegion = next.regionId;
        person.origin = `${originRegionName(next.regionId)} / ${next.name}`;
      }
    });
    saveData();
    renderOriginEditor();
  });
  document.querySelector("#deleteOriginCountryButton")?.addEventListener("click", () => {
    data.originCountries = data.originCountries.filter((item) => item.id !== draft.id);
    data.people.forEach((person) => {
      if (person.originCountry === draft.id) {
        person.originCountry = "";
        person.origin = originRegionName(person.originRegion);
      }
    });
    saveData();
    renderOriginEditor();
  });
}

function renderGroupEditor() {
  editorBody.innerHTML = editorShell(
    "newGroupButton",
    "새 그룹 추가",
    data.groups.map((group) => pickButton("group", group.id, group.name, `멤버 ${group.memberIds.length}명`)).join(""),
    "groupFormWrap"
  );
  document.querySelector("#newGroupButton").addEventListener("click", () => renderGroupForm());
  editorBody.querySelectorAll("[data-group-id]").forEach((button) => button.addEventListener("click", () => renderGroupForm(findGroup(button.dataset.groupId))));
  renderGroupForm(data.groups[0]);
}

function renderGroupForm(group = null) {
  const isNew = !group;
  const target = document.querySelector("#groupFormWrap");
  const draft = group || { id: makeId("group"), name: "", memberIds: [], description: "" };
  target.innerHTML = `
    <form id="groupForm">
      ${formHead(isNew ? "새 그룹 추가" : "그룹 수정", "deleteGroupButton", isNew)}
      ${field("id", "고유 ID", draft.id)}
      ${field("name", "그룹 이름", draft.name)}
      ${checkboxList("memberIds", "멤버 선택", data.people, draft.memberIds)}
      <label>그룹 설명<textarea name="description" rows="4">${escapeHtml(draft.description || "")}</textarea></label>
      <div class="form-actions"><button class="primary" type="submit">저장</button></div>
    </form>
  `;
  const form = document.querySelector("#groupForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    upsert(data.groups, draft.id, { id: value(form, "id") || makeId("group"), name: value(form, "name"), memberIds: checkedValues(form, "memberIds"), description: value(form, "description") });
    saveData();
    renderGroupEditor();
  });
  document.querySelector("#deleteGroupButton")?.addEventListener("click", () => {
    data.groups = data.groups.filter((item) => item.id !== draft.id);
    saveData();
    renderGroupEditor();
  });
}

function renderDataManager() {
  editorBody.innerHTML = `
    <section class="data-manager">
      <h3>데이터 관리</h3>
      <p>웹에서 저장한 내용은 이 브라우저에 남습니다. JSON으로 내보내면 다른 곳에 옮길 수 있습니다.</p>
      <div class="data-actions">
        <button class="primary" id="exportButton" type="button">JSON 내보내기</button>
        <label class="file-button">JSON 불러오기<input id="importInput" type="file" accept="application/json" /></label>
        <button class="danger" id="resetButton" type="button">처음 예시로 되돌리기</button>
      </div>
      <textarea id="jsonPreview" rows="16" readonly>${escapeHtml(JSON.stringify(data, null, 2))}</textarea>
    </section>
  `;
  document.querySelector("#exportButton").addEventListener("click", exportJson);
  document.querySelector("#importInput").addEventListener("change", importJson);
  document.querySelector("#resetButton").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    Object.keys(data).forEach((key) => delete data[key]);
    Object.assign(data, structuredClone(baseData));
    normalizeInPlace(data);
    saveData();
    renderDataManager();
  });
}

function renderEpisodeLinks(episodes) {
  return episodes.map((episode) => `
    <button class="episode-number-chip" type="button" data-episode-link="${escapeAttribute(episode.id)}" title="${escapeAttribute(episode.title || "제목 미등록")}">
      ${episode.number}
    </button>
  `).join("") || `<span class="muted">등록된 화수가 없습니다.</span>`;
}

function bindEpisodeLinks() {
  detail.querySelectorAll("[data-episode-link]").forEach((button) => {
    button.addEventListener("click", () => navigateToEpisode(button.dataset.episodeLink));
  });
  detail.querySelectorAll("[data-person-link]").forEach((button) => {
    button.addEventListener("click", () => navigateToPerson(button.dataset.personLink));
  });
}

function navigateToEpisode(episodeId) {
  const episode = findEpisode(episodeId);
  if (!episode) return;
  currentView = "episodes";
  activeId = String(episode.volume);
  activeEpisodeId = episode.id;
  activeFruitId = "";
  activeSubOrgId = "";
  setActiveTab();
  render();
}

function navigateToPerson(personId) {
  currentView = "people";
  activeId = personId;
  activeEpisodeId = "";
  activeFruitId = "";
  activeSubOrgId = "";
  setActiveTab();
  render();
}

function formToPerson(form, draft) {
  return {
    id: value(form, "id") || makeId("person"),
    name: value(form, "name"),
    aliases: value(form, "aliases"),
    job: value(form, "job"),
    organization: value(form, "organization"),
    subOrganization: value(form, "subOrganization"),
    age: Number(value(form, "age") || 0),
    birthday: readBirthday(form),
    heightHistory: readMetricRows(form, "height"),
    heightCm: currentHeight({ heightHistory: readMetricRows(form, "height") }),
    bountyHistory: readMetricRows(form, "bounty"),
    bounty: currentBounty({ bountyHistory: readMetricRows(form, "bounty") }),
    bloodType: value(form, "bloodType"),
    originRegion: value(form, "originRegion"),
    originCountry: value(form, "originCountry"),
    origin: `${originRegionName(value(form, "originRegion"))} / ${originCountryName(value(form, "originCountry"))}`,
    likes: value(form, "likes"),
    description: value(form, "description"),
    imageUrl: value(form, "imageUrl"),
    devilFruitId: value(form, "devilFruitId"),
    haki: {
      armament: form.elements.hakiArmament.checked,
      observation: form.elements.hakiObservation.checked,
      conqueror: form.elements.hakiConqueror.checked
    },
    bodyMeasurementsEnabled: form.elements.bodyMeasurementsEnabled.checked,
    bodyMeasurementsHistory: readMetricRows(form, "body"),
    timeline: readTimelineRows(form),
    note: value(form, "note")
  };
}

function renderPersonResult(person) {
  const image = person.imageUrl ? `<img class="result-thumb" src="${escapeAttribute(person.imageUrl)}" alt="" loading="lazy" decoding="async" />` : "";
  return `
    <div class="result person-result">
      ${image}
      <div>
        <strong>${escapeHtml(person.name)}</strong>
        <span>${escapeHtml(organizationName(person.organization))} · ${escapeHtml(subOrganizationName(person.subOrganization))} · ${escapeHtml(person.job)} · ${person.age}세 · ${currentHeight(person)}cm · ${formatBounty(currentBounty(person))}</span>
      </div>
    </div>
  `;
}

function renderPersonFormImage(person) {
  if (!person.imageUrl) {
    return `<div class="person-form-visual empty" id="personImagePreview">이미지 미등록</div>`;
  }
  return `
    <div class="person-form-visual" id="personImagePreview">
      <img class="person-form-thumb" src="${escapeAttribute(person.imageUrl)}" alt="" loading="lazy" decoding="async" />
      <span>${escapeHtml(person.name || "이름 미등록")}</span>
    </div>
  `;
}

function updatePersonImagePreview(imageUrl, name) {
  const preview = document.querySelector("#personImagePreview");
  if (!preview) return;
  if (!imageUrl) {
    preview.className = "person-form-visual empty";
    preview.textContent = "이미지 미등록";
    return;
  }
  preview.className = "person-form-visual";
  preview.innerHTML = `
    <img class="person-form-thumb" src="${escapeAttribute(imageUrl)}" alt="" loading="lazy" decoding="async" />
    <span>${escapeHtml(name || "이름 미등록")}</span>
  `;
}

function renderHakiChips(haki = {}) {
  return `
    <span class="chip">무장색: ${haki.armament ? "있음" : "없음"}</span>
    <span class="chip">견문색: ${haki.observation ? "있음" : "없음"}</span>
    <span class="chip">패왕색: ${haki.conqueror ? "있음" : "없음"}</span>
  `;
}

function renderEmptyResult(message) {
  return `<div class="result"><strong>비어 있음</strong><span>${escapeHtml(message)}</span></div>`;
}

function setActiveTab() {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === currentView));
  mobileViewSelect.value = currentView;
  searchInput.value = "";
}

function getQuizCategories() {
  ensureQuizCards();
  return quizCategoryMeta.map((category) => (
    item(category.id, category.title, `${buildQuizCards(category.id).length}장`, { id: category.id, name: category.title }, category.search)
  ));
}

function buildQuizCards(category) {
  ensureQuizCards();
  return quizCardCache.get(category) || [];
}

function ensureQuizCards() {
  if (quizCardCache.get("__ready")) return;
  quizCardCache.clear();
  quizCategoryMeta.forEach((category) => quizCardCache.set(category.id, []));
  data.people.forEach((person) => {
    const fruit = findFruit(person.devilFruitId);
    quizCategoryMeta.forEach((category) => {
      if (category.id === "timeline") return;
      const card = buildPersonQuizCard(category.id, person, fruit);
      if (card) quizCardCache.get(category.id).push(card);
    });
    (person.timeline || []).forEach((entry) => {
      const year = timelineYear(entry);
      const content = timelineContent(entry);
      if (year && content && person.imageUrl) {
        quizCardCache.get("timeline").push({
          category: "timeline",
          personId: person.id,
          front: `${person.name}: ${content}은 언제?`,
          back: year,
          acceptedAnswers: [year],
          imageUrl: person.imageUrl || ""
        });
      }
    });
  });
  data.devilFruits.forEach((fruit) => {
    const currentUser = findPerson(fruit.currentUserId);
    if (currentUser?.imageUrl) {
      quizCardCache.get("fruit").push({
        category: "fruit",
        personId: currentUser.id,
        front: `${fruit.name}의 현재 능력자는?`,
        back: currentUser.name,
        acceptedAnswers: [currentUser.name],
        imageUrl: currentUser.imageUrl || ""
      });
    }
  });
  quizCardCache.set("__ready", true);
}

function buildPersonQuizCard(category, person, fruit) {
  const imageUrl = person.imageUrl || "";
  if (!imageUrl) return null;
  const age = Number(person.age || 0);
  const height = currentHeight(person);
  const bounty = currentBounty(person);
  const origin = registeredOriginLabel(person);
  const organization = registeredOrganizationLabel(person);
  const definitions = {
    name: imageUrl && person.name ? {
      front: "이 인물의 이름은?",
      back: person.name,
      acceptedAnswers: [person.name]
    } : null,
    age: age > 0 ? {
      front: `${person.name}의 나이는?`,
      back: `${age}세`,
      acceptedAnswers: [String(age), `${age}세`, `${age}살`],
      numericAnswer: age
    } : null,
    height: height > 0 ? {
      front: `${person.name}의 현재 키는?`,
      back: `${height}cm`,
      acceptedAnswers: [String(height), `${height}cm`, `${height}센티`, `${height}센티미터`],
      numericAnswer: height
    } : null,
    bounty: bounty > 0 ? {
      front: `${person.name}의 현재 현상금은?`,
      back: formatBounty(bounty),
      acceptedAnswers: bountyAnswerVariants(bounty),
      numericAnswer: bounty
    } : null,
    bloodType: hasRegisteredText(person.bloodType) ? {
      front: `${person.name}의 혈액형은?`,
      back: person.bloodType,
      acceptedAnswers: [person.bloodType]
    } : null,
    birthday: hasRegisteredText(person.birthday) ? {
      front: `${person.name}의 생일은?`,
      back: person.birthday,
      acceptedAnswers: birthdayAnswerVariants(person.birthday)
    } : null,
    origin: origin ? {
      front: `${person.name}의 출신지는?`,
      back: origin,
      acceptedAnswers: origin.split("/").map((part) => part.trim()).filter(Boolean).concat(origin)
    } : null,
    alias: hasRegisteredText(person.aliases) ? {
      front: `${person.name}의 별명은?`,
      back: person.aliases,
      acceptedAnswers: [person.aliases]
    } : null,
    likes: hasRegisteredText(person.likes) ? {
      front: `${person.name}이 좋아하는 것은?`,
      back: person.likes,
      acceptedAnswers: [person.likes]
    } : null,
    fruit: fruit?.name ? {
      front: `${person.name}이 먹은 악마의 열매는?`,
      back: fruit.name,
      acceptedAnswers: [fruit.name]
    } : null,
    organization: organization ? {
      front: `${person.name}의 소속은?`,
      back: organization,
      acceptedAnswers: organization.split("/").map((part) => part.trim()).filter(Boolean).concat(organization)
    } : null
  };
  const definition = definitions[category];
  if (!definition) return null;
  return {
    category,
    personId: person.id,
    front: definition.front,
    back: definition.back,
    acceptedAnswers: definition.acceptedAnswers,
    numericAnswer: definition.numericAnswer,
    imageUrl
  };
}

function hasRegisteredText(value) {
  const text = String(value || "").trim();
  return Boolean(text) && !["0", "미등록", "없음", "기타"].includes(text);
}

function registeredOriginLabel(person) {
  const hasRegion = hasRegisteredText(person.originRegion);
  const hasCountry = hasRegisteredText(person.originCountry);
  if (!hasRegion && !hasCountry) return "";
  const region = hasRegion ? originRegionName(person.originRegion) : "";
  const country = hasCountry ? originCountryName(person.originCountry) : "";
  return [region, country].filter(hasRegisteredText).join(" / ");
}

function registeredOrganizationLabel(person) {
  const hasOrganization = hasRegisteredText(person.organization) && person.organization !== "etc";
  const hasSubOrganization = hasRegisteredText(person.subOrganization);
  if (!hasOrganization && !hasSubOrganization) return "";
  const organization = hasOrganization ? organizationName(person.organization) : "";
  const subOrganization = hasSubOrganization ? subOrganizationName(person.subOrganization) : "";
  return [organization, subOrganization].filter(hasRegisteredText).join(" / ");
}

function bountyAnswerVariants(amount) {
  const number = Number(amount || 0);
  if (!number) return [];
  const compact = formatBounty(number);
  return [
    String(number),
    number.toLocaleString("ko-KR"),
    compact,
    compact.replace(/\s/g, ""),
    `${number}베리`,
    `${number.toLocaleString("ko-KR")}베리`
  ];
}

function birthdayAnswerVariants(birthday) {
  const { month, day } = parseBirthday(birthday);
  if (!month || !day) return [birthday].filter(hasRegisteredText);
  const paddedMonth = month.padStart(2, "0");
  const paddedDay = day.padStart(2, "0");
  return [
    birthday,
    `${month}월 ${day}일`,
    `${month}월${day}일`,
    `${month}/${day}`,
    `${paddedMonth}/${paddedDay}`,
    `${month}-${day}`,
    `${paddedMonth}-${paddedDay}`,
    `${month}.${day}`,
    `${paddedMonth}.${paddedDay}`,
    `${month}${day}`,
    `${paddedMonth}${paddedDay}`
  ].filter(hasRegisteredText);
}

function randomCard(category, cards) {
  return cards[Math.floor(Math.random() * cards.length)] || { category, front: "카드 없음", back: "카드 없음" };
}

function startQuizSession(category, cards, mode = "all", limit = cards.length) {
  const count = Math.min(Math.max(Number(limit) || cards.length, 1), cards.length);
  const selectedCards = mode === "random" ? shuffleCards(cards).slice(0, count) : cards.slice(0, count);
  quizSession = {
    category,
    cards: selectedCards,
    index: 0,
    correct: 0,
    wrong: 0,
    answered: false,
    lastAnswer: "",
    lastCorrect: false
  };
  quizAnswerDraft = "";
  quizStudyFlipped = false;
}

function shuffleCards(cards) {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function checkQuizAnswer() {
  if (!quizSession || quizSession.answered) return;
  const input = document.querySelector("#quizAnswerInput");
  const card = quizSession.cards[quizSession.index];
  const answer = input?.value || "";
  quizAnswerDraft = answer;
  markQuizAnswer(answerMatches(answer, card), answer);
}

function markQuizAnswer(isCorrect, answer = null) {
  if (!quizSession || quizSession.answered) return;
  quizSession.answered = true;
  quizSession.lastAnswer = answer ?? (document.querySelector("#quizAnswerInput")?.value || "");
  quizSession.lastCorrect = Boolean(isCorrect);
  if (isCorrect) quizSession.correct += 1;
  else quizSession.wrong += 1;
  render();
}

function previousQuizCard() {
  if (!quizSession || quizSession.index <= 0) return;
  quizSession.index -= 1;
  quizSession.answered = false;
  quizSession.lastAnswer = "";
  quizSession.lastCorrect = false;
  quizAnswerDraft = "";
  quizStudyFlipped = false;
  render();
}

function nextQuizCard() {
  if (!quizSession) return;
  if (quizSession.index < quizSession.cards.length - 1) {
    quizSession.index += 1;
  } else {
    quizSession.index = quizSession.cards.length;
  }
  quizSession.answered = false;
  quizSession.lastAnswer = "";
  quizSession.lastCorrect = false;
  quizAnswerDraft = "";
  quizStudyFlipped = false;
  render();
}

function answerMatches(answer, card) {
  const expected = card?.back || "";
  if (card?.numericAnswer) {
    const numericAnswer = parseQuizNumber(answer, card.category);
    if (Number.isFinite(numericAnswer) && numericAnswer === Number(card.numericAnswer)) return true;
  }
  const answerCandidates = [answer];
  const expectedCandidates = [expected, ...(card?.acceptedAnswers || [])];
  return answerCandidates.some((answerCandidate) => expectedCandidates.some((expectedCandidate) => textAnswerMatches(answerCandidate, expectedCandidate)));
}

function textAnswerMatches(answer, expected) {
  const normalizedAnswer = normalizeQuizAnswer(answer);
  const normalizedExpected = normalizeQuizAnswer(expected);
  if (!normalizedAnswer || !normalizedExpected) return false;
  return normalizedAnswer === normalizedExpected
    || (normalizedAnswer.length >= 2 && normalizedExpected.includes(normalizedAnswer))
    || (normalizedExpected.length >= 2 && normalizedAnswer.includes(normalizedExpected));
}

function normalizeQuizAnswer(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function parseQuizNumber(value, category) {
  const text = String(value || "").normalize("NFKC").replaceAll(",", "").trim();
  if (!text) return NaN;
  if (category === "bounty") {
    const oku = Number(text.match(/(\d+(?:\.\d+)?)\s*억/)?.[1] || 0);
    const man = Number(text.match(/(\d+(?:\.\d+)?)\s*만/)?.[1] || 0);
    const bare = text.match(/^\d+(?:\.\d+)?$/);
    if (oku || man) {
      const beriMatch = text.replace(/(\d+(?:\.\d+)?)\s*억/g, "").replace(/(\d+(?:\.\d+)?)\s*만/g, "").match(/(\d+)/);
      return Math.round(oku * 100000000 + man * 10000 + Number(beriMatch?.[1] || 0));
    }
    return bare ? Number(bare[0]) : NaN;
  }
  const match = text.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function flipQuizCard() {
  quizFlipped = !quizFlipped;
  render();
}

function personToItem(person) {
  return item(
    person.id,
    person.name,
    `${organizationName(person.organization)} / ${subOrganizationName(person.subOrganization)} / ${person.job}`,
    person,
    `${person.name} ${person.aliases} ${person.job} ${person.origin} ${originRegionName(person.originRegion)} ${originCountryName(person.originCountry)} ${person.birthday} ${person.bloodType} ${organizationName(person.organization)} ${subOrganizationName(person.subOrganization)} ${findFruit(person.devilFruitId)?.name || ""}`
  );
}

function groupToItem(group, unit) {
  return item(group.id, group.name, `${group.people.length}${unit}`, group, `${group.name} ${group.people.map((person) => person.name).join(" ")}`);
}

function item(id, title, sub, raw, searchText) {
  return { id, title, sub, raw, searchText: String(searchText).toLowerCase() };
}

function groupBy(people, key) {
  const map = new Map();
  people.forEach((person) => {
    const value = person[key] || "미등록";
    if (!map.has(value)) map.set(value, { id: value, name: value, people: [] });
    map.get(value).people.push(person);
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function sortedPeople(key = "name") {
  const people = [...data.people];
  const appearanceOrder = key === "appearance" ? buildAppearanceOrderMap() : null;
  if (["heightCm", "age", "bounty"].includes(key)) {
    const valueFor = (person) => key === "heightCm" ? currentHeight(person) : key === "bounty" ? currentBounty(person) : Number(person[key] || 0);
    people.sort((a, b) => (sortMode === "high" ? valueFor(b) - valueFor(a) : valueFor(a) - valueFor(b)));
    return people;
  }
  const numberSort = (valueFor, direction = "asc") => {
    people.sort((a, b) => {
      const aValue = valueFor(a);
      const bValue = valueFor(b);
      const aMissing = !Number.isFinite(aValue) || aValue <= 0;
      const bMissing = !Number.isFinite(bValue) || bValue <= 0;
      if (aMissing && bMissing) return a.name.localeCompare(b.name, "ko");
      if (aMissing) return 1;
      if (bMissing) return -1;
      return direction === "desc" ? bValue - aValue : aValue - bValue;
    });
    return people;
  };
  if (key === "appearance") return numberSort((person) => appearanceOrder.get(person.id) ?? Infinity);
  if (key === "heightAsc") return numberSort(currentHeight);
  if (key === "heightDesc") return numberSort(currentHeight, "desc");
  if (key === "ageAsc") return numberSort((person) => Number(person.age || 0));
  if (key === "ageDesc") return numberSort((person) => Number(person.age || 0), "desc");
  if (key === "bountyAsc") return numberSort(currentBounty);
  if (key === "bountyDesc") return numberSort(currentBounty, "desc");
  if (key === "birthday") return numberSort(birthdaySortValue);
  if (key === "id") return people.sort((a, b) => String(a.id || "").localeCompare(String(b.id || ""), "ko", { numeric: true }));
  return people.sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function sortedStatPeople() {
  return [...data.people].sort((a, b) => {
    const aValue = statSortValue(a);
    const bValue = statSortValue(b);
    const aMissing = !Number.isFinite(aValue) || aValue <= 0;
    const bMissing = !Number.isFinite(bValue) || bValue <= 0;
    if (aMissing && bMissing) return a.name.localeCompare(b.name, "ko");
    if (aMissing) return 1;
    if (bMissing) return -1;
    return statDirection === "desc" ? bValue - aValue : aValue - bValue;
  });
}

function statSortValue(person) {
  if (statMetric === "height") return currentHeight(person);
  if (statMetric === "age") return Number(person.age || 0);
  if (statMetric === "bounty") return currentBounty(person);
  if (statMetric === "birthday") return birthdaySortValue(person);
  return 0;
}

function statValueLabel(person) {
  if (statMetric === "height") return `${currentHeight(person)}cm`;
  if (statMetric === "age") return `${person.age || 0}세`;
  if (statMetric === "bounty") return formatBounty(currentBounty(person));
  if (statMetric === "birthday") return person.birthday || "미등록";
  return "미등록";
}

function buildAppearanceOrderMap() {
  const map = new Map();
  [...data.episodes].sort(sortEpisodes).forEach((episode) => {
    (episode.characterIds || []).forEach((personId) => {
      if (!map.has(personId)) map.set(personId, Number(episode.number || 0));
    });
  });
  return map;
}

function editorShell(newButtonId, newButtonLabel, pickButtons, formId) {
  return `
    <div class="editor-layout">
      <section class="edit-list">
        <button class="primary full" id="${newButtonId}" type="button">${newButtonLabel}</button>
        ${pickButtons}
      </section>
      <section class="edit-form" id="${formId}"></section>
    </div>
  `;
}

function pickButton(kind, id, title, sub, imageUrl = "") {
  const image = imageUrl ? `<img class="edit-pick-thumb" src="${escapeAttribute(imageUrl)}" alt="" loading="lazy" decoding="async" />` : "";
  return `
    <button class="edit-pick ${image ? "with-thumb" : ""}" data-${kind}-id="${escapeAttribute(id)}" type="button">
      ${image}
      <span class="edit-pick-copy">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(sub)}</span>
      </span>
    </button>
  `;
}

function formHead(title, deleteId, hideDelete) {
  return `<div class="form-head"><h3>${escapeHtml(title)}</h3><button class="danger ${hideDelete ? "hidden" : ""}" id="${deleteId}" type="button">삭제</button></div>`;
}

function field(name, label, fieldValue = "", type = "text") {
  return `<label>${escapeHtml(label)}<input name="${escapeAttribute(name)}" type="${type}" value="${escapeAttribute(fieldValue)}" /></label>`;
}

function birthdayField(birthday) {
  const { month, day } = parseBirthday(birthday);
  return `
    <div class="birthday-selects">
      <span>생일</span>
      <label>월<select name="birthMonth">
        <option value="">미등록</option>
        ${Array.from({ length: 12 }, (_, index) => {
          const value = String(index + 1);
          return option(value, `${value}월`, month);
        }).join("")}
      </select></label>
      <label>일<select name="birthDay">
        <option value="">미등록</option>
        ${Array.from({ length: 31 }, (_, index) => {
          const value = String(index + 1);
          return option(value, `${value}일`, day);
        }).join("")}
      </select></label>
    </div>
  `;
}

function option(optionValue, label, selected) {
  return `<option value="${escapeAttribute(optionValue)}" ${optionValue === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function searchablePersonPicker(selectedIds = []) {
  const uniqueIds = uniqueExistingPersonIds(selectedIds);
  return `
    <fieldset class="check-list searchable-picker" id="episodeCharacterPicker">
      <legend>등장 인물</legend>
      <div class="selected-person-list" id="episodeSelectedCharacters">
        ${renderSelectedCharacterChips(uniqueIds)}
      </div>
      <div id="episodeCharacterInputs">${renderHiddenCharacterInputs(uniqueIds)}</div>
      <label>인물 검색<input id="episodeCharacterSearchInput" type="search" placeholder="이름, 별명, 조직, 직업 검색" /></label>
      <div class="picker-results" id="episodeCharacterResults">
        <p class="picker-empty">검색어를 입력하면 인물을 바로 추가할 수 있습니다.</p>
      </div>
    </fieldset>
  `;
}

function bindEpisodeCharacterPicker(form, selectedIds = []) {
  const picker = form.querySelector("#episodeCharacterPicker");
  const input = form.querySelector("#episodeCharacterSearchInput");
  const selectedWrap = form.querySelector("#episodeSelectedCharacters");
  const hiddenWrap = form.querySelector("#episodeCharacterInputs");
  const resultsWrap = form.querySelector("#episodeCharacterResults");
  const selected = uniqueExistingPersonIds(selectedIds);

  const refresh = () => {
    selectedWrap.innerHTML = renderSelectedCharacterChips(selected);
    hiddenWrap.innerHTML = renderHiddenCharacterInputs(selected);
    resultsWrap.innerHTML = renderCharacterSearchResults(selected, input.value);
  };

  input.addEventListener("input", refresh);
  picker.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add-character]");
    const removeButton = event.target.closest("[data-remove-character]");
    if (addButton) {
      const id = addButton.dataset.addCharacter;
      if (!selected.includes(id)) selected.push(id);
      input.value = "";
      input.focus();
      refresh();
    }
    if (removeButton) {
      const index = selected.indexOf(removeButton.dataset.removeCharacter);
      if (index >= 0) selected.splice(index, 1);
      refresh();
    }
  });
}

function uniqueExistingPersonIds(ids = []) {
  return Array.from(new Set(ids)).filter((id) => findPerson(id));
}

function renderSelectedCharacterChips(ids = []) {
  return ids.map((id) => {
    const person = findPerson(id);
    return `
      <button class="selected-person-chip" type="button" data-remove-character="${escapeAttribute(id)}">
        ${escapeHtml(person?.name || id)} <span>삭제</span>
      </button>
    `;
  }).join("") || `<p class="picker-empty">아직 선택된 인물이 없습니다.</p>`;
}

function renderHiddenCharacterInputs(ids = []) {
  return ids.map((id) => `<input class="hidden-picker-input" type="checkbox" name="characterIds" value="${escapeAttribute(id)}" checked />`).join("");
}

function renderCharacterSearchResults(selectedIds = [], query = "") {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return `<p class="picker-empty">검색어를 입력하면 인물을 바로 추가할 수 있습니다.</p>`;
  const results = data.people
    .filter((person) => !selectedIds.includes(person.id))
    .filter((person) => personToItem(person).searchText.includes(normalized))
    .slice(0, 24);

  return results.map((person) => `
    <button class="picker-result" type="button" data-add-character="${escapeAttribute(person.id)}">
      <strong>${escapeHtml(person.name)}</strong>
      <span>${escapeHtml(organizationName(person.organization))} · ${escapeHtml(subOrganizationName(person.subOrganization))} · ${escapeHtml(person.job || "직업 미등록")}</span>
    </button>
  `).join("") || `<p class="picker-empty">검색 결과가 없습니다.</p>`;
}

function checkboxList(name, label, people, selectedIds) {
  return `
    <fieldset class="check-list">
      <legend>${escapeHtml(label)}</legend>
      ${people.map((person) => `
        <label><input type="checkbox" name="${escapeAttribute(name)}" value="${escapeAttribute(person.id)}" ${selectedIds.includes(person.id) ? "checked" : ""} /> ${escapeHtml(person.name)}</label>
      `).join("")}
    </fieldset>
  `;
}

function checkboxListForItems(name, label, items, selectedIds) {
  return `
    <fieldset class="check-list">
      <legend>${escapeHtml(label)}</legend>
      ${items.map((item) => `
        <label><input type="checkbox" name="${escapeAttribute(name)}" value="${escapeAttribute(item.id)}" ${selectedIds.includes(item.id) ? "checked" : ""} /> ${escapeHtml(item.name)}</label>
      `).join("")}
    </fieldset>
  `;
}

function renderTimelineRows(timeline = []) {
  return timeline.map(renderTimelineRow).join("") || renderTimelineRow({ year: "", content: "" });
}

function renderTimelineRow(entry) {
  return `
    <div class="timeline-row">
      <label>년도<input name="timelineYear" value="${escapeAttribute(timelineYear(entry))}" /></label>
      <label>내용<input name="timelineContent" value="${escapeAttribute(timelineContent(entry))}" /></label>
    </div>
  `;
}

function readTimelineRows(form) {
  const years = Array.from(form.querySelectorAll('[name="timelineYear"]'));
  const contents = Array.from(form.querySelectorAll('[name="timelineContent"]'));
  return years.map((yearInput, index) => ({
    year: yearInput.value.trim(),
    content: contents[index]?.value.trim() || ""
  })).filter((entry) => entry.year || entry.content);
}

function renderMetricRows(entries = [], type) {
  return (entries || []).map((entry) => renderMetricRow(entry, type)).join("") || renderMetricRow({}, type);
}

function renderMetricRow(entry, type) {
  if (type === "height") {
    return `
      <div class="timeline-row">
        <label>시기<input name="heightPeriod" value="${escapeAttribute(entry.period || "")}" /></label>
        <label>키 cm<input name="heightCm" type="number" value="${escapeAttribute(entry.cm || "")}" /></label>
      </div>
    `;
  }
  if (type === "bounty") {
    return `
      <div class="timeline-row">
        <label>시기<input name="bountyPeriod" value="${escapeAttribute(entry.period || "")}" /></label>
        <label>금액<input name="bountyAmount" type="number" value="${escapeAttribute(entry.amount || "")}" /></label>
      </div>
    `;
  }
  return `
    <div class="timeline-row bwh-row">
      <label>시기<input name="bodyPeriod" value="${escapeAttribute(entry.period || "")}" /></label>
      <label>B<input name="bodyBust" type="number" value="${escapeAttribute(entry.bust || "")}" /></label>
      <label>W<input name="bodyWaist" type="number" value="${escapeAttribute(entry.waist || "")}" /></label>
      <label>H<input name="bodyHip" type="number" value="${escapeAttribute(entry.hip || "")}" /></label>
    </div>
  `;
}

function readMetricRows(form, type) {
  if (type === "height") {
    const periods = Array.from(form.querySelectorAll('[name="heightPeriod"]'));
    const values = Array.from(form.querySelectorAll('[name="heightCm"]'));
    return periods.map((period, index) => ({ period: period.value.trim(), cm: Number(values[index]?.value || 0) })).filter((entry) => entry.period || entry.cm);
  }
  if (type === "bounty") {
    const periods = Array.from(form.querySelectorAll('[name="bountyPeriod"]'));
    const values = Array.from(form.querySelectorAll('[name="bountyAmount"]'));
    return periods.map((period, index) => ({ period: period.value.trim(), amount: Number(values[index]?.value || 0) })).filter((entry) => entry.period || entry.amount);
  }
  const periods = Array.from(form.querySelectorAll('[name="bodyPeriod"]'));
  const busts = Array.from(form.querySelectorAll('[name="bodyBust"]'));
  const waists = Array.from(form.querySelectorAll('[name="bodyWaist"]'));
  const hips = Array.from(form.querySelectorAll('[name="bodyHip"]'));
  return periods.map((period, index) => ({
    period: period.value.trim(),
    bust: Number(busts[index]?.value || 0),
    waist: Number(waists[index]?.value || 0),
    hip: Number(hips[index]?.value || 0)
  })).filter((entry) => entry.period || entry.bust || entry.waist || entry.hip);
}

function organizationOptions(selected) {
  return data.organizations.map((org) => option(org.id, org.name, selected)).join("");
}

function subOrganizationOptions(selected) {
  return `<option value="">미등록</option>${data.subOrganizations.map((sub) => option(sub.id, `${organizationName(sub.organizationId)} - ${sub.name}`, selected)).join("")}`;
}

function originRegionOptions(selected) {
  return `<option value="">미등록</option>${data.originRegions.map((region) => option(region.id, region.name, selected)).join("")}`;
}

function originCountryOptions(selected) {
  return `<option value="">미등록</option>${data.originCountries.map((country) => option(country.id, `${originRegionName(country.regionId)} - ${country.name}`, selected)).join("")}`;
}

function checkedValues(form, name) {
  return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
}

function value(form, name) {
  return form.elements[name]?.value.trim() || "";
}

function upsert(list, oldId, next) {
  const index = list.findIndex((item) => item.id === oldId);
  if (index >= 0) list[index] = next;
  else list.push(next);
}

function blankPerson() {
  return {
    id: makeId("person"),
    name: "",
    aliases: "",
    job: "",
    organization: "etc",
    subOrganization: "",
    age: "",
    heightCm: "",
    bounty: "",
    bloodType: "F",
    origin: "",
    birthday: "",
    likes: "",
    description: "",
    imageUrl: "",
    devilFruitId: "",
    haki: { armament: false, observation: false, conqueror: false },
    timeline: [],
    note: ""
  };
}

function findPerson(id) {
  return data.people.find((person) => person.id === id);
}

function findTechnique(id) {
  return data.techniques.find((technique) => technique.id === id);
}

function findEpisode(id) {
  return data.episodes.find((episode) => episode.id === id);
}

function findFruit(id) {
  return data.devilFruits.find((fruit) => fruit.id === id);
}

function findGroup(id) {
  return data.groups.find((group) => group.id === id);
}

function findSubOrganization(id) {
  return data.subOrganizations.find((sub) => sub.id === id);
}

function findOriginCountry(id) {
  return data.originCountries.find((country) => country.id === id);
}

function organizationName(id) {
  return data.organizations.find((org) => org.id === id)?.name || "기타";
}

function originRegionName(id) {
  return data.originRegions.find((region) => region.id === id)?.name || "미등록";
}

function originCountryName(id) {
  return data.originCountries.find((country) => country.id === id)?.name || "미등록";
}

function subOrganizationName(id) {
  return data.subOrganizations.find((sub) => sub.id === id)?.name || "미등록";
}

function devilFruitTypeName(id) {
  return data.devilFruitTypes.find((type) => type.id === id)?.name || "미등록";
}

function zoanSubtypeName(id) {
  return { normal: "일반종", ancient: "고대종", mythical: "환수종" }[id] || "미등록";
}

function formatBounty(amount) {
  const number = Number(amount || 0);
  if (!number) return "미등록";
  const oku = Math.floor(number / 100000000);
  const man = Math.floor((number % 100000000) / 10000);
  const beri = number % 10000;
  const parts = [];
  if (oku) parts.push(`${oku.toLocaleString("ko-KR")}억`);
  if (man) parts.push(`${man.toLocaleString("ko-KR")}만`);
  if (beri || parts.length === 0) parts.push(`${beri.toLocaleString("ko-KR")}`);
  return `${parts.join(" ")}베리`;
}

function currentHeight(person) {
  const history = person.heightHistory || [];
  return Number(history[history.length - 1]?.cm || person.heightCm || 0);
}

function currentBounty(person) {
  const history = person.bountyHistory || [];
  return Number(history[history.length - 1]?.amount || person.bounty || 0);
}

function parseBirthday(birthday = "") {
  const match = String(birthday).match(/(\d{1,2})\D+(\d{1,2})/);
  return {
    month: match ? String(Number(match[1])) : "",
    day: match ? String(Number(match[2])) : ""
  };
}

function birthdaySortValue(person) {
  const { month, day } = parseBirthday(person.birthday);
  if (!month || !day) return Infinity;
  return Number(month) * 100 + Number(day);
}

function readBirthday(form) {
  const month = value(form, "birthMonth");
  const day = value(form, "birthDay");
  return month && day ? `${month}월 ${day}일` : "";
}

function timelineYear(entry) {
  return entry.year || entry.yearsAgo || "";
}

function timelineContent(entry) {
  return entry.content || [entry.title, entry.description].filter(Boolean).join(" - ");
}

function getCombinedTimeline() {
  const map = new Map();
  data.people.forEach((person) => {
    person.timeline.forEach((entry) => {
      const year = timelineYear(entry) || "미등록";
      if (!map.has(year)) map.set(year, []);
      map.get(year).push({ personName: person.name, content: timelineContent(entry) });
    });
  });
  return Array.from(map.entries()).map(([year, events]) => ({ year, events }));
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSize = 512;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.onerror = () => resolve(reader.result);
      image.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeInPlace(target) {
  target.people = (target.people || []).map((person) => ({
    aliases: "",
    subOrganization: "",
    birthday: "",
    originRegion: "",
    originCountry: "",
    bounty: 0,
    bountyHistory: [],
    heightHistory: [],
    likes: "",
    description: "",
    devilFruitId: "",
    haki: { armament: false, observation: false, conqueror: false },
    bodyMeasurementsEnabled: false,
    bodyMeasurementsHistory: [],
    timeline: [],
    ...(baseData.people || []).find((basePerson) => basePerson.id === person.id),
    ...person
  })).map((person) => ({
    ...person,
    heightHistory: person.heightHistory?.length ? person.heightHistory : [{ period: "현재", cm: Number(person.heightCm || 0) }],
    bountyHistory: person.bountyHistory?.length ? person.bountyHistory : [{ period: "현재", amount: Number(person.bounty || 0) }]
  }));
  target.techniques = (target.techniques || []).map((technique) => ({
    ...(baseData.techniques || []).find((baseTechnique) => baseTechnique.id === technique.id),
    ...technique
  }));
  target.episodes = (target.episodes || structuredClone(baseData.episodes) || []).map((episode) => ({
    characterIds: [],
    techniqueIds: [],
    summary: "",
    title: "",
    ...episode
  }));
  target.organizations = target.organizations || structuredClone(baseData.organizations);
  target.originRegions = target.originRegions || structuredClone(baseData.originRegions);
  target.originCountries = target.originCountries || structuredClone(baseData.originCountries);
  target.subOrganizations = target.subOrganizations || structuredClone(baseData.subOrganizations);
  target.devilFruitTypes = target.devilFruitTypes || structuredClone(baseData.devilFruitTypes);
  target.devilFruits = target.devilFruits || structuredClone(baseData.devilFruits);
  target.devilFruits = target.devilFruits.map((fruit) => ({
    zoanSubtype: "",
    model: "",
    awakened: false,
    ...fruit
  }));
  target.groups = target.groups || structuredClone(baseData.groups);
  target.bloodTypes = target.bloodTypes || structuredClone(baseData.bloodTypes);
  return target;
}

function loadSavedData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? normalizeInPlace(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function saveData() {
  invalidateDataCaches();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function invalidateDataCaches() {
  quizCardCache.clear();
  quizSession = null;
  quizAnswerDraft = "";
  quizStudyFlipped = false;
}

function exportJson() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "one-piece-data.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const imported = normalizeInPlace(JSON.parse(await file.text()));
  Object.keys(data).forEach((key) => delete data[key]);
  Object.assign(data, imported);
  saveData();
  renderDataManager();
}

function escapeHtml(input) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(input) {
  return escapeHtml(input).replaceAll("`", "&#096;");
}

normalizeInPlace(data);
render();
