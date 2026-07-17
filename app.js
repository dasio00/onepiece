const PATCH_STORAGE_KEY = "onePieceDataBuilder.patches.v1";
const STORAGE_KEY = "onePieceDataBuilder.v3";
const LEGACY_STORAGE_KEY = "onePieceDataBuilder.v2";
const COMPARE_RECORD_KEY = "onePieceCompareGame.records.v1";
const COMPARE_FILTER_KEY = "onePieceCompareGame.filters.v1";
const NAME_DISPLAY_MODE_KEY = "onePieceNameDisplayMode.v1";
const PERSISTED_LIST_KEYS = [
  "people",
  "techniques",
  "episodes",
  "organizations",
  "originRegions",
  "originCountries",
  "subOrganizations",
  "devilFruitTypes",
  "devilFruits",
  "groups",
  "bloodTypes",
  "customQuizzes"
];
const baseData = window.onePieceData;
const basePeopleById = new Map((baseData.people || []).map((person) => [person.id, person]));
const baseTechniquesById = new Map((baseData.techniques || []).map((technique) => [technique.id, technique]));
const baseEpisodesById = new Map((baseData.episodes || []).map((episode) => [episode.id, episode]));
const baseFruitsById = new Map((baseData.devilFruits || []).map((fruit) => [fruit.id, fruit]));
let normalizedBaseCache = null;
let storageWarningShown = false;
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
  compare: { label: "비교 게임", title: "큰 쪽을 맞히는 서바이벌 게임", listTitle: "비교 항목" },
  search: { label: "통합 검색", title: "전체 데이터 빠르게 찾기", listTitle: "검색 결과" }
};

const viewEditorConfig = {
  techniques: { mode: "techniques", title: "기술 수정", buttonLabel: "기술 수정" },
  people: { mode: "people", title: "인물 수정", buttonLabel: "인물 수정", extraTools: ["origins"] },
  episodes: { mode: "episodes", title: "에피소드 수정", buttonLabel: "에피소드 수정" },
  organizations: { mode: "organizations", title: "조직 수정", buttonLabel: "조직 수정" },
  devilFruits: { mode: "fruits", title: "악마의 열매 수정", buttonLabel: "열매 수정" },
  groups: { mode: "groups", title: "그룹 수정", buttonLabel: "그룹 수정" },
  timelines: { mode: "people", title: "인물 연표 수정", buttonLabel: "연표 수정" },
  quiz: { mode: "customQuizzes", title: "퀴즈 문제 만들기", buttonLabel: "문제 만들기" }
};

const editorToolLabels = {
  people: "인물 수정",
  episodes: "에피소드 수정",
  techniques: "기술 수정",
  fruits: "열매 수정",
  organizations: "조직 수정",
  origins: "출신지 관리",
  groups: "그룹 수정",
  customQuizzes: "문제 만들기",
  data: "데이터 관리"
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
  { id: "timeline", title: "연표", search: "연표 사건" },
  { id: "custom", title: "직접 만든 문제", search: "이미지 객관식 순서 문제" }
];

const compareMetricMeta = [
  { id: "bounty", title: "현상금", search: "현상금 베리 높은 사람", prompt: "누가 현상금이 더 높을까?" },
  { id: "age", title: "나이", search: "나이 연령 많은 사람", prompt: "누가 더 나이가 많을까?" },
  { id: "height", title: "키", search: "키 신장 큰 사람", prompt: "누가 더 클까?" }
];
const compareRevealDelayMs = 900;
const compareTieChoice = "__tie__";

let currentView = "techniques";
let activeId = "";
let sortMode = "all";
let personSortMode = "appearance";
let personEditorSortMode = "appearance";
let personEditorQuery = "";
let techniqueEditorQuery = "";
let episodeCharacterQuery = "";
let statMetric = "height";
let statDirection = "asc";
let personBrowseMode = "all";
let nameDisplayMode = loadNameDisplayMode();
let editorMode = "people";
let editorOpen = false;
let editorSelectionId = "";
let activeFruitId = "";
let activeFruitGroupKey = "all";
let activeSubOrgId = "";
let activeEpisodeId = "";
let activeEpisodeTechniqueEditorId = "";
let activeQuizCard = null;
let quizFlipped = false;
let quizSession = null;
let quizAnswerDraft = "";
let quizMode = "test";
let quizStudyFlipped = false;
let compareGame = null;
let compareRecords = loadCompareRecords();
let compareRangeFilters = loadCompareRangeFilters();
let activePersonPanel = "basic";
const LIST_BATCH_SIZE = 160;
const EDITOR_PEOPLE_BATCH_SIZE = 160;
const EDITOR_TECHNIQUE_BATCH_SIZE = 160;
let visibleListLimit = LIST_BATCH_SIZE;
let editorPeopleLimit = EDITOR_PEOPLE_BATCH_SIZE;
let editorTechniqueLimit = EDITOR_TECHNIQUE_BATCH_SIZE;
const quizCardCache = new Map();
const listItemCache = new Map();
let lookupIndexes = {};

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
const personBrowseControls = document.querySelector("#personBrowseControls");
const personBrowseSelect = document.querySelector("#personBrowseSelect");
const statSortControls = document.querySelector("#statSortControls");
const statSortLabel = document.querySelector("#statSortLabel");
const statDirectionButtons = document.querySelectorAll("[data-stat-direction]");
const mobileViewSelect = document.querySelector("#mobileViewSelect");
const nameModeSelect = document.querySelector("#nameModeSelect");
const mobileNavButtons = document.querySelectorAll("[data-mobile-nav]");
const browseWorkspace = document.querySelector("#browseWorkspace");
const editorWorkspace = document.querySelector("#editorWorkspace");
const editorBody = document.querySelector("#editorBody");
const viewEditButton = document.querySelector("#viewEditButton");
const closeEditorButton = document.querySelector("#closeEditorButton");
const editorContextTitle = document.querySelector("#editorContextTitle");
const editorContextTools = document.querySelector("#editorContextTools");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

mobileViewSelect.addEventListener("change", () => switchView(mobileViewSelect.value));

nameModeSelect.value = nameDisplayMode;
nameModeSelect.addEventListener("change", () => {
  nameDisplayMode = nameModeSelect.value === "ja" ? "ja" : "ko";
  localStorage.setItem(NAME_DISPLAY_MODE_KEY, nameDisplayMode);
  invalidateNameDisplayCaches();
  render();
});

mobileNavButtons.forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.mobileNav));
});

rangeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    sortMode = button.dataset.range;
    resetVisibleListLimit();
    rangeButtons.forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

personSortSelect.addEventListener("change", () => {
  personSortMode = personSortSelect.value;
  if (isPersonStatSort()) statMetric = personSortMode;
  activeId = "";
  resetVisibleListLimit();
  render();
});

personBrowseSelect.addEventListener("change", () => {
  personBrowseMode = personBrowseSelect.value;
  activeId = "";
  resetVisibleListLimit();
  render();
});

statDirectionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    statDirection = button.dataset.statDirection;
    activeId = "";
    resetVisibleListLimit();
    render();
  });
});

viewEditButton.addEventListener("click", openCurrentViewEditor);

closeEditorButton.addEventListener("click", () => {
  editorOpen = false;
  editorSelectionId = "";
  render();
});

editorContextTools.addEventListener("click", (event) => {
  const button = event.target.closest("[data-editor-tool]");
  if (!button) return;
  editorMode = button.dataset.editorTool;
  editorPeopleLimit = EDITOR_PEOPLE_BATCH_SIZE;
  editorTechniqueLimit = EDITOR_TECHNIQUE_BATCH_SIZE;
  if (editorMode !== viewEditorConfig[currentView]?.mode) editorSelectionId = "";
  renderEditorContext();
  renderEditor();
});

searchInput.addEventListener("input", () => {
  if (currentView === "episodes") {
    activeId = "";
    activeEpisodeId = "";
  }
  resetVisibleListLimit();
  render();
});

function switchView(view) {
  currentView = view;
  editorOpen = false;
  editorSelectionId = "";
  activeId = "";
  activeFruitId = "";
  activeSubOrgId = "";
  activeEpisodeId = "";
  activePersonPanel = "basic";
  resetVisibleListLimit();
  sortMode = "all";
  if (view === "people") personSortMode = "appearance";
  searchInput.value = "";
  setActiveTab();
  rangeButtons.forEach((button) => button.classList.toggle("active", button.dataset.range === "all"));
  personSortSelect.value = personSortMode;
  render();
}

function isListOnlyView() {
  return false;
}

function isGameLikeView() {
  return currentView === "quiz" || currentView === "compare";
}

function render() {
  const config = viewConfig[currentView];
  const editorConfig = viewEditorConfig[currentView];
  syncActiveNavigation();
  viewLabel.textContent = config.label;
  viewTitle.textContent = config.title;
  viewEditButton.classList.toggle("hidden", !editorConfig || editorOpen);
  if (editorConfig) viewEditButton.textContent = editorConfig.buttonLabel;

  const isEditor = editorOpen && Boolean(editorConfig);
  const listOnly = isListOnlyView();
  browseWorkspace.classList.toggle("hidden", isEditor);
  browseWorkspace.classList.toggle("list-only-workspace", listOnly);
  browseWorkspace.classList.toggle("quiz-workspace", isGameLikeView());
  editorWorkspace.classList.toggle("hidden", !isEditor);
  detailPane.classList.toggle("hidden", listOnly);
  searchBox.classList.toggle("hidden", isEditor || isGameLikeView());
  searchInput.placeholder = currentView === "search"
    ? "인물, 기술, 열매, 에피소드 전체 검색"
    : "이름, 조직, 열매, 직업 검색";

  if (isEditor) {
    renderEditorContext();
    renderEditor();
    return;
  }

  const query = searchInput.value.trim().toLowerCase();
  listTitle.textContent = currentView === "episodes" && query ? "에피소드 목록" : config.listTitle;
  rangeControls.classList.add("hidden");
  personBrowseControls.classList.toggle("hidden", currentView !== "people");
  personBrowseSelect.value = personBrowseMode;
  personSortControls.classList.toggle("hidden", currentView !== "people" || personBrowseMode !== "all");
  personSortSelect.value = personSortMode;
  statSortControls.classList.toggle("hidden", currentView !== "people" || personBrowseMode !== "all" || !isPersonStatSort());
  statSortLabel.textContent = `${personStatMetricLabel(statMetric)} 정렬 방향`;
  statDirectionButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.statDirection === statDirection);
  });

  const items = getCachedItems(query);
  const filteredItems = query ? items.filter((item) => item.searchText.includes(query)) : items;
  const visibleItems = filteredItems.slice(0, visibleListLimit);
  const hasMore = visibleItems.length < filteredItems.length;

  countBadge.textContent = hasMore ? `${visibleItems.length}/${filteredItems.length}개` : `${filteredItems.length}개`;
  itemList.innerHTML = `
    ${visibleItems.map(renderListItem).join("")}
    ${hasMore ? renderLoadMoreButton(filteredItems.length - visibleItems.length) : ""}
  `;
  itemList.querySelectorAll(".item").forEach((button) => {
    button.addEventListener("click", () => {
      activeId = button.dataset.id;
      activeFruitId = "";
      activeFruitGroupKey = "all";
      activeSubOrgId = "";
      activeEpisodeId = "";
      render();
    });
  });
  itemList.querySelector("[data-load-more]")?.addEventListener("click", () => {
    visibleListLimit += LIST_BATCH_SIZE;
    render();
  });

  if (listOnly) activeId = "";
  let activeItem = filteredItems.find((item) => item.id === activeId);
  if (!listOnly && (!activeId || !activeItem) && filteredItems.length > 0) {
    activeId = filteredItems[0].id;
    activeItem = filteredItems[0];
  }
  itemList.querySelectorAll(".item").forEach((button) => {
    button.classList.toggle("active", button.dataset.id === activeId);
  });
  if (listOnly) {
    detail.innerHTML = "";
    return;
  }
  renderDetail(activeItem);
}

function resetVisibleListLimit() {
  visibleListLimit = LIST_BATCH_SIZE;
}

function openCurrentViewEditor() {
  const config = viewEditorConfig[currentView];
  if (!config) return;
  editorMode = config.mode;
  editorSelectionId = currentEditorSelectionId(config.mode);
  editorPeopleLimit = EDITOR_PEOPLE_BATCH_SIZE;
  editorTechniqueLimit = EDITOR_TECHNIQUE_BATCH_SIZE;
  editorOpen = true;
  render();
}

function currentEditorSelectionId(mode) {
  if (mode === "people") return findPerson(activeId) ? activeId : "";
  if (mode === "episodes") return findEpisode(activeEpisodeId || activeId) ? (activeEpisodeId || activeId) : "";
  if (mode === "techniques") return findTechnique(activeId) ? activeId : "";
  if (mode === "fruits") return findFruit(activeFruitId || activeId) ? (activeFruitId || activeId) : "";
  if (mode === "groups") return findGroup(activeId) ? activeId : "";
  if (mode === "origins") return findOriginCountry(activeSubOrgId) ? activeSubOrgId : "";
  return "";
}

function renderEditorContext() {
  const config = viewEditorConfig[currentView];
  if (!config) return;
  const tools = [config.mode, ...(config.extraTools || []), "data"];
  editorContextTitle.textContent = editorMode === config.mode ? config.title : (editorToolLabels[editorMode] || config.title);
  editorContextTools.innerHTML = tools.map((mode) => `
    <button class="editor-mode ${editorMode === mode ? "active" : ""}" data-editor-tool="${escapeAttribute(mode)}" type="button">
      ${escapeHtml(mode === config.mode ? config.title : (editorToolLabels[mode] || mode))}
    </button>
  `).join("");
}

function getCachedItems(query = "") {
  if (currentView === "compare") return getItems(query);
  const key = [
    currentView,
    currentView === "episodes" ? Boolean(query) : "",
    currentView === "people" ? personSortMode : "",
    currentView === "people" ? personBrowseMode : "",
    currentView === "people" ? sortMode : "",
    currentView === "people" && personBrowseMode === "all" && isPersonStatSort() ? statMetric : "",
    currentView === "people" && personBrowseMode === "all" && isPersonStatSort() ? statDirection : ""
  ].join("|");
  if (!listItemCache.has(key)) listItemCache.set(key, getItems(query));
  return listItemCache.get(key);
}

function getItems(query = "") {
  if (currentView === "techniques") {
    return data.techniques.map((technique) => {
      const owner = findPerson(technique.ownerId);
      return item(technique.id, localizedName(technique), owner ? `사용자: ${personDisplayName(owner)}` : "사용자 미등록", technique, `${localizedSearchText(technique)} ${personNameSearchText(owner)}`);
    });
  }
  if (currentView === "people") return getPeopleBrowseItems();
  if (currentView === "episodes") return query ? getEpisodeSearchItems() : getEpisodeVolumeItems();
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
      return item(type.id, type.name, `열매 ${fruits.length}개`, { ...type, fruits }, `${type.name} ${fruits.map((fruit) => `${localizedSearchText(fruit)} ${fruitClassificationSearchText(fruit)}`).join(" ")}`);
    });
  }
  if (currentView === "groups") {
    return data.groups.map((group) => item(group.id, group.name, `멤버 ${group.memberIds.length}명`, group, `${group.name} ${group.description}`));
  }
  if (currentView === "timelines") {
    return [
      item("combined", "통합 연표", `${getCombinedTimeline().length}개 연도`, { mode: "combined" }, getCombinedTimeline().map((group) => group.year).join(" ")),
      ...data.people.map((person) => item(person.id, personDisplayName(person), `연표 ${person.timeline.length}개`, person, `${personNameSearchText(person)} ${person.aliases} ${person.timeline.map((entry) => `${timelineYear(entry)} ${timelineContent(entry)}`).join(" ")}`))
    ];
  }
  if (currentView === "quiz") return getQuizCategories();
  if (currentView === "compare") return getCompareGameItems();
  if (currentView === "search") return getGlobalSearchItems();
  return [];
}

function getPeopleBrowseItems() {
  if (personBrowseMode === "job") {
    return groupBy(data.people, "job").map((group) => groupToItem(group, "명"));
  }
  if (personBrowseMode === "bloodType") {
    return data.bloodTypes.map((type) => (
      groupToItem({ id: type, name: type, people: data.people.filter((person) => person.bloodType === type) }, "명")
    ));
  }
  if (personBrowseMode === "origin") {
    return data.originRegions.map((region) => {
      const people = data.people.filter((person) => person.originRegion === region.id);
      const countries = data.originCountries.filter((country) => country.regionId === region.id);
      return item(
        region.id,
        region.name,
        `국가 ${countries.length}개 · 인물 ${people.length}명`,
        { ...region, people, countries },
        `${region.name} ${countries.map((country) => country.name).join(" ")}`
      );
    });
  }
  if (personBrowseMode === "all" && isPersonStatSort()) {
    return sortedStatPeople().map((person) => ({
      ...personToItem(person),
      title: `${personDisplayName(person)} · ${statValueLabel(person)}`
    }));
  }
  return sortedPeople(personSortMode).map(personToItem);
}

function isPersonStatSort(mode = personSortMode) {
  return ["height", "birthday", "bounty", "age"].includes(mode);
}

function personStatMetricLabel(metric) {
  return {
    height: "키",
    birthday: "생일",
    bounty: "현상금",
    age: "나이"
  }[metric] || "수치";
}

function renderListItem(listItem) {
  const showImage = (currentView === "people" || listItem.raw?.resultType === "person") && listItem.raw?.imageUrl;
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

function renderLoadMoreButton(remainingCount) {
  return `
    <button class="list-more-button" type="button" data-load-more>
      더 보기 <span>${Math.min(remainingCount, LIST_BATCH_SIZE)}개</span>
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
  if (currentView === "people") {
    return listItem.raw?.people ? renderPersonGroupDetail(listItem.raw) : renderPersonDetail(listItem.raw);
  }
  if (currentView === "episodes") {
    return listItem.raw?.kind === "episode"
      ? renderEpisodeSearchDetail(listItem.raw.episode)
      : renderEpisodeVolumeDetail(listItem.raw);
  }
  if (currentView === "organizations") return renderOrganizationDetail(listItem.raw);
  if (currentView === "devilFruits") return renderDevilFruitTypeDetail(listItem.raw);
  if (currentView === "groups") return renderGroupDetail(listItem.raw);
  if (currentView === "timelines") return renderTimelineDetail(listItem.raw);
  if (currentView === "quiz") return renderQuizDetail(listItem.raw);
  if (currentView === "compare") return renderCompareGame(listItem.raw);
  if (currentView === "search") return renderGlobalSearchDetail(listItem.raw);

  detail.innerHTML = `
    <h3>${escapeHtml(listItem.title)}</h3>
    <div class="meta"><span class="chip">${listItem.raw.people.length}명</span></div>
    <div class="result-grid">${listItem.raw.people.map(renderPersonResult).join("") || renderEmptyResult("등록된 사람이 없습니다.")}</div>
  `;
}

function renderPersonGroupDetail(group) {
  detail.innerHTML = `
    <h3>${escapeHtml(group.name)}</h3>
    <div class="meta"><span class="chip">${group.people.length}명</span></div>
    <div class="result-grid">${group.people.map(renderPersonResult).join("") || renderEmptyResult("등록된 인물이 없습니다.")}</div>
  `;
}

function getEpisodeVolumeItems() {
  const volumes = new Map();
  [...data.episodes].sort(sortEpisodes).forEach((episode) => {
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
        `${volume}권 ${sorted.map((episode) => `${episode.number}화 ${episodeTitleText(episode)} ${episode.titleJa || ""}`).join(" ")}`
      );
    });
}

function getEpisodeSearchItems() {
  return [...data.episodes]
    .sort(sortEpisodes)
    .map(episodeToItem);
}

function getGlobalSearchItems() {
  const people = data.people.map((person) => {
    const fruit = findFruit(person.devilFruitId);
    return item(
      `person:${person.id}`,
      personDisplayName(person),
      `인물 · ${organizationName(person.organization)} · ${personJobLabel(person)}`,
      { resultType: "person", entity: person, imageUrl: person.imageUrl },
      `${personNameSearchText(person)} ${person.aliases} ${personJobSearchText(person)} ${person.birthday} ${person.bloodType} ${registeredOriginLabel(person)} ${organizationName(person.organization)} ${subOrganizationName(person.subOrganization)} ${fruit ? localizedSearchText(fruit) : ""}`
    );
  });
  const techniques = data.techniques.map((technique) => {
    const owner = findPerson(technique.ownerId);
    return item(
      `technique:${technique.id}`,
      localizedName(technique),
      `기술 · ${owner ? personDisplayName(owner) : "사용자 미등록"}`,
      { resultType: "technique", entity: technique },
      `${localizedSearchText(technique)} ${personNameSearchText(owner)} ${technique.note || ""}`
    );
  });
  const fruits = data.devilFruits.map((fruit) => {
    const user = findPerson(fruit.currentUserId);
    const classification = fruit.type === "zoan" ? ` · ${zoanSubtypeName(zoanSubtypeKey(fruit))}${zoanFruitModelName(fruit) ? ` · 모델 ${zoanFruitModelName(fruit)}` : ""}` : "";
    return item(
      `fruit:${fruit.id}`,
      localizedName(fruit),
      `악마의 열매 · ${devilFruitTypeName(fruit.type)}${classification} · ${user ? personDisplayName(user) : "능력자 미등록"}`,
      { resultType: "fruit", entity: fruit },
      `${localizedSearchText(fruit)} ${fruitDescriptionText(fruit)} ${devilFruitTypeName(fruit.type)} ${fruitClassificationSearchText(fruit)} ${personNameSearchText(user)}`
    );
  });
  const episodes = data.episodes.map((episode) => {
    const result = episodeToItem(episode);
    return {
      ...result,
      id: `episode:${episode.id}`,
      sub: `에피소드 · ${result.sub}`,
      raw: { resultType: "episode", episode: result.raw.episode }
    };
  });
  return [...people, ...techniques, ...fruits, ...episodes];
}

function renderGlobalSearchDetail(result) {
  if (!result) return;
  if (result.resultType === "person") return renderPersonDetail(result.entity);
  if (result.resultType === "technique") return renderTechniqueDetail(result.entity);
  if (result.resultType === "episode") return renderEpisodeSearchDetail(result.episode);
  if (result.resultType === "fruit") {
    detail.innerHTML = `
      <h3>${escapeHtml(localizedName(result.entity))}</h3>
      ${renderFruitDetail(result.entity)}
    `;
    bindEpisodeLinks();
  }
}

function episodeToItem(episode) {
  const subtitle = episodeTitleSubtext(episode);
  const characterNames = (episode.characterIds || []).map(findPerson).filter(Boolean).map(personNameSearchText).join(" ");
  const techniqueNames = episodeTechniqueIdList(episode).map(findTechnique).filter(Boolean).map(localizedSearchText).join(" ");
  return item(
    episode.id,
    `${episode.number}화 · ${episodeTitleText(episode)}`,
    `${episode.volume}권${subtitle ? ` · ${subtitle}` : ""}`,
    { kind: "episode", episode },
    `${episode.volume}권 ${episode.number}화 ${episodeTitleText(episode)} ${subtitle} ${episode.titleEn || ""} ${episodeSummaryText(episode)} ${characterNames} ${techniqueNames}`
  );
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

function renderEpisodeSearchDetail(episode) {
  activeEpisodeId = episode.id;
  detail.innerHTML = `
    <h3>${episode.volume}권 ${episode.number}화</h3>
    ${renderEpisodeDetail(episode)}
  `;
  bindEpisodeLinks();
}

function renderEpisodeDetail(episode) {
  const characters = episodeCharacterAppearances(episode);
  const techniques = episodeTechniqueAppearances(episode);
  const isEditingTechniques = activeEpisodeTechniqueEditorId === episode.id;
  return `
    <section class="nested-detail">
      <h4>${episode.number}화 · ${escapeHtml(episodeTitleText(episode))}</h4>
      ${episodeTitleSubtext(episode) ? `<p class="note">${escapeHtml(episodeTitleSubtext(episode))}</p>` : ""}
      <p class="note">${escapeHtml(episodeSummaryText(episode))}</p>
      <div class="episode-columns">
        <section>
          <h5>등장 인물</h5>
          <div class="simple-list">${characters.map(renderEpisodeCharacterLink).join("") || renderEmptyResult("등록된 등장 인물이 없습니다.")}</div>
        </section>
        <section>
          <h5>${episode.number}화에 나온 기술</h5>
          <div class="episode-technique-list">${techniques.map(renderEpisodeTechniqueAppearance).join("") || renderEmptyResult("등록된 기술이 없습니다.")}</div>
          <button class="episode-technique-open" type="button" data-episode-technique-open="${escapeAttribute(episode.id)}">
            사람 / 기술 순서 기록
          </button>
          ${isEditingTechniques ? renderEpisodeTechniqueQuickForm(episode) : ""}
        </section>
      </div>
    </section>
  `;
}

function renderEpisodeTechniqueAppearance(entry, index) {
  const people = entry.people?.length ? entry.people : (entry.person ? [entry.person] : []);
  const technique = entry.technique;
  const owner = people.length ? null : findPerson(technique.ownerId);
  return `
    <div class="episode-technique-item">
      <span class="episode-technique-order">${index + 1}</span>
      <span class="episode-technique-pair">
        <span class="episode-technique-users">
          ${people.length ? people.map((person) => renderPersonNameLink(person)).join(`<span class="episode-technique-plus">+</span>`) : (owner ? renderPersonNameLink(owner) : `<span class="muted">사용자 미등록</span>`)}
        </span>
        <span class="episode-technique-slash">/</span>
        <button class="name-link technique-name-link" type="button" data-technique-link="${escapeAttribute(technique.id)}">
          ${escapeHtml(localizedName(technique))}
        </button>
      </span>
    </div>
  `;
}

function renderEpisodeTechniqueQuickForm(episode) {
  return `
    <form class="episode-technique-quick-form" data-episode-technique-form="${escapeAttribute(episode.id)}">
      ${renderEpisodeTechniqueEditor(episode)}
      <div class="form-actions">
        <button class="primary" type="submit">기술 기록 저장</button>
        <button class="episode-technique-remove" type="button" data-episode-technique-close>닫기</button>
      </div>
    </form>
  `;
}

function renderEpisodeCharacterLink(entry) {
  return renderPersonNameLink(entry.person, entry.appearanceType);
}

function renderPersonNameLink(person, appearanceType = "") {
  const label = appearanceTypeLabel(appearanceType);
  return `
    <button class="name-link" type="button" data-person-link="${escapeAttribute(person.id)}">
      ${escapeHtml(personDisplayName(person))}
      ${label ? `<span class="mini-chip">${escapeHtml(label)}</span>` : ""}
    </button>
  `;
}

function episodeCharacterAppearances(episode) {
  const appearances = Array.isArray(episode.characterAppearances) ? episode.characterAppearances : [];
  if (!appearances.length) {
    return (episode.characterIds || []).map(findPerson).filter(Boolean).map((person) => ({ person, appearanceType: "main" }));
  }
  return appearances
    .map((appearance) => ({
      person: findPerson(appearance.characterId),
      appearanceType: appearance.appearanceType || "main"
    }))
    .filter((entry) => entry.person);
}

function normalizeEpisodeTechniqueAppearances(episode, techniques = data.techniques || []) {
  const techniquesById = new Map((techniques || []).map((technique) => [technique.id, technique]));
  const rawRows = Array.isArray(episode.techniqueAppearances) ? episode.techniqueAppearances : [];
  const rows = rawRows.length
    ? rawRows
    : (episode.techniqueIds || []).map((techniqueId) => ({ techniqueId }));
  return rows
    .map((entry) => {
      const techniqueId = entry.techniqueId || entry.id || "";
      const technique = techniquesById.get(techniqueId);
      const characterIds = uniquePersonIds([
        ...(Array.isArray(entry.characterIds) ? entry.characterIds : []),
        entry.characterId || entry.personId || entry.ownerId || "",
        technique?.ownerId || technique?.user || ""
      ]);
      return {
        characterId: characterIds[0] || "",
        characterIds,
        techniqueId
      };
    })
    .filter((entry) => entry.techniqueId);
}

function episodeTechniqueAppearances(episode) {
  return normalizeEpisodeTechniqueAppearances(episode)
    .map((entry) => ({
      ...entry,
      person: findPerson(entry.characterId),
      people: episodeTechniqueCharacterIds(entry).map(findPerson).filter(Boolean),
      technique: findTechnique(entry.techniqueId)
    }))
    .filter((entry) => entry.technique);
}

function episodeTechniqueIdList(episode, techniques = data.techniques || []) {
  const appearanceIds = normalizeEpisodeTechniqueAppearances(episode, techniques).map((entry) => entry.techniqueId).filter(Boolean);
  const fallbackIds = Array.isArray(episode.techniqueIds) ? episode.techniqueIds : [];
  return Array.from(new Set((appearanceIds.length ? appearanceIds : fallbackIds).filter(Boolean)));
}

function techniqueIdsFromAppearanceRows(rows = []) {
  return Array.from(new Set(rows.map((row) => row.techniqueId).filter(Boolean)));
}

function episodeTechniqueCharacterIds(row = {}) {
  return uniqueExistingPersonIds([
    ...(Array.isArray(row.characterIds) ? row.characterIds : []),
    row.characterId || ""
  ]);
}

function appearanceTypeForCharacter(episode, personId) {
  const appearance = (episode.characterAppearances || []).find((entry) => entry.characterId === personId);
  return appearance?.appearanceType || "main";
}

function appearanceTypeLabel(type) {
  const labels = String(type || "")
    .split("-")
    .filter((part) => part !== "main")
    .map((part) => part === "cover" ? "커버" : part === "flashback" ? "회상" : "")
    .filter(Boolean);
  return labels.join("+");
}

function getEpisodesForPerson(personId) {
  return lookupIndexes.episodesByPerson?.get(personId) || [];
}

function getEpisodesForTechnique(techniqueId) {
  return lookupIndexes.episodesByTechnique?.get(techniqueId) || [];
}

function sortEpisodes(a, b) {
  return Number(a.volume) - Number(b.volume) || Number(a.number) - Number(b.number);
}

function inferEpisodeVolume(number) {
  const chapter = Number(number || 0);
  if (!Number.isFinite(chapter) || chapter <= 0) return 1;
  if (chapter >= 1180) return 116 + Math.floor((chapter - 1180) / 11);
  if (chapter >= 1167) return 115;
  return Math.floor((chapter - 1) / 11) + 1;
}

function localizedName(entry) {
  return preferredLocalizedNames(entry).find(hasRegisteredText) || "이름 미등록";
}

function hasHangulText(value) {
  return /[가-힣]/.test(String(value || ""));
}

function hasJapaneseText(value) {
  return /[ぁ-んァ-ヶ一-龯]/.test(String(value || ""));
}

function preferredLocalizedNames(entry) {
  const legacyNameKo = hasHangulText(entry?.name) ? entry.name : "";
  const legacyNameJa = hasJapaneseText(entry?.name) ? entry.name : "";
  const legacyNameOther = !legacyNameKo && !legacyNameJa ? entry?.name : "";
  if (nameDisplayMode === "ja") {
    return [entry?.nameJa, entry?.sourceNameJa, legacyNameJa, entry?.nameKo, legacyNameKo, entry?.nameEn, entry?.sourceNameEn, legacyNameOther];
  }
  return [entry?.nameKo, legacyNameKo, entry?.nameJa, entry?.sourceNameJa, legacyNameJa, entry?.nameEn, entry?.sourceNameEn, legacyNameOther];
}

function personDisplayName(person) {
  if (nameDisplayMode === "ja") {
    return [person?.sourceNameJa, person?.nameJa, person?.name, person?.nameKo, person?.sourceNameEn, person?.nameEn].find(hasRegisteredText) || "이름 미등록";
  }
  return [person?.nameKo, person?.name, person?.sourceNameJa, person?.nameJa, person?.sourceNameEn, person?.nameEn].find(hasRegisteredText) || "이름 미등록";
}

function personOriginalNameText(person) {
  const current = personDisplayName(person);
  return Array.from(new Set([
    person?.nameKo,
    person?.sourceNameJa,
    person?.sourceNameEn,
    person?.nameJa,
    person?.nameEn,
    person?.name
  ].filter(hasRegisteredText).filter((name) => name !== current))).join(" / ");
}

function personNameSearchText(person) {
  if (!person) return "";
  return [
    personDisplayName(person),
    person.nameKo,
    person.name,
    person.nameJa,
    person.nameEn,
    person.sourceNameJa,
    person.sourceNameEn,
    person.wikiTitle
  ].filter(hasRegisteredText).join(" ");
}

function personAnswerVariants(person) {
  if (!person) return [];
  return Array.from(new Set([
    personDisplayName(person),
    person.nameKo,
    person.name,
    person.nameJa,
    person.nameEn,
    person.sourceNameJa,
    person.sourceNameEn
  ].filter(hasRegisteredText)));
}

function localizedSearchText(entry) {
  return [
    entry?.nameKo,
    entry?.name,
    entry?.nameJa,
    entry?.sourceNameJa,
    entry?.reading,
    entry?.originalNotation,
    entry?.nameEn,
    entry?.sourceNameEn,
    entry?.sourceTitle,
    entry?.descriptionKo,
    entry?.descriptionEn,
    entry?.description
  ]
    .filter(hasRegisteredText)
    .join(" ");
}

function episodeTitleText(episode) {
  return [episode?.titleKo, episode?.title, episode?.titleJa, episode?.titleEn].find(hasRegisteredText) || "제목 미등록";
}

function episodeTitleSubtext(episode) {
  return episode?.titleJa && episode.titleJa !== episodeTitleText(episode)
    ? `일본 제목: ${episode.titleJa}`
    : "";
}

function renderLocalizedNameChips(entry) {
  const currentName = localizedName(entry);
  const japaneseName = entry?.nameJa || entry?.originalNotation || "";
  const reading = entry?.reading || "";
  const japaneseWithReading = japaneseName && reading && !japaneseName.includes(reading)
    ? `${japaneseName} (${reading})`
    : japaneseName;
  return [
    japaneseWithReading && japaneseWithReading !== currentName ? `<span class="chip">일본어 원문: ${escapeHtml(japaneseWithReading)}</span>` : "",
    !japaneseName && reading ? `<span class="chip">읽는 법: ${escapeHtml(reading)}</span>` : "",
    entry?.nameEn && entry.nameEn !== currentName ? `<span class="chip">영어 위키명: ${escapeHtml(entry.nameEn)}</span>` : ""
  ].join("");
}

function localizedAnswerVariants(entry) {
  return Array.from(new Set([
    entry?.nameKo,
    entry?.name,
    entry?.nameJa,
    entry?.reading,
    entry?.originalNotation,
    entry?.nameEn
  ].filter(hasRegisteredText)));
}

function episodeSummaryText(episode) {
  return episode.summaryKo || episode.summary || "간략한 내용이 없습니다.";
}

function fruitDescriptionText(fruit) {
  return fruit.descriptionKo || fruit.description || "";
}

function renderTechniqueResult(technique) {
  const owner = findPerson(technique.ownerId);
  return `
    <button class="result result-button" type="button" data-technique-link="${escapeAttribute(technique.id)}">
      <strong>${escapeHtml(localizedName(technique))}</strong>
      <span>${escapeHtml(owner ? personDisplayName(owner) : "사용자 미등록")}</span>
    </button>
  `;
}

function renderTechniqueDetail(technique) {
  const owner = findPerson(technique.ownerId);
  const usages = getTechniqueEpisodeUsages(technique.id);
  const totalCount = usages.reduce((sum, usage) => sum + usage.count, 0);
  const sourceLink = technique.sourceUrl
    ? `<p><a class="wiki-reference-link" href="${escapeAttribute(technique.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(technique.sourceTitle || technique.nameEn || "영어 위키 문서")}</a></p>`
    : "";
  detail.innerHTML = `
    <h3>${escapeHtml(localizedName(technique))}</h3>
    <div class="meta">
      <span class="chip">사용자: ${escapeHtml(owner ? personDisplayName(owner) : "미등록")}</span>
      <span class="chip">${usages.length}개 화수</span>
      <span class="chip">총 ${totalCount}회</span>
      ${renderLocalizedNameChips(technique)}
    </div>
    <p class="note">${escapeHtml(technique.note || "")}</p>
    ${sourceLink}
    <div class="episode-chip-grid">${renderTechniqueEpisodeUsageLinks(usages)}</div>
  `;
  bindEpisodeLinks();
}

function getTechniqueEpisodeUsages(techniqueId) {
  return data.episodes
    .map((episode) => {
      const entries = episodeTechniqueAppearances(episode).filter((entry) => entry.technique.id === techniqueId);
      return entries.length ? { episode, count: entries.length } : null;
    })
    .filter(Boolean)
    .sort((a, b) => sortEpisodes(a.episode, b.episode));
}

function renderTechniqueEpisodeUsageLinks(usages) {
  return usages.map(({ episode, count }) => {
    const title = `${episodeTitleText(episode)} · ${count}회`;
    return `
      <button class="episode-number-chip technique-episode-chip" type="button" data-episode-link="${escapeAttribute(episode.id)}" title="${escapeAttribute(title)}">
        <span>${episode.number}</span><span class="mini-chip">${count}회</span>
      </button>
    `;
  }).join("") || `<span class="muted">등록된 화수가 없습니다.</span>`;
}

function renderPersonDetail(person) {
  const displayName = personDisplayName(person);
  const originalName = personOriginalNameText(person);
  const image = person.imageUrl
    ? `<img class="portrait" src="${escapeAttribute(person.imageUrl)}" alt="${escapeAttribute(displayName)} 이미지" decoding="async" />`
    : `<div class="portrait placeholder">이미지 없음</div>`;
  const fruit = findFruit(person.devilFruitId);
  const episodes = getEpisodesForPerson(person.id);
  const techniques = getTechniquesForPerson(person.id);
  const panels = ["basic", "abilities", "episodes", "history"];
  if (!panels.includes(activePersonPanel)) activePersonPanel = "basic";

  detail.innerHTML = `
    <div class="person-detail-head">
      ${image}
      <div>
        <h3>${escapeHtml(displayName)}</h3>
        ${originalName ? `<p class="person-name-alt">${escapeHtml(originalName)}</p>` : ""}
        <div class="data-status-row">${renderPersonStatusBadges(person, fruit, techniques, episodes)}</div>
        ${renderPersonPanelTabs(activePersonPanel)}
      </div>
    </div>
    <div class="person-panel-stack">
      ${renderPersonBasicPanel(person)}
      ${renderPersonAbilitiesPanel(person, fruit, techniques)}
      ${renderPersonEpisodesPanel(episodes, person.id)}
      ${renderPersonHistoryPanel(person)}
    </div>
  `;
  bindEpisodeLinks();
  bindPersonDetailControls(person);
}

function renderPersonPanelTabs(activePanel) {
  return `
    <div class="person-panel-tabs">
      ${[
        ["basic", "기본정보"],
        ["abilities", "기술·능력"],
        ["episodes", "등장화수"],
        ["history", "이력"]
      ].map(([id, label]) => `
        <button class="person-panel-tab ${activePanel === id ? "active" : ""}" data-person-panel="${id}" type="button">${label}</button>
      `).join("")}
    </div>
  `;
}

function renderPersonPanel(id, content) {
  return `<section class="person-panel ${activePersonPanel === id ? "active" : ""}" data-person-panel-content="${id}" ${activePersonPanel === id ? "" : "hidden"}>${content}</section>`;
}

function renderPersonBasicPanel(person) {
  return renderPersonPanel("basic", `
    <div class="quick-section">
      <div class="quick-section-head"><strong>태그</strong></div>
      <div class="meta">
        ${quickChip("nameKo", "한국어 이름", person.nameKo || "미등록")}
        ${quickChip("aliases", "별명", person.aliases || "미등록")}
        ${quickChip("organization", "조직", organizationName(person.organization))}
        ${quickChip("subOrganization", "세부 조직", subOrganizationName(person.subOrganization))}
        ${quickChip("job", "직업", personJobLabel(person))}
        ${quickChip("age", "연령", person.age ? `${person.age}세` : "미등록")}
        ${quickChip("birthday", "생일", person.birthday || "미등록")}
        ${quickChip("bloodType", "혈액형", person.bloodType || "미등록")}
        ${quickChip("origin", "출신지", registeredOriginLabel(person) || "미등록")}
      </div>
      <div class="quick-edit-slot" id="quickEdit-tags"></div>
    </div>
    ${renderQuickInfoBlock("likes", "좋아하는 것", person.likes || "미등록")}
    ${renderQuickInfoBlock("description", "인물 설명", personDescriptionText(person))}
    ${renderWikiReferenceBlock(person)}
  `);
}

function renderPersonAbilitiesPanel(person, fruit, techniques) {
  return renderPersonPanel("abilities", `
    <div class="quick-section">
      <div class="quick-section-head"><strong>능력</strong></div>
      <div class="meta">
        ${quickChip("devilFruitId", "악마의 열매", fruit ? localizedName(fruit) : "해당 없음/미등록")}
        ${quickChip("haki", "무장색", person.haki?.armament ? "있음" : "없음")}
        ${quickChip("haki", "견문색", person.haki?.observation ? "있음" : "없음")}
        ${quickChip("haki", "패왕색", person.haki?.conqueror ? "있음" : "없음")}
      </div>
      <div class="quick-edit-slot" id="quickEdit-abilities"></div>
    </div>
    ${renderPersonTechniqueBlock(techniques)}
  `);
}

function renderPersonEpisodesPanel(episodes, personId) {
  return renderPersonPanel("episodes", `
    <div class="info-block">
      <strong>등장화수</strong>
      <p>${episodes.length ? `${episodes.length}개 화수에 연결되어 있습니다.` : "등록된 화수가 없습니다."}</p>
      <div class="episode-chip-grid">${renderEpisodeLinks(episodes, personId)}</div>
    </div>
  `);
}

function renderPersonHistoryPanel(person) {
  return renderPersonPanel("history", `
    ${renderHistoryBlock("키 이력", person.heightHistory, (entry) => `${entry.period || "시기 미등록"} · ${entry.cm || 0}cm`, "height")}
    ${renderHistoryBlock("현상금 이력", person.bountyHistory, (entry) => `${entry.period || "시기 미등록"} · ${formatBounty(entry.amount)}`, "bounty")}
    ${person.bodyMeasurementsEnabled ? renderHistoryBlock("B-W-H 이력", person.bodyMeasurementsHistory, (entry) => `${entry.period || "시기 미등록"} · B${entry.bust || 0} W${entry.waist || 0} H${entry.hip || 0}`) : ""}
  `);
}

function renderPersonStatusBadges(person, fruit, techniques, episodes) {
  const coreFields = [
    person.aliases,
    personJobLabel(person) !== "미등록" ? personJobLabel(person) : "",
    person.age,
    person.birthday,
    currentHeight(person),
    currentBounty(person),
    person.bloodType,
    registeredOriginLabel(person),
    organizationName(person.organization) !== "기타" ? organizationName(person.organization) : ""
  ];
  const filledCount = coreFields.filter((value) => hasRegisteredText(value) || Number(value) > 0).length;
  return [
    statusBadge(person.wikiUrl ? "위키 연결" : "위키 미확인", person.wikiUrl ? "good" : "warn"),
    statusBadge(`기본 ${filledCount}/${coreFields.length}`, filledCount >= 6 ? "good" : "warn"),
    statusBadge(fruit ? "열매 등록" : "열매 해당 없음/미등록", fruit ? "good" : "neutral"),
    statusBadge(techniques.length ? `기술 ${techniques.length}개` : "기술 미등록", techniques.length ? "good" : "warn"),
    statusBadge(episodes.length ? `화수 ${episodes.length}개` : "화수 미등록", episodes.length ? "good" : "warn")
  ].join("");
}

function statusBadge(label, tone = "neutral") {
  return `<span class="data-status ${escapeAttribute(tone)}">${escapeHtml(label)}</span>`;
}

function bindPersonDetailControls(person) {
  detail.querySelectorAll("[data-person-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      activePersonPanel = button.dataset.personPanel;
      renderPersonDetail(person);
    });
  });
  bindPersonQuickEdit(person);
}

function getTechniquesForPerson(personId) {
  return lookupIndexes.techniquesByPerson?.get(personId) || [];
}

function renderPersonTechniqueBlock(techniques) {
  if (!techniques.length) {
    return `
      <section class="info-block">
        <strong>사용 기술</strong>
        <p>등록된 기술이 없습니다.</p>
      </section>
    `;
  }
  return `
    <section class="info-block">
      <strong>사용 기술</strong>
      <div class="result-grid compact-results">
        ${techniques.map(renderTechniqueResult).join("")}
      </div>
    </section>
  `;
}

function personDescriptionText(person) {
  const description = String(person.description || "").trim();
  if (description && !isAutoWikiDescription(description)) return description;
  const facts = [];
  const jobLabel = personJobLabel(person);
  if (hasRegisteredText(jobLabel)) facts.push(jobLabel);
  if (hasRegisteredText(person.birthday)) facts.push(`생일 ${person.birthday}`);
  if (currentHeight(person)) facts.push(`키 ${currentHeight(person)}cm`);
  if (currentBounty(person)) facts.push(`현상금 ${formatBounty(currentBounty(person))}`);
  const origin = registeredOriginLabel(person);
  if (origin) facts.push(`출신 ${origin}`);
  if (facts.length) return `자동 보강된 기본 정보: ${facts.join(" · ")}`;
  return person.note || "정리된 설명이 아직 없습니다.";
}

function personJobLabel(person) {
  const category = String(person?.job || person?.jobCategory || "").trim();
  const detail = String(person?.jobDetail || "").trim();
  if (category && detail && category !== detail) return `${category} · ${detail}`;
  return category || detail || "미등록";
}

function personJobSearchText(person) {
  return [person.job, person.jobCategory, person.jobDetail, person.jobEn].filter(Boolean).join(" ");
}

function isAutoWikiDescription(text) {
  return /One Piece Wiki infobox 기준 자동 보강 정보/.test(text);
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
  if (!person.wikiUrl && !person.wikiTitle && !person.wikiLookupStatus) return "";
  if (person.wikiLookupStatus === "unresolved") {
    return `
      <div class="info-block wiki-reference unresolved">
        <strong>위키 확인 필요</strong>
        <p>${escapeHtml(person.wikiLookupNote || "안전하게 연결할 위키 페이지를 찾지 못했습니다.")}</p>
      </div>
    `;
  }
  const fallbackUrl = person.wikiTitle ? `https://onepiece.fandom.com/wiki/${encodeURIComponent(String(person.wikiTitle).replaceAll(" ", "_"))}` : "";
  const href = person.wikiUrl || fallbackUrl;
  const label = person.wikiReferenceOnly ? "위키 참고" : "위키";
  const note = person.wikiReferenceOnly ? (person.wikiReferenceNote || "참고 페이지") : (person.wikiTitle || href);
  const fields = wikiFieldSummary(person);
  return `
    <div class="info-block wiki-reference">
      <strong>${escapeHtml(label)}</strong>
      <p><a class="wiki-reference-link" href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${escapeHtml(person.wikiTitle || href)}</a></p>
      ${fields ? `<p class="muted">보강 항목: ${escapeHtml(fields)}</p>` : ""}
      ${person.wikiReferenceOnly ? `<p class="muted">${escapeHtml(note)}</p>` : ""}
    </div>
  `;
}

function wikiFieldSummary(person) {
  const fields = [];
  if (hasRegisteredText(person.aliases)) fields.push("별명");
  if (hasRegisteredText(person.job)) fields.push("직업");
  if (hasRegisteredText(person.birthday)) fields.push("생일");
  if (currentHeight(person)) fields.push("키");
  if (currentBounty(person)) fields.push("현상금");
  if (hasRegisteredText(person.bloodType)) fields.push("혈액형");
  if (registeredOriginLabel(person)) fields.push("출신지");
  if (person.devilFruitId) fields.push("악마의 열매");
  return fields.join(", ");
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
  if (kind === "nameKo") {
    return `
      <form class="quick-edit-form">
        ${field("nameKo", "한국어 이름", person.nameKo || "")}
        ${quickEditActions()}
      </form>
    `;
  }
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
        ${field("job", "직업 대분류", person.job || "")}
        ${field("jobDetail", "세부 직업", person.jobDetail || "")}
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
        <label>악마의 열매<select name="devilFruitId"><option value="">없음/미등록</option>${data.devilFruits.map((fruit) => option(fruit.id, localizedName(fruit), person.devilFruitId)).join("")}</select></label>
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
        ${field("nameKo", "한국어 이름", person.nameKo || "")}
        ${field("aliases", "별명", person.aliases || "")}
        ${field("job", "직업 대분류", person.job || "")}
        ${field("jobDetail", "세부 직업", person.jobDetail || "")}
        ${field("age", "연령", person.age || "", "number")}
        ${birthdayField(person.birthday)}
        <label>조직<select name="organization">${organizationOptions(person.organization)}</select></label>
        <label>세부 조직<select name="subOrganization">${subOrganizationOptions(person.subOrganization)}</select></label>
        <label>혈액형<select name="bloodType">${data.bloodTypes.map((type) => option(type, type, person.bloodType)).join("")}</select></label>
        <label>출신 바다/지역<select name="originRegion">${originRegionOptions(person.originRegion)}</select></label>
        <label>출신 국가<select name="originCountry">${originCountryOptions(person.originCountry)}</select></label>
        <label>악마의 열매<select name="devilFruitId"><option value="">없음/미등록</option>${data.devilFruits.map((fruit) => option(fruit.id, localizedName(fruit), person.devilFruitId)).join("")}</select></label>
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
  if (kind === "nameKo") person.nameKo = value(form, "nameKo");
  if (kind === "aliases") person.aliases = value(form, "aliases");
  if (kind === "job") {
    person.job = value(form, "job");
    person.jobCategory = person.job;
    person.jobDetail = value(form, "jobDetail");
  }
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
      nameKo: value(form, "nameKo"),
      aliases: value(form, "aliases"),
      job: value(form, "job"),
      jobCategory: value(form, "job"),
      jobDetail: value(form, "jobDetail"),
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
    <h3>${escapeHtml(personDisplayName(person))} 연표</h3>
    <p class="note">상단의 연표 수정 버튼에서 년도와 내용을 바로 추가할 수 있습니다.</p>
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
  if (type.id === "zoan") return renderZoanFruitTypeDetail(type);
  const selectedFruit = activeFruitId ? findFruit(activeFruitId) : type.fruits[0];
  if (!activeFruitId && selectedFruit) activeFruitId = selectedFruit.id;

  detail.innerHTML = `
    <h3>${escapeHtml(type.name)}</h3>
    <div class="meta"><span class="chip">열매 ${type.fruits.length}개</span></div>
    <div class="sub-selector">
      ${type.fruits.map((fruit) => `<button class="sub-card ${activeFruitId === fruit.id ? "active" : ""}" data-fruit-id="${escapeAttribute(fruit.id)}" type="button">${escapeHtml(localizedName(fruit))}</button>`).join("") || "<span class=\"muted\">등록된 열매가 없습니다.</span>"}
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

function renderZoanFruitTypeDetail(type) {
  const fruits = [...type.fruits].sort(sortZoanFruits);
  const families = buildZoanFamilies(fruits);
  const groupKeys = new Set(["all", ...families.map((family) => family.key)]);
  if (!groupKeys.has(activeFruitGroupKey)) activeFruitGroupKey = "all";
  const visibleFamilies = activeFruitGroupKey === "all"
    ? families
    : families.filter((family) => family.key === activeFruitGroupKey);
  const visibleFruits = visibleFamilies.flatMap((family) => family.fruits);
  const selectedFruit = visibleFruits.find((fruit) => fruit.id === activeFruitId) || visibleFruits[0] || fruits[0];
  if (selectedFruit) activeFruitId = selectedFruit.id;
  const subtypeCounts = zoanSubtypeCounts(fruits);

  detail.innerHTML = `
    <h3>${escapeHtml(type.name)}</h3>
    <div class="meta">
      <span class="chip">열매 ${fruits.length}개</span>
      <span class="chip">계열 ${families.length}개</span>
      ${subtypeCounts.map(([key, count]) => `<span class="chip">${escapeHtml(zoanSubtypeName(key))} ${count}개</span>`).join("")}
    </div>
    <div class="sub-selector fruit-group-selector">
      <button class="sub-card ${activeFruitGroupKey === "all" ? "active" : ""}" data-fruit-group="all" type="button">전체</button>
      ${families.map((family) => `
        <button class="sub-card ${activeFruitGroupKey === family.key ? "active" : ""}" data-fruit-group="${escapeAttribute(family.key)}" type="button">
          ${escapeHtml(family.name)} <span>${family.fruits.length}</span>
        </button>
      `).join("")}
    </div>
    <div class="fruit-family-stack">
      ${visibleFamilies.map(renderZoanFamily).join("") || renderEmptyResult("등록된 동물계 열매가 없습니다.")}
    </div>
    ${selectedFruit ? renderFruitDetail(selectedFruit) : ""}
  `;
  detail.querySelectorAll("[data-fruit-group]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFruitGroupKey = button.dataset.fruitGroup;
      activeFruitId = "";
      render();
    });
  });
  detail.querySelectorAll("[data-fruit-id]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFruitId = button.dataset.fruitId;
      render();
    });
  });
}

function renderZoanFamily(family) {
  return `
    <section class="fruit-group">
      <div class="fruit-family-title">
        <strong>${escapeHtml(family.name)}</strong>
        <span>${family.fruits.length > 1 ? `${family.fruits.length}개 모델` : zoanFruitVariantLabel(family.fruits[0])}</span>
      </div>
      <div class="sub-selector fruit-model-selector">
        ${family.fruits.map((fruit) => `
          <button class="sub-card fruit-model-card ${activeFruitId === fruit.id ? "active" : ""}" data-fruit-id="${escapeAttribute(fruit.id)}" type="button">
            <strong>${escapeHtml(zoanFruitVariantLabel(fruit))}</strong>
            <span>${escapeHtml(zoanSubtypeName(zoanSubtypeKey(fruit)))} · ${escapeHtml(zoanFruitUserLabel(fruit))}</span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function buildZoanFamilies(fruits) {
  const families = new Map();
  fruits.forEach((fruit) => {
    const familyName = zoanFruitFamilyName(fruit);
    if (!families.has(familyName)) families.set(familyName, { key: familyName, name: familyName, fruits: [] });
    families.get(familyName).fruits.push(fruit);
  });
  return Array.from(families.values())
    .map((family) => ({
      ...family,
      fruits: family.fruits.sort((a, b) => zoanFruitVariantLabel(a).localeCompare(zoanFruitVariantLabel(b), "ko", { numeric: true }))
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko", { numeric: true }));
}

function sortZoanFruits(a, b) {
  const order = { normal: 0, ancient: 1, mythical: 2, smile: 3 };
  return zoanFruitFamilyName(a).localeCompare(zoanFruitFamilyName(b), "ko", { numeric: true })
    || (order[zoanSubtypeKey(a)] ?? 9) - (order[zoanSubtypeKey(b)] ?? 9)
    || zoanFruitVariantLabel(a).localeCompare(zoanFruitVariantLabel(b), "ko", { numeric: true });
}

function zoanSubtypeCounts(fruits) {
  const order = ["normal", "ancient", "mythical", "smile"];
  const counts = new Map();
  fruits.forEach((fruit) => counts.set(zoanSubtypeKey(fruit), (counts.get(zoanSubtypeKey(fruit)) || 0) + 1));
  return order.filter((key) => counts.has(key)).map((key) => [key, counts.get(key)]);
}

function zoanSubtypeKey(fruit) {
  if (fruit.zoanSubtype === "smile") return "smile";
  if (isSmileFruit(fruit)) return "smile";
  if (["mythical", "ancient", "normal"].includes(fruit.zoanSubtype)) return fruit.zoanSubtype;
  return "normal";
}

function isSmileFruit(fruit) {
  return /스마일|smile/i.test([
    fruit?.id,
    fruit?.name,
    fruit?.nameKo,
    fruit?.nameEn,
    fruit?.description,
    fruit?.descriptionKo
  ].filter(Boolean).join(" "));
}

function zoanFruitFamilyName(fruit) {
  if (isSmileFruit(fruit)) return "스마일";
  if (fruit.id === "gum-gum") return "사람사람 열매";
  const name = localizedName(fruit);
  const modelMatch = name.match(/^(.+?열매)\s*모델/);
  if (modelMatch) return modelMatch[1].trim();
  return name.replace(/\s*\([^)]*\)\s*$/g, "").trim();
}

function zoanFruitModelName(fruit) {
  if (fruit.model) return fruit.model;
  if (isSmileFruit(fruit)) return localizedName(fruit).replace(/\s*스마일\s*$/i, "").trim();
  return "";
}

function zoanFruitVariantLabel(fruit) {
  if (isSmileFruit(fruit)) return zoanFruitModelName(fruit) || localizedName(fruit);
  if (fruit.model) return `모델 ${fruit.model}`;
  const family = zoanFruitFamilyName(fruit);
  const name = localizedName(fruit);
  return name === family ? "기본형" : name.replace(family, "").trim() || name;
}

function zoanFruitUserLabel(fruit) {
  const user = findPerson(fruit.currentUserId);
  return user ? personDisplayName(user) : "능력자 미등록";
}

function fruitClassificationSearchText(fruit) {
  if (fruit?.type !== "zoan") return "";
  return [
    zoanSubtypeName(zoanSubtypeKey(fruit)),
    zoanFruitFamilyName(fruit),
    zoanFruitModelName(fruit),
    isSmileFruit(fruit) ? "스마일 SMILE 인조 동물계" : ""
  ].filter(Boolean).join(" ");
}

function renderFruitDetail(fruit) {
  const currentUser = findPerson(fruit.currentUserId);
  const previousUsers = fruit.previousUserIds.map(findPerson).filter(Boolean);
  return `
    <section class="nested-detail">
      <h4>${escapeHtml(localizedName(fruit))}</h4>
      <div class="meta">
        <span class="chip">각성: ${fruit.awakened ? "각성" : "미각성/미등록"}</span>
        ${fruit.type === "zoan" ? `<span class="chip">동물계 구분: ${escapeHtml(zoanSubtypeName(zoanSubtypeKey(fruit)))}</span>` : ""}
        ${fruit.type === "zoan" ? `<span class="chip">계열: ${escapeHtml(zoanFruitFamilyName(fruit))}</span>` : ""}
        ${fruit.type === "zoan" && zoanFruitModelName(fruit) ? `<span class="chip">모델: ${escapeHtml(zoanFruitModelName(fruit))}</span>` : ""}
        ${renderLocalizedNameChips(fruit)}
      </div>
      <p class="note">${escapeHtml(fruitDescriptionText(fruit))}</p>
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
      <div class="quiz-topbar">
        ${renderQuizCategoryPicker(category.id)}
        ${renderQuizCreatorButton()}
      </div>
      ${renderEmptyResult("이 카테고리로 만들 수 있는 카드가 없습니다.")}
    `;
    bindQuizCategoryPicker();
    bindQuizCreatorButton();
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
        ${renderQuizCreatorButton()}
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
          ${renderQuizCardContent(card, showStudyBack)}
        </div>
        ${quizMode === "test" ? `
          ${renderQuizAnswerControls(card)}
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
  bindQuizCreatorButton();
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
  detail.querySelectorAll("[data-choice-answer]").forEach((button) => {
    button.addEventListener("click", () => markQuizAnswer(button.dataset.choiceAnswer === String(card.correctOptionIndex), button.textContent.trim()));
  });
  detail.querySelector("#multipleQuizForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = Array.from(detail.querySelectorAll('[name="multipleQuizOption"]:checked'))
      .map((input) => Number(input.value))
      .sort((a, b) => a - b);
    const expected = [...card.correctOptionIndexes].sort((a, b) => a - b);
    const answer = selected.map((index) => card.options[index]).join(", ");
    markQuizAnswer(selected.length === expected.length && selected.every((value, index) => value === expected[index]), answer);
  });
  bindSequenceQuizControls(card);
  detail.querySelector("#matchQuizForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = card.pairs.map((pair, index) => detail.querySelector(`[name="matchAnswer${index}"]`)?.value || "");
    const correct = selected.every((value, index) => value !== "" && Number(value) === card.correctRightIndexes[index]);
    const answer = selected.map((value, index) => `${card.pairs[index].left} → ${card.rightOptions[Number(value)] || "미선택"}`).join(", ");
    markQuizAnswer(correct, answer);
  });
  detail.querySelector("#revealCustomAnswerButton")?.addEventListener("click", () => markQuizAnswer(true, "정답 확인"));
  document.querySelector("#flipStudyQuizButton")?.addEventListener("click", () => {
    quizStudyFlipped = !quizStudyFlipped;
    render();
  });
  document.querySelector("#prevQuizButton")?.addEventListener("click", previousQuizCard);
  document.querySelector("#nextQuizButton")?.addEventListener("click", nextQuizCard);
}

function renderQuizCardContent(card, showBack) {
  if (showBack) {
    return `<strong>${escapeHtml(card.back)}</strong>`;
  }
  if (card.customType === "order" && card.images?.length > 1 && !card.orderItems?.length) {
    return `
      <strong>${escapeHtml(card.front)}</strong>
      <div class="custom-order-grid">
        ${card.images.map((image, index) => `
          <figure class="custom-order-tile">
            <img src="${escapeAttribute(image.url)}" alt="" loading="lazy" decoding="async" />
            <figcaption>${index + 1}</figcaption>
          </figure>
        `).join("")}
      </div>
    `;
  }
  return `
    ${card.imageUrl ? `<img class="${card.customType ? "custom-quiz-prompt-image" : "quiz-face"}" src="${escapeAttribute(card.imageUrl)}" alt="" loading="lazy" decoding="async" />` : ""}
    <strong>${escapeHtml(card.front)}</strong>
  `;
}

function renderQuizAnswerControls(card) {
  if (card.customType === "choice") {
    return `
      <div class="quiz-answer custom-choice-answer">
        <div class="custom-choice-grid">
          ${card.options.map((optionText, index) => `
            <button class="sub-card" data-choice-answer="${index}" type="button" ${quizSession.answered ? "disabled" : ""}>
              ${index + 1}. ${escapeHtml(optionText)}
            </button>
          `).join("")}
        </div>
        <div class="form-actions">
          <button class="sub-card" id="revealCustomAnswerButton" type="button" ${quizSession.answered ? "disabled" : ""}>정답으로 기록</button>
          <button class="sub-card" id="nextQuizButton" type="button">${quizSession.index >= quizSession.cards.length - 1 ? "결과 보기" : "다음 문제"}</button>
        </div>
      </div>
    `;
  }
  if (card.customType === "multiple") {
    return `
      <form class="quiz-answer" id="multipleQuizForm">
        <div class="custom-choice-grid">
          ${card.options.map((optionText, index) => `
            <label class="custom-check-option">
              <input name="multipleQuizOption" type="checkbox" value="${index}" ${quizSession.answered ? "disabled" : ""} />
              <span>${index + 1}. ${escapeHtml(optionText)}</span>
            </label>
          `).join("")}
        </div>
        <div class="form-actions">
          <button class="primary" type="submit" ${quizSession.answered ? "disabled" : ""}>채점</button>
          ${renderCustomQuizNextButton()}
        </div>
      </form>
    `;
  }
  if (card.customType === "order") {
    return renderSequenceQuizControls(card, card.orderItems?.length ? card.orderItems : card.images.map((image, index) => image.label || `이미지 ${index + 1}`));
  }
  if (card.customType === "scramble") {
    return renderSequenceQuizControls(card, card.pieces);
  }
  if (card.customType === "match") {
    return `
      <form class="quiz-answer" id="matchQuizForm">
        <div class="custom-match-grid">
          ${card.pairs.map((pair, index) => `
            <label>
              <span>${escapeHtml(pair.left)}</span>
              <select name="matchAnswer${index}" ${quizSession.answered ? "disabled" : ""}>
                <option value="">연결할 항목 선택</option>
                ${card.rightOptions.map((rightText, rightIndex) => option(String(rightIndex), rightText, "")).join("")}
              </select>
            </label>
          `).join("")}
        </div>
        <div class="form-actions">
          <button class="primary" type="submit" ${quizSession.answered ? "disabled" : ""}>채점</button>
          ${renderCustomQuizNextButton()}
        </div>
      </form>
    `;
  }
  return `
    <form class="quiz-answer" id="quizAnswerForm">
      <label>답 입력<input id="quizAnswerInput" name="quizAnswer" autocomplete="off" value="${escapeAttribute(quizAnswerDraft)}" ${quizSession.answered ? "disabled" : ""} /></label>
      <div class="form-actions">
        <button class="primary" type="submit" ${quizSession.answered ? "disabled" : ""}>채점</button>
        <button class="sub-card" id="markCorrectButton" type="button" ${quizSession.answered ? "disabled" : ""}>정답으로 기록</button>
        <button class="sub-card" id="markWrongButton" type="button" ${quizSession.answered ? "disabled" : ""}>오답으로 기록</button>
        <button class="sub-card" id="nextQuizButton" type="button">${quizSession.index >= quizSession.cards.length - 1 ? "결과 보기" : "다음 문제"}</button>
      </div>
    </form>
  `;
}

function renderSequenceQuizControls(card, items) {
  return `
    <form class="quiz-answer" id="sequenceQuizForm">
      <div class="sequence-answer" id="sequenceQuizAnswer" aria-live="polite">
        <span>항목을 순서대로 선택하세요.</span>
      </div>
      <div class="sequence-pool">
        ${items.map((itemText, index) => `
          <button class="sub-card" data-sequence-index="${index}" type="button" ${quizSession.answered ? "disabled" : ""}>
            ${escapeHtml(itemText)}
          </button>
        `).join("")}
      </div>
      <div class="form-actions">
        <button class="primary" type="submit" ${quizSession.answered ? "disabled" : ""}>채점</button>
        <button class="sub-card" id="resetSequenceQuizButton" type="button" ${quizSession.answered ? "disabled" : ""}>다시 선택</button>
        ${renderCustomQuizNextButton()}
      </div>
    </form>
  `;
}

function bindSequenceQuizControls(card) {
  const form = detail.querySelector("#sequenceQuizForm");
  if (!form) return;
  const items = card.customType === "scramble"
    ? card.pieces
    : (card.orderItems?.length ? card.orderItems : card.images.map((image, index) => image.label || `이미지 ${index + 1}`));
  let selectedIndexes = [];
  const answerBox = form.querySelector("#sequenceQuizAnswer");
  const buttons = Array.from(form.querySelectorAll("[data-sequence-index]"));
  const refresh = () => {
    answerBox.innerHTML = selectedIndexes.length
      ? selectedIndexes.map((index, position) => `<b><span>${position + 1}</span>${escapeHtml(items[index])}</b>`).join("")
      : "<span>항목을 순서대로 선택하세요.</span>";
    buttons.forEach((button) => {
      button.disabled = quizSession.answered || selectedIndexes.includes(Number(button.dataset.sequenceIndex));
    });
  };
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedIndexes.push(Number(button.dataset.sequenceIndex));
      refresh();
    });
  });
  form.querySelector("#resetSequenceQuizButton").addEventListener("click", () => {
    selectedIndexes = [];
    refresh();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const answer = card.customType === "scramble"
      ? selectedIndexes.map((index) => items[index]).join("")
      : selectedIndexes.map((index) => index + 1).join("");
    markQuizAnswer(answerMatches(answer, card), selectedIndexes.map((index) => items[index]).join(" → "));
  });
}

function renderCustomQuizNextButton() {
  return `<button class="sub-card" id="nextQuizButton" type="button">${quizSession.index >= quizSession.cards.length - 1 ? "결과 보기" : "다음 문제"}</button>`;
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

function renderQuizCreatorButton() {
  return `<button class="sub-card" id="openQuizCreatorButton" type="button">문제 만들기</button>`;
}

function bindQuizCreatorButton() {
  detail.querySelector("#openQuizCreatorButton")?.addEventListener("click", () => renderQuizCreator());
}

function renderQuizCreator(quiz = null) {
  detail.innerHTML = `
    <h3>퀴즈 문제 만들기</h3>
    <div class="quiz-panel">
      <div class="quiz-topbar">
        <button class="sub-card" id="backToQuizButton" type="button">카드 퀴즈로 돌아가기</button>
      </div>
      <div id="quizCreatorFormWrap"></div>
    </div>
  `;
  detail.querySelector("#backToQuizButton").addEventListener("click", () => render());
  renderCustomQuizForm(quiz, {
    target: detail.querySelector("#quizCreatorFormWrap"),
    onSaved: () => {
      quizCardCache.clear();
      activeId = "custom";
      quizSession = null;
      quizAnswerDraft = "";
      render();
    },
    onDeleted: () => render()
  });
}

function loadNameDisplayMode() {
  try {
    return localStorage.getItem(NAME_DISPLAY_MODE_KEY) === "ja" ? "ja" : "ko";
  } catch (error) {
    return "ko";
  }
}

function getCompareGameItems() {
  return compareMetricMeta.map((metric) => {
    const peopleCount = compareEligiblePeople(metric.id).length;
    const best = compareRecords[metric.id] || 0;
    return item(metric.id, metric.title, `참가 ${peopleCount}명 · 최고 ${best}회`, { ...metric, name: metric.title }, metric.search);
  });
}

function renderCompareGame(metric) {
  const metricId = metric?.id || "bounty";
  const meta = compareMetric(metricId);
  const eligible = compareEligiblePeople(metricId);
  if (eligible.length < 2) {
    detail.innerHTML = `
      <h3>${escapeHtml(meta.title)} 비교 게임</h3>
      ${renderCompareMetricControls(metricId)}
      ${renderCompareRangeControls(metricId)}
      ${renderEmptyResult("현재 범위에서 비교할 수 있는 인물 데이터가 부족합니다. 범위를 넓히거나 전체로 돌려보세요.")}
    `;
    bindCompareGameControls();
    return;
  }
  if (!compareGame || compareGame.metric !== metricId || !compareGameIsValid(compareGame)) {
    startCompareGame(metricId);
  }
  const survivor = findPerson(compareGame.survivorId);
  const challenger = findPerson(compareGame.challengerId);
  detail.innerHTML = `
    <h3>${escapeHtml(meta.title)} 비교 게임</h3>
    <section class="compare-game">
      <div class="compare-topbar">
        <div class="compare-control-stack">
          ${renderCompareMetricControls(metricId)}
          ${renderCompareRangeControls(metricId)}
        </div>
        <button class="sub-card" id="compareRestartButton" type="button">새 게임</button>
      </div>
      <div class="compare-score">
        <span>현재 ${compareGame.streak}회</span>
        <span>최고 ${compareRecords[metricId] || 0}회</span>
        <span>참가 ${eligible.length}명</span>
        <span>근접 매칭</span>
      </div>
      ${renderCompareFeedback(compareGame.lastResult)}
      <p class="compare-prompt">${escapeHtml(meta.prompt)}</p>
      <div class="compare-arena">
        ${renderCompareCard(survivor, metricId, "생존자", compareGame.gameOver || compareGame.revealing || compareGame.streak > 0, compareGame.gameOver || compareGame.revealing)}
        <button class="compare-versus compare-tie-button" type="button" data-compare-choice="${compareTieChoice}" ${compareGame.gameOver || compareGame.revealing ? "disabled" : ""}>같다</button>
        ${renderCompareCard(challenger, metricId, "도전자", compareGame.gameOver || compareGame.revealing, compareGame.gameOver || compareGame.revealing)}
      </div>
      ${compareGame.gameOver ? `<button class="primary full" id="compareRestartBottomButton" type="button">다시 시작</button>` : ""}
    </section>
  `;
  bindCompareGameControls();
}

function renderCompareMetricControls(selectedMetric) {
  return `
    <div class="compare-metric-controls">
      ${compareMetricMeta.map((metric) => `
        <button class="range ${metric.id === selectedMetric ? "active" : ""}" type="button" data-compare-metric="${escapeAttribute(metric.id)}">
          ${escapeHtml(metric.title)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderCompareRangeControls(metricId) {
  const filter = compareRangeFilter(metricId);
  const bounds = compareRangeBounds(metricId);
  return `
    <form class="compare-range-controls" id="compareRangeForm" data-compare-range-metric="${escapeAttribute(metricId)}">
      <label>
        <span>최소</span>
        <input name="rangeMin" type="text" inputmode="numeric" value="${escapeAttribute(filter.min)}" placeholder="${escapeAttribute(compareRangePlaceholder(metricId, "min"))}" />
      </label>
      <label>
        <span>최대</span>
        <input name="rangeMax" type="text" inputmode="numeric" value="${escapeAttribute(filter.max)}" placeholder="${escapeAttribute(compareRangePlaceholder(metricId, "max"))}" />
      </label>
      <button class="range" type="button" data-compare-range-apply>범위 적용</button>
      <button class="range" type="button" data-compare-range-reset>전체</button>
      <span class="compare-range-summary">${escapeHtml(compareRangeSummary(metricId, bounds))}</span>
    </form>
  `;
}

function renderCompareCard(person, metricId, role, revealValue, disabled = false) {
  if (!person) return renderEmptyResult("인물을 불러오지 못했습니다.");
  const value = compareValue(person, metricId);
  const image = person.imageUrl
    ? `<img class="compare-face" src="${escapeAttribute(person.imageUrl)}" alt="" loading="lazy" decoding="async" />`
    : `<div class="compare-face placeholder">이미지 없음</div>`;
  return `
    <button class="compare-card" type="button" data-compare-choice="${escapeAttribute(person.id)}" ${disabled ? "disabled" : ""}>
      <span class="mini-chip">${escapeHtml(role)}</span>
      ${image}
      <strong>${escapeHtml(personDisplayName(person))}</strong>
      <span>${escapeHtml(organizationName(person.organization))} · ${escapeHtml(personJobLabel(person))}</span>
      <b class="compare-value">${revealValue ? escapeHtml(compareValueLabel(value, metricId)) : "?"}</b>
    </button>
  `;
}

function renderCompareFeedback(result) {
  if (!result) return "";
  const valueText = `${result.winnerName} ${compareValueLabel(result.winnerValue, result.metric)} / ${result.loserName} ${compareValueLabel(result.loserValue, result.metric)}`;
  const message = result.tie
    ? (result.correct ? `두 인물의 값이 같았습니다. ${result.winnerName} 생존, ${result.streak}회째 진행 중입니다.` : `두 인물의 값이 같았습니다. 기록은 ${result.streak}회입니다.`)
    : (result.correct ? `${result.winnerName} 생존, ${result.streak}회째 진행 중입니다.` : `${result.winnerName} 쪽이 더 컸습니다. 기록은 ${result.streak}회입니다.`);
  return `
    <div class="quiz-feedback ${result.correct ? "correct" : "wrong"}">
      <strong>${result.correct ? "정답" : "오답"}</strong>
      <span>${escapeHtml(message)}</span>
      <span>${escapeHtml(valueText)}</span>
    </div>
  `;
}

function bindCompareGameControls() {
  const applyCompareRange = () => {
    const form = detail.querySelector("#compareRangeForm");
    if (!form) return;
    const metricId = form.dataset.compareRangeMetric || activeId || "bounty";
    updateCompareRangeFilter(metricId, value(form, "rangeMin"), value(form, "rangeMax"));
    startCompareGame(metricId);
    render();
  };
  detail.querySelectorAll("[data-compare-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      activeId = button.dataset.compareMetric;
      startCompareGame(activeId);
      render();
    });
  });
  detail.querySelector("#compareRangeForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    applyCompareRange();
  });
  detail.querySelector("[data-compare-range-apply]")?.addEventListener("click", applyCompareRange);
  detail.querySelector("[data-compare-range-reset]")?.addEventListener("click", () => {
    const metricId = detail.querySelector("#compareRangeForm")?.dataset.compareRangeMetric || activeId || "bounty";
    updateCompareRangeFilter(metricId, "", "");
    startCompareGame(metricId);
    render();
  });
  detail.querySelectorAll("[data-compare-choice]").forEach((button) => {
    button.addEventListener("click", () => chooseComparePerson(button.dataset.compareChoice));
  });
  detail.querySelector("#compareRestartButton")?.addEventListener("click", () => {
    startCompareGame(activeId || "bounty");
    render();
  });
  detail.querySelector("#compareRestartBottomButton")?.addEventListener("click", () => {
    startCompareGame(activeId || "bounty");
    render();
  });
}

function startCompareGame(metricId) {
  const pair = pickComparePair(metricId);
  compareGame = {
    metric: metricId,
    survivorId: pair[0]?.id || "",
    challengerId: pair[1]?.id || "",
    usedIds: pair.map((person) => person.id),
    streak: 0,
    gameOver: false,
    revealing: false,
    revealToken: "",
    lastResult: null
  };
}

function chooseComparePerson(personId) {
  if (!compareGame || compareGame.gameOver || compareGame.revealing) return;
  const metricId = compareGame.metric;
  const survivor = findPerson(compareGame.survivorId);
  const challenger = findPerson(compareGame.challengerId);
  if (!survivor || !challenger) {
    startCompareGame(metricId);
    render();
    return;
  }
  const survivorValue = compareValue(survivor, metricId);
  const challengerValue = compareValue(challenger, metricId);
  const tie = survivorValue === challengerValue;
  const winner = tie ? survivor : (survivorValue > challengerValue ? survivor : challenger);
  const loser = winner.id === survivor.id ? challenger : survivor;
  const winnerValue = Math.max(survivorValue, challengerValue);
  const loserValue = Math.min(survivorValue, challengerValue);
  const correct = tie ? personId === compareTieChoice : personId === winner.id;
  const nextStreak = correct ? compareGame.streak + 1 : compareGame.streak;
  compareGame.lastResult = {
    metric: metricId,
    correct,
    tie,
    winnerName: personDisplayName(winner),
    loserName: personDisplayName(loser),
    winnerValue,
    loserValue,
    streak: nextStreak
  };
  if (!correct) {
    compareGame.gameOver = true;
    compareGame.revealing = true;
    render();
    return;
  }
  compareGame.streak = nextStreak;
  updateCompareRecord(metricId, compareGame.streak);
  const nextChallenger = pickCompareChallenger(metricId, winner.id, compareGame.usedIds);
  const revealToken = `${Date.now()}-${Math.random()}`;
  compareGame.revealing = true;
  compareGame.revealToken = revealToken;
  compareGame.gameOver = !nextChallenger;
  render();
  if (nextChallenger) {
    window.setTimeout(() => {
      if (!compareGame || compareGame.metric !== metricId || compareGame.revealToken !== revealToken || compareGame.gameOver) return;
      compareGame.survivorId = winner.id;
      compareGame.challengerId = nextChallenger.id;
      compareGame.usedIds = [...new Set([...(compareGame.usedIds || []), nextChallenger.id])];
      compareGame.revealing = false;
      compareGame.revealToken = "";
      render();
    }, compareRevealDelayMs);
  }
}

function compareGameIsValid(game) {
  const survivor = findPerson(game.survivorId);
  const challenger = findPerson(game.challengerId);
  if (!survivor || !challenger) return false;
  const bounds = compareRangeBounds(game.metric);
  return compareValue(survivor, game.metric) > 0
    && compareValue(challenger, game.metric) > 0
    && comparePersonWithinBounds(survivor, game.metric, bounds)
    && comparePersonWithinBounds(challenger, game.metric, bounds);
}

function pickComparePair(metricId) {
  const people = shuffleCards(compareEligiblePeople(metricId));
  const anchor = people[0];
  const opponent = pickCloseCompareCandidate(metricId, anchor, people.filter((person) => person.id !== anchor?.id));
  if (anchor && opponent) return [anchor, opponent];
  return people.slice(0, 2);
}

function pickCompareChallenger(metricId, survivorId, usedIds = []) {
  const survivor = findPerson(survivorId);
  const used = new Set(usedIds);
  const people = compareEligiblePeople(metricId).filter((person) => person.id !== survivorId);
  const unused = people.filter((person) => !used.has(person.id));
  return pickCloseCompareCandidate(metricId, survivor, unused)
    || pickCloseCompareCandidate(metricId, survivor, people)
    || null;
}

function pickCloseCompareCandidate(metricId, anchor, candidates, poolSize = 10) {
  if (!anchor) return null;
  const anchorValue = compareValue(anchor, metricId);
  const anchorMatchValue = compareMatchValue(anchor, metricId);
  const ranked = shuffleCards(candidates)
    .map((person) => ({
      person,
      value: compareValue(person, metricId),
      distance: Math.abs(compareMatchValue(person, metricId) - anchorMatchValue)
    }))
    .filter((entry) => entry.value > 0 && entry.value !== anchorValue)
    .sort((a, b) => a.distance - b.distance);
  const closePool = ranked.slice(0, Math.min(poolSize, ranked.length));
  if (!closePool.length) return null;
  const weighted = closePool.flatMap((entry, index) => Array(Math.max(closePool.length - index, 1)).fill(entry.person));
  return weighted[Math.floor(Math.random() * weighted.length)] || closePool[0].person;
}

function compareEligiblePeople(metricId) {
  const bounds = compareRangeBounds(metricId);
  return data.people.filter((person) => (
    person.imageUrl
    && compareValue(person, metricId) > 0
    && !isExcludedFromCompareMetric(person, metricId)
    && comparePersonWithinBounds(person, metricId, bounds)
  ));
}

function isExcludedFromCompareMetric(person, metricId) {
  if (metricId !== "bounty") return false;
  return person.organization === "navy" || /해군|소드/.test(String(person.jobDetail || ""));
}

function compareMetric(metricId) {
  return compareMetricMeta.find((metric) => metric.id === metricId) || compareMetricMeta[0];
}

function compareValue(person, metricId) {
  if (!person) return 0;
  if (metricId === "height") return currentHeight(person);
  if (metricId === "age") return Number(person.age || 0);
  if (metricId === "bounty") return currentBounty(person);
  return 0;
}

function compareMatchValue(person, metricId) {
  const value = compareValue(person, metricId);
  if (metricId === "bounty") return Math.log10(Math.max(value, 1));
  return value;
}

function compareValueLabel(value, metricId) {
  if (metricId === "height") return `${value}cm`;
  if (metricId === "age") return `${value}세`;
  if (metricId === "bounty") return formatBounty(value);
  return String(value);
}

function compareRangeFilter(metricId) {
  const filter = compareRangeFilters[metricId] || {};
  return {
    min: String(filter.min || ""),
    max: String(filter.max || "")
  };
}

function compareRangeBounds(metricId) {
  const filter = compareRangeFilter(metricId);
  let min = parseCompareRangeValue(filter.min, metricId);
  let max = parseCompareRangeValue(filter.max, metricId);
  if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
    [min, max] = [max, min];
  }
  return {
    min: Number.isFinite(min) ? min : null,
    max: Number.isFinite(max) ? max : null
  };
}

function comparePersonWithinBounds(person, metricId, bounds = compareRangeBounds(metricId)) {
  const value = compareValue(person, metricId);
  if (bounds.min !== null && value < bounds.min) return false;
  if (bounds.max !== null && value > bounds.max) return false;
  return true;
}

function compareRangeSummary(metricId, bounds = compareRangeBounds(metricId)) {
  const minText = bounds.min !== null ? compareValueLabel(bounds.min, metricId) : "";
  const maxText = bounds.max !== null ? compareValueLabel(bounds.max, metricId) : "";
  if (minText && maxText) return `${minText} 이상 · ${maxText} 이하`;
  if (minText) return `${minText} 이상`;
  if (maxText) return `${maxText} 이하`;
  return "전체 범위";
}

function compareRangePlaceholder(metricId, side) {
  if (metricId === "bounty") return side === "min" ? "예: 3억" : "예: 30억";
  if (metricId === "height") return side === "min" ? "예: 170" : "예: 200";
  if (metricId === "age") return side === "min" ? "예: 20" : "예: 50";
  return "숫자";
}

function parseCompareRangeValue(input, metricId) {
  const text = String(input || "").normalize("NFKC").replaceAll(",", "").trim();
  if (!text) return NaN;
  if (metricId === "bounty") return parseBountyInput(text);
  const number = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? number : NaN;
}

function parseBountyInput(input) {
  const text = String(input || "").replace(/\s/g, "");
  if (!text) return NaN;
  let total = 0;
  const oku = text.match(/(\d+(?:\.\d+)?)억/);
  const man = text.match(/(\d+(?:\.\d+)?)만/);
  if (oku) total += Number(oku[1]) * 100000000;
  if (man) total += Number(man[1]) * 10000;
  const rest = text
    .replace(/(\d+(?:\.\d+)?)억/g, "")
    .replace(/(\d+(?:\.\d+)?)만/g, "")
    .replace(/베리/g, "")
    .replace(/[^\d.]/g, "");
  if (rest) total += Number(rest);
  if (total) return Math.round(total);
  const number = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? number : NaN;
}

function updateCompareRangeFilter(metricId, min, max) {
  compareRangeFilters = {
    ...compareRangeFilters,
    [metricId]: {
      min: String(min || "").trim(),
      max: String(max || "").trim()
    }
  };
  saveCompareRangeFilters();
}

function loadCompareRangeFilters() {
  try {
    return JSON.parse(localStorage.getItem(COMPARE_FILTER_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCompareRangeFilters() {
  localStorage.setItem(COMPARE_FILTER_KEY, JSON.stringify(compareRangeFilters));
}

function loadCompareRecords() {
  try {
    return JSON.parse(localStorage.getItem(COMPARE_RECORD_KEY) || "{}");
  } catch {
    return {};
  }
}

function updateCompareRecord(metricId, streak) {
  if ((compareRecords[metricId] || 0) >= streak) return;
  compareRecords = { ...compareRecords, [metricId]: streak };
  localStorage.setItem(COMPARE_RECORD_KEY, JSON.stringify(compareRecords));
}

function renderEditor() {
  if (editorMode === "people") renderPeopleEditor();
  if (editorMode === "episodes") renderEpisodeEditor();
  if (editorMode === "techniques") renderTechniqueEditor();
  if (editorMode === "fruits") renderFruitEditor();
  if (editorMode === "organizations") renderOrganizationEditor();
  if (editorMode === "origins") renderOriginEditor();
  if (editorMode === "groups") renderGroupEditor();
  if (editorMode === "customQuizzes") renderCustomQuizEditor();
  if (editorMode === "data") renderDataManager();
}

function renderEpisodeEditor() {
  editorBody.innerHTML = editorShell(
    "newEpisodeButton",
    "새 에피소드 추가",
    data.episodes
      .slice()
      .sort((a, b) => Number(a.volume) - Number(b.volume) || Number(a.number) - Number(b.number))
      .map((episode) => pickButton("episode", episode.id, `${episode.volume}권 ${episode.number}화`, episodeTitleText(episode)))
      .join(""),
    "episodeFormWrap"
  );
  document.querySelector("#newEpisodeButton").addEventListener("click", () => {
    editorSelectionId = "";
    renderEpisodeForm();
  });
  editorBody.querySelectorAll("[data-episode-id]").forEach((button) => {
    button.addEventListener("click", () => {
      editorSelectionId = button.dataset.episodeId;
      renderEpisodeForm(findEpisode(editorSelectionId));
    });
  });
  renderEpisodeForm(findEpisode(editorSelectionId) || data.episodes[0]);
}

function renderEpisodeForm(episode = null) {
  const isNew = !episode;
  const target = document.querySelector("#episodeFormWrap");
  const nextNumber = nextEpisodeNumber();
  const draft = episode || { id: makeId("episode"), volume: inferEpisodeVolume(nextNumber), number: nextNumber, title: "", summary: "", characterIds: [], characterAppearances: [], techniqueIds: [], techniqueAppearances: [] };
  target.innerHTML = `
    <form id="episodeForm">
      ${formHead(isNew ? "새 에피소드 추가" : "에피소드 수정", "deleteEpisodeButton", isNew)}
      ${field("id", "고유 ID", draft.id)}
      ${field("volume", "권", draft.volume, "number")}
      ${field("number", "화", draft.number, "number")}
      ${field("title", "화 제목", draft.title)}
      <label>간략한 내용<textarea name="summary" rows="4">${escapeHtml(draft.summary || "")}</textarea></label>
      ${searchablePersonPicker(draft.characterIds || [])}
      <div class="form-actions"><button class="primary" type="submit">저장</button></div>
    </form>
  `;
  const form = document.querySelector("#episodeForm");
  bindEpisodeCharacterPicker(form, draft.characterIds || []);
  form.elements.number.addEventListener("input", () => {
    form.elements.volume.value = inferEpisodeVolume(form.elements.number.value);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const techniqueAppearances = normalizeEpisodeTechniqueAppearances(draft);
    const characterIds = uniqueExistingPersonIds([
      ...checkedValues(form, "characterIds"),
      ...techniqueAppearances.flatMap(episodeTechniqueCharacterIds)
    ]);
    const number = Number(value(form, "number") || 1);
    const next = {
      id: value(form, "id") || makeId("episode"),
      volume: Number(value(form, "volume") || inferEpisodeVolume(number)),
      number,
      title: value(form, "title"),
      summary: value(form, "summary"),
      characterIds,
      characterAppearances: syncEpisodeCharacterAppearances(draft, characterIds),
      techniqueAppearances,
      techniqueIds: techniqueIdsFromAppearanceRows(techniqueAppearances)
    };
    upsert(data.episodes, draft.id, next);
    editorSelectionId = next.id;
    activeId = searchInput.value.trim() ? next.id : String(next.volume);
    activeEpisodeId = next.id;
    saveData();
    renderEpisodeEditor();
  });
  document.querySelector("#deleteEpisodeButton")?.addEventListener("click", () => {
    data.episodes = data.episodes.filter((item) => item.id !== draft.id);
    if (editorSelectionId === draft.id) editorSelectionId = "";
    if (activeEpisodeId === draft.id) activeEpisodeId = "";
    saveData();
    renderEpisodeEditor();
  });
}

function renderPeopleEditor() {
  const people = sortedPeople(personEditorSortMode).filter((person) => {
    const query = personEditorQuery.trim().toLowerCase();
    if (!query) return true;
    return personToItem(person).searchText.includes(query);
  });
  const visiblePeople = people.slice(0, editorPeopleLimit);
  const hasMorePeople = visiblePeople.length < people.length;
  editorBody.innerHTML = editorShell(
    "newPersonButton",
    "새 인물 추가",
    `
      <div class="edit-tools">
        <label>검색<input id="personEditorSearchInput" type="search" value="${escapeAttribute(personEditorQuery)}" placeholder="이름, 조직, 직업 검색" /></label>
        <label>정렬<select id="personEditorSortSelect">
          <option value="appearance" ${personEditorSortMode === "appearance" ? "selected" : ""}>등장순</option>
          <option value="id" ${personEditorSortMode === "id" ? "selected" : ""}>고유 ID 순</option>
          <option value="name" ${personEditorSortMode === "name" ? "selected" : ""}>이름순</option>
          <option value="heightAsc" ${personEditorSortMode === "heightAsc" ? "selected" : ""}>키 낮은 순</option>
          <option value="heightDesc" ${personEditorSortMode === "heightDesc" ? "selected" : ""}>키 높은 순</option>
          <option value="ageAsc" ${personEditorSortMode === "ageAsc" ? "selected" : ""}>나이 낮은 순</option>
          <option value="ageDesc" ${personEditorSortMode === "ageDesc" ? "selected" : ""}>나이 높은 순</option>
          <option value="bountyAsc" ${personEditorSortMode === "bountyAsc" ? "selected" : ""}>현상금 낮은 순</option>
          <option value="bountyDesc" ${personEditorSortMode === "bountyDesc" ? "selected" : ""}>현상금 높은 순</option>
          <option value="birthday" ${personEditorSortMode === "birthday" ? "selected" : ""}>생일순</option>
        </select></label>
        <span class="edit-count">${hasMorePeople ? `${visiblePeople.length}/${people.length}명 표시` : `${people.length}명`}</span>
      </div>
      ${visiblePeople.map((person) => pickButton("person", person.id, personDisplayName(person), `${organizationName(person.organization)} · ${subOrganizationName(person.subOrganization)}`, person.imageUrl)).join("")}
      ${hasMorePeople ? `<button class="list-more-button" id="morePeopleButton" type="button">더 보기 <span>${Math.min(people.length - visiblePeople.length, EDITOR_PEOPLE_BATCH_SIZE)}명</span></button>` : ""}
    `,
    "personFormWrap"
  );
  document.querySelector("#newPersonButton").addEventListener("click", () => {
    editorSelectionId = "";
    renderPersonForm();
  });
  document.querySelector("#personEditorSearchInput").addEventListener("input", (event) => {
    personEditorQuery = event.target.value;
    editorPeopleLimit = EDITOR_PEOPLE_BATCH_SIZE;
    const cursor = event.target.selectionStart || personEditorQuery.length;
    renderPeopleEditor();
    const input = document.querySelector("#personEditorSearchInput");
    input.focus();
    input.setSelectionRange(cursor, cursor);
  });
  document.querySelector("#personEditorSortSelect").addEventListener("change", (event) => {
    personEditorSortMode = event.target.value;
    editorPeopleLimit = EDITOR_PEOPLE_BATCH_SIZE;
    renderPeopleEditor();
  });
  document.querySelector("#morePeopleButton")?.addEventListener("click", () => {
    editorPeopleLimit += EDITOR_PEOPLE_BATCH_SIZE;
    renderPeopleEditor();
  });
  editorBody.querySelectorAll("[data-person-id]").forEach((button) => button.addEventListener("click", () => {
    editorSelectionId = button.dataset.personId;
    renderPersonForm(findPerson(editorSelectionId));
  }));
  renderPersonForm(findPerson(editorSelectionId) || people[0] || data.people[0]);
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
      ${field("nameKo", "한국어 이름", draft.nameKo || "")}
      ${field("aliases", "별명", draft.aliases)}
      ${field("job", "직업 대분류", draft.job)}
      ${field("jobDetail", "세부 직업", draft.jobDetail || "")}
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
      <label>악마의 열매<select name="devilFruitId"><option value="">없음/미등록</option>${data.devilFruits.map((fruit) => option(fruit.id, localizedName(fruit), draft.devilFruitId)).join("")}</select></label>
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
    updatePersonImagePreview(form.elements.imageUrl.value, value(form, "nameKo") || value(form, "name"));
  });
  form.elements.imageFile.addEventListener("change", async () => {
    const file = form.elements.imageFile.files[0];
    if (file) {
      form.elements.imageUrl.value = await fileToDataUrl(file);
      updatePersonImagePreview(form.elements.imageUrl.value, value(form, "nameKo") || value(form, "name"));
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const next = formToPerson(form, draft);
    upsert(data.people, draft.id, next);
    editorSelectionId = next.id;
    activeId = next.id;
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
    if (editorSelectionId === draft.id) editorSelectionId = "";
    if (activeId === draft.id) activeId = "";
    saveData();
    renderPeopleEditor();
  });
}

function renderTechniqueEditor() {
  const listState = techniqueEditorListState();
  editorBody.innerHTML = editorShell(
    "newTechniqueButton",
    "새 기술 추가",
    `
      <div class="edit-tools">
        <label>검색<input id="techniqueEditorSearchInput" type="search" value="${escapeAttribute(techniqueEditorQuery)}" placeholder="한글·일본어·영어 기술명, 사용자, 메모 검색" aria-controls="techniqueEditorResults" /></label>
        <span class="edit-count" id="techniqueEditorCount" aria-live="polite">${techniqueEditorCountText(listState)}</span>
      </div>
      <div class="edit-result-list" id="techniqueEditorResults">${techniqueEditorResultHtml(listState)}</div>
    `,
    "techniqueFormWrap"
  );
  document.querySelector("#newTechniqueButton").addEventListener("click", () => {
    editorSelectionId = "";
    renderTechniqueForm();
  });
  document.querySelector("#techniqueEditorSearchInput").addEventListener("input", (event) => {
    techniqueEditorQuery = event.target.value;
    editorTechniqueLimit = EDITOR_TECHNIQUE_BATCH_SIZE;
    updateTechniqueEditorResults();
  });
  editorBody.querySelector(".edit-list").addEventListener("click", (event) => {
    const moreButton = event.target.closest("#moreTechniquesButton");
    if (moreButton) {
      editorTechniqueLimit += EDITOR_TECHNIQUE_BATCH_SIZE;
      updateTechniqueEditorResults();
      return;
    }
    const button = event.target.closest("[data-technique-id]");
    if (!button) return;
    editorSelectionId = button.dataset.techniqueId;
    renderTechniqueForm(findTechnique(editorSelectionId));
  });
  renderTechniqueForm(findTechnique(editorSelectionId) || listState.techniques[0] || data.techniques[0]);
}

function techniqueEditorListState() {
  const queryTerms = normalizeTechniqueEditorSearch(techniqueEditorQuery).split(/\s+/).filter(Boolean);
  const techniques = data.techniques.filter((technique) => {
    if (!queryTerms.length) return true;
    const searchText = techniqueEditorSearchText(technique);
    const compactSearchText = searchText.replace(/\s+/g, "");
    return queryTerms.every((term) => searchText.includes(term) || compactSearchText.includes(term));
  });
  const visibleTechniques = techniques.slice(0, editorTechniqueLimit);
  return {
    techniques,
    visibleTechniques,
    hasMoreTechniques: visibleTechniques.length < techniques.length
  };
}

function techniqueEditorCountText({ techniques, visibleTechniques, hasMoreTechniques }) {
  const resultLabel = techniqueEditorQuery.trim() ? "검색 결과 " : "";
  return `${resultLabel}${hasMoreTechniques ? `${visibleTechniques.length}/${techniques.length}개 표시` : `${techniques.length}개`}`;
}

function techniqueEditorResultHtml({ techniques, visibleTechniques, hasMoreTechniques }) {
  const picks = visibleTechniques.map((technique) => {
    const owner = findPerson(technique.ownerId || technique.user);
    return pickButton("technique", technique.id, localizedName(technique), owner ? personDisplayName(owner) : "사용자 미등록");
  }).join("");
  const empty = picks ? "" : `<p class="picker-empty">검색 결과가 없습니다.</p>`;
  const more = hasMoreTechniques
    ? `<button class="list-more-button" id="moreTechniquesButton" type="button">더 보기 <span>${Math.min(techniques.length - visibleTechniques.length, EDITOR_TECHNIQUE_BATCH_SIZE)}개</span></button>`
    : "";
  return `${picks}${empty}${more}`;
}

function updateTechniqueEditorResults() {
  const results = document.querySelector("#techniqueEditorResults");
  const count = document.querySelector("#techniqueEditorCount");
  if (!results || !count) return;
  const listState = techniqueEditorListState();
  results.innerHTML = techniqueEditorResultHtml(listState);
  count.textContent = techniqueEditorCountText(listState);
}

function techniqueEditorSearchText(technique) {
  const owner = findPerson(technique.ownerId || technique.user);
  return normalizeTechniqueEditorSearch([
    technique.nameKo,
    technique.name,
    technique.nameJa,
    technique.sourceNameJa,
    technique.nameEn,
    technique.sourceNameEn,
    technique.reading,
    technique.originalNotation,
    personNameSearchText(owner),
    owner?.aliases,
    technique.note
  ].filter(hasRegisteredText).join(" "));
}

function normalizeTechniqueEditorSearch(text) {
  return String(text || "").normalize("NFKC").toLocaleLowerCase("ko-KR");
}

function renderTechniqueForm(technique = null) {
  const isNew = !technique;
  const target = document.querySelector("#techniqueFormWrap");
  const draft = technique || {
    id: makeId("technique"),
    name: "",
    nameKo: "",
    nameJa: "",
    nameEn: "",
    ownerId: "",
    user: "",
    target: "",
    chapter: "",
    location: "",
    orderInStory: "",
    reading: "",
    originalNotation: "",
    sourceTitle: "",
    sourceUrl: "",
    note: ""
  };
  const formNameKo = draft.nameKo || (hasHangulText(draft.name) ? draft.name : "");
  const formNameJa = draft.nameJa || (hasJapaneseText(draft.name) ? draft.name : "");
  const formNameEn = draft.nameEn || (!hasHangulText(draft.name) && !hasJapaneseText(draft.name) ? draft.name : "");
  target.innerHTML = `
    <form id="techniqueForm">
      ${formHead(isNew ? "새 기술 추가" : "기술 수정", "deleteTechniqueButton", isNew)}
      ${field("id", "고유 ID", draft.id)}
      <p class="muted">표시 우선순위는 한글명 → 일본어 원문(읽는 법) → 영어명입니다. 영어명과 위키 정보는 원문 연결에 사용됩니다.</p>
      ${field("nameKo", "한글 기술명 (우선 표시)", formNameKo)}
      ${field("nameJa", "일본어 원문·한자명", formNameJa)}
      ${field("reading", "일본어 읽는 법", draft.reading || "")}
      ${field("nameEn", "영어 기술명 (위키 연결)", formNameEn)}
      ${field("originalNotation", "기타 원문 표기", draft.originalNotation || "")}
      ${field("sourceTitle", "영어 위키 문서명", draft.sourceTitle || "")}
      ${field("sourceUrl", "영어 위키 주소", draft.sourceUrl || "", "url")}
      <label>사용자<select name="ownerId"><option value="">미등록</option>${data.people.map((person) => option(person.id, personDisplayName(person), draft.ownerId)).join("")}</select></label>
      ${field("target", "대상", draft.target || "")}
      ${field("chapter", "등장 화수", draft.chapter || "", "number")}
      ${field("location", "장소", draft.location || "")}
      ${field("orderInStory", "작중 순서", draft.orderInStory || "", "number")}
      <label>메모<textarea name="note" rows="4">${escapeHtml(draft.note || "")}</textarea></label>
      <div class="form-actions"><button class="primary" type="submit">저장</button></div>
    </form>
  `;
  const form = document.querySelector("#techniqueForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const nameKo = value(form, "nameKo");
    const nameJa = value(form, "nameJa");
    const nameEn = value(form, "nameEn");
    const next = {
      ...draft,
      id: value(form, "id") || makeId("technique"),
      name: nameKo || nameJa || nameEn || value(form, "originalNotation") || draft.name || "",
      nameKo,
      nameJa,
      nameEn,
      ownerId: value(form, "ownerId"),
      user: value(form, "ownerId"),
      target: value(form, "target"),
      chapter: Number(value(form, "chapter") || 0),
      location: value(form, "location"),
      orderInStory: Number(value(form, "orderInStory") || 0),
      reading: value(form, "reading"),
      originalNotation: value(form, "originalNotation"),
      sourceTitle: value(form, "sourceTitle"),
      sourceUrl: value(form, "sourceUrl"),
      note: value(form, "note")
    };
    upsert(data.techniques, draft.id, next);
    editorSelectionId = next.id;
    activeId = next.id;
    saveData();
    renderTechniqueEditor();
  });
  document.querySelector("#deleteTechniqueButton")?.addEventListener("click", () => {
    data.techniques = data.techniques.filter((item) => item.id !== draft.id);
    if (editorSelectionId === draft.id) editorSelectionId = "";
    if (activeId === draft.id) activeId = "";
    saveData();
    renderTechniqueEditor();
  });
}

function renderFruitEditor() {
  editorBody.innerHTML = editorShell(
    "newFruitButton",
    "새 열매 추가",
    data.devilFruits.map((fruit) => pickButton("fruit", fruit.id, localizedName(fruit), devilFruitTypeName(fruit.type))).join(""),
    "fruitFormWrap"
  );
  document.querySelector("#newFruitButton").addEventListener("click", () => {
    editorSelectionId = "";
    renderFruitForm();
  });
  editorBody.querySelectorAll("[data-fruit-id]").forEach((button) => button.addEventListener("click", () => {
    editorSelectionId = button.dataset.fruitId;
    renderFruitForm(findFruit(editorSelectionId));
  }));
  renderFruitForm(findFruit(editorSelectionId) || data.devilFruits[0]);
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
        ${option("smile", "스마일", draft.zoanSubtype || "")}
      </select></label>
      ${field("model", "모델", draft.model || "")}
      <label class="inline-check"><input name="awakened" type="checkbox" ${draft.awakened ? "checked" : ""} /> 각성</label>
      <label>현재 능력자<select name="currentUserId"><option value="">미등록</option>${data.people.map((person) => option(person.id, personDisplayName(person), draft.currentUserId)).join("")}</select></label>
      ${checkboxList("previousUserIds", "선대 능력자", data.people, draft.previousUserIds)}
      <label>설명<textarea name="description" rows="4">${escapeHtml(draft.description || "")}</textarea></label>
      <div class="form-actions"><button class="primary" type="submit">저장</button></div>
    </form>
  `;
  const form = document.querySelector("#fruitForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const next = {
      id: value(form, "id") || makeId("fruit"),
      name: value(form, "name"),
      type: value(form, "type"),
      zoanSubtype: value(form, "zoanSubtype"),
      model: value(form, "model"),
      awakened: form.elements.awakened.checked,
      currentUserId: value(form, "currentUserId"),
      previousUserIds: checkedValues(form, "previousUserIds"),
      description: value(form, "description")
    };
    upsert(data.devilFruits, draft.id, next);
    editorSelectionId = next.id;
    activeId = next.type;
    activeFruitId = next.id;
    activeFruitGroupKey = "all";
    saveData();
    renderFruitEditor();
  });
  document.querySelector("#deleteFruitButton")?.addEventListener("click", () => {
    data.devilFruits = data.devilFruits.filter((item) => item.id !== draft.id);
    data.people.forEach((person) => { if (person.devilFruitId === draft.id) person.devilFruitId = ""; });
    if (editorSelectionId === draft.id) editorSelectionId = "";
    if (activeFruitId === draft.id) activeFruitId = "";
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
  document.querySelector("#newOriginCountryButton").addEventListener("click", () => {
    editorSelectionId = "";
    renderOriginCountryForm();
  });
  editorBody.querySelectorAll("[data-origin-country-id]").forEach((button) => {
    button.addEventListener("click", () => {
      editorSelectionId = button.dataset.originCountryId;
      renderOriginCountryForm(findOriginCountry(editorSelectionId));
    });
  });
  renderOriginCountryForm(findOriginCountry(editorSelectionId) || countries[0]);
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
    editorSelectionId = next.id;
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
    if (editorSelectionId === draft.id) editorSelectionId = "";
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
  document.querySelector("#newGroupButton").addEventListener("click", () => {
    editorSelectionId = "";
    renderGroupForm();
  });
  editorBody.querySelectorAll("[data-group-id]").forEach((button) => button.addEventListener("click", () => {
    editorSelectionId = button.dataset.groupId;
    renderGroupForm(findGroup(editorSelectionId));
  }));
  renderGroupForm(findGroup(editorSelectionId) || data.groups[0]);
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
    const next = { id: value(form, "id") || makeId("group"), name: value(form, "name"), memberIds: checkedValues(form, "memberIds"), description: value(form, "description") };
    upsert(data.groups, draft.id, next);
    editorSelectionId = next.id;
    activeId = next.id;
    saveData();
    renderGroupEditor();
  });
  document.querySelector("#deleteGroupButton")?.addEventListener("click", () => {
    data.groups = data.groups.filter((item) => item.id !== draft.id);
    if (editorSelectionId === draft.id) editorSelectionId = "";
    if (activeId === draft.id) activeId = "";
    saveData();
    renderGroupEditor();
  });
}

function renderCustomQuizEditor() {
  data.customQuizzes ||= [];
  editorBody.innerHTML = editorShell(
    "newCustomQuizButton",
    "새 퀴즈 문제 추가",
    `
      <div class="edit-note">직접 고른 이미지로 주관식, 객관식, 순서 배열, 글자 배열, 좌우 연결 문제를 만듭니다.</div>
      ${data.customQuizzes.map((quiz) => pickButton("custom-quiz", quiz.id, quiz.question || "제목 없는 문제", customQuizTypeLabel(quiz.type), quiz.images?.[0]?.url || "")).join("")}
    `,
    "customQuizFormWrap"
  );
  document.querySelector("#newCustomQuizButton").addEventListener("click", () => {
    editorSelectionId = "";
    renderCustomQuizForm();
  });
  editorBody.querySelectorAll("[data-custom-quiz-id]").forEach((button) => {
    button.addEventListener("click", () => {
      editorSelectionId = button.dataset.customQuizId;
      renderCustomQuizForm(findCustomQuiz(editorSelectionId));
    });
  });
  renderCustomQuizForm(findCustomQuiz(editorSelectionId) || data.customQuizzes[0]);
}

function renderCustomQuizForm(quiz = null, settings = {}) {
  const isNew = !quiz || !(data.customQuizzes || []).some((item) => item.id === quiz.id);
  const target = settings.target || document.querySelector("#customQuizFormWrap");
  const draft = normalizeCustomQuizDraft(quiz);
  target.innerHTML = `
    <form id="customQuizForm">
      ${formHead(isNew ? "새 퀴즈 문제" : "퀴즈 문제 수정", "deleteCustomQuizButton", isNew)}
      ${field("id", "고유 ID", draft.id)}
      <label>문제 유형
        <select name="type" id="customQuizTypeSelect">
          ${option("text", "주관식 입력", draft.type)}
          ${option("choice", "단일 선택 객관식", draft.type)}
          ${option("multiple", "복수 정답 객관식", draft.type)}
          ${option("order", "순서 배열", draft.type)}
          ${option("scramble", "글자 조각 배열", draft.type)}
          ${option("match", "좌우 항목 연결", draft.type)}
        </select>
      </label>
      <label>문제 문장<input name="question" value="${escapeAttribute(draft.question)}" placeholder="예: 이 장면의 인물은 누구?" /></label>
      <fieldset class="timeline-editor custom-quiz-image-editor">
        <legend>문제 이미지</legend>
        <div id="customQuizImageRows">${renderCustomQuizImageRows(draft)}</div>
        <button class="sub-card ${draft.type === "order" ? "" : "hidden"}" id="addCustomQuizImageButton" type="button">이미지 추가</button>
      </fieldset>
      <fieldset class="timeline-editor ${["text", "scramble"].includes(draft.type) ? "" : "hidden"}" id="customTextFields">
        <legend>주관식 정답</legend>
        <label>정답<input name="textAnswer" value="${escapeAttribute(draft.textAnswer)}" placeholder="정확한 정답" /></label>
        <label>추가 인정 답안<input name="alternativeAnswers" value="${escapeAttribute(draft.alternativeAnswers.join(" | "))}" placeholder="답안 여러 개는 | 로 구분" /></label>
        <label class="${draft.type === "scramble" ? "" : "hidden"}">글자 조각<input name="scramblePieces" value="${escapeAttribute(draft.pieces.join(", "))}" placeholder="예: 진, 공, 로, 켓, 트" /></label>
      </fieldset>
      <fieldset class="timeline-editor ${["choice", "multiple"].includes(draft.type) ? "" : "hidden"}" id="customChoiceFields">
        <legend>선택지</legend>
        ${[0, 1, 2, 3].map((index) => field(`option${index}`, `${index + 1}번 보기`, draft.options[index] || "")).join("")}
        <label class="${draft.type === "choice" ? "" : "hidden"}">정답 번호<input name="correctOptionIndex" type="number" min="1" max="4" value="${Number(draft.correctOptionIndex || 0) + 1}" /></label>
        <label class="${draft.type === "multiple" ? "" : "hidden"}">정답 번호들<input name="correctOptionIndexes" value="${escapeAttribute(draft.correctOptionIndexes.map((index) => index + 1).join(", "))}" placeholder="예: 1, 3, 4" /></label>
      </fieldset>
      <fieldset class="timeline-editor ${draft.type === "order" ? "" : "hidden"}" id="customOrderFields">
        <legend>순서 정답</legend>
        <p class="edit-note">텍스트 항목을 입력하면 항목 순서 문제로, 비워두고 이미지를 여러 장 넣으면 이미지 순서 문제로 출제됩니다.</p>
        ${[0, 1, 2, 3].map((index) => field(`orderItem${index}`, `${index + 1}번 항목`, draft.orderItems[index] || "")).join("")}
        <label>정답 순서<input name="answerOrder" inputmode="numeric" value="${escapeAttribute(draft.answerOrder)}" placeholder="예: 3214" /></label>
      </fieldset>
      <fieldset class="timeline-editor ${draft.type === "match" ? "" : "hidden"}" id="customMatchFields">
        <legend>좌우 연결 정답</legend>
        <div class="custom-pair-editor">
          ${[0, 1, 2, 3].map((index) => `
            <label>${index + 1}번 왼쪽<input name="pairLeft${index}" value="${escapeAttribute(draft.pairs[index]?.left || "")}" /></label>
            <label>${index + 1}번 오른쪽<input name="pairRight${index}" value="${escapeAttribute(draft.pairs[index]?.right || "")}" /></label>
          `).join("")}
        </div>
      </fieldset>
      <div class="data-status warn hidden" id="customQuizFormError" role="alert"></div>
      <div class="form-actions"><button class="primary" type="submit">저장</button></div>
    </form>
  `;
  const form = target.querySelector("#customQuizForm");
  form.elements.type.addEventListener("change", () => {
    const nextDraft = readCustomQuizForm(form);
    nextDraft.type = form.elements.type.value;
    renderCustomQuizForm(nextDraft, settings);
  });
  form.querySelector("#addCustomQuizImageButton")?.addEventListener("click", () => {
    const nextDraft = readCustomQuizForm(form);
    nextDraft.images.push({ url: "", label: "" });
    renderCustomQuizForm(nextDraft, settings);
  });
  bindCustomQuizImageInputs(form, settings);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const next = readCustomQuizForm(form);
    const validationMessage = customQuizValidationMessage(next);
    if (validationMessage) {
      const errorBox = form.querySelector("#customQuizFormError");
      errorBox.textContent = validationMessage;
      errorBox.classList.remove("hidden");
      return;
    }
    upsert(data.customQuizzes, quiz?.id || next.id, next);
    editorSelectionId = next.id;
    saveData();
    quizCardCache.clear();
    (settings.onSaved || renderCustomQuizEditor)(next);
  });
  target.querySelector("#deleteCustomQuizButton")?.addEventListener("click", () => {
    data.customQuizzes = data.customQuizzes.filter((item) => item.id !== quiz.id);
    if (editorSelectionId === quiz.id) editorSelectionId = "";
    saveData();
    quizCardCache.clear();
    (settings.onDeleted || renderCustomQuizEditor)();
  });
}

function normalizeCustomQuizDraft(quiz = null) {
  const supportedTypes = ["text", "choice", "multiple", "order", "scramble", "match"];
  const type = supportedTypes.includes(quiz?.type) ? quiz.type : "choice";
  const images = (quiz?.images?.length ? quiz.images : [{ url: quiz?.imageUrl || "", label: "" }]).map((image) => ({
    url: image.url || "",
    label: image.label || ""
  }));
  if (!images.length) images.push({ url: "", label: "" });
  const pairs = (quiz?.pairs || []).map((pair) => ({
    left: pair?.left || "",
    right: pair?.right || ""
  }));
  while (pairs.length < 4) pairs.push({ left: "", right: "" });
  return {
    id: quiz?.id || makeId("quiz"),
    type,
    question: quiz?.question || "",
    images: type === "order" ? images.slice(0, 6) : [images[0] || { url: "", label: "" }],
    options: [...(quiz?.options || ["", "", "", ""]), "", "", "", ""].slice(0, 4),
    correctOptionIndex: Number(quiz?.correctOptionIndex || 0),
    correctOptionIndexes: (quiz?.correctOptionIndexes || []).map(Number).filter((index) => index >= 0 && index < 4),
    textAnswer: quiz?.textAnswer || quiz?.answer || "",
    alternativeAnswers: (quiz?.alternativeAnswers || []).map((answer) => String(answer || "").trim()).filter(Boolean),
    answerOrder: quiz?.answerOrder || "",
    orderItems: [...(quiz?.orderItems || ["", "", "", ""]), "", "", "", ""].slice(0, 4),
    pieces: (quiz?.pieces || []).map((piece) => String(piece || "")).filter(Boolean),
    pairs: pairs.slice(0, 4)
  };
}

function renderCustomQuizImageRows(draft) {
  const rows = draft.type === "order" ? draft.images : draft.images.slice(0, 1);
  return rows.map((image, index) => `
    <div class="custom-image-row">
      ${image.url ? `<img class="custom-image-preview" src="${escapeAttribute(image.url)}" alt="" loading="lazy" decoding="async" />` : `<div class="custom-image-preview empty">${index + 1}</div>`}
      <label>이미지 주소<input name="customImageUrl" value="${escapeAttribute(image.url)}" /></label>
      <label class="file-button">파일 선택<input name="customImageFile" type="file" accept="image/*" data-image-index="${index}" /></label>
      <button class="sub-card ${draft.type !== "order" || rows.length <= 1 ? "hidden" : ""}" type="button" data-remove-custom-image="${index}">삭제</button>
    </div>
  `).join("");
}

function bindCustomQuizImageInputs(form, settings = {}) {
  form.querySelectorAll("[data-remove-custom-image]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextDraft = readCustomQuizForm(form);
      nextDraft.images.splice(Number(button.dataset.removeCustomImage), 1);
      renderCustomQuizForm(nextDraft, settings);
    });
  });
  form.querySelectorAll('[name="customImageFile"]').forEach((input) => {
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      const urls = Array.from(form.querySelectorAll('[name="customImageUrl"]'));
      urls[Number(input.dataset.imageIndex)].value = await fileToDataUrl(file);
      renderCustomQuizForm(readCustomQuizForm(form), settings);
    });
  });
}

function readCustomQuizForm(form) {
  const supportedTypes = ["text", "choice", "multiple", "order", "scramble", "match"];
  const selectedType = value(form, "type");
  const type = supportedTypes.includes(selectedType) ? selectedType : "choice";
  const images = Array.from(form.querySelectorAll('[name="customImageUrl"]'))
    .map((input, index) => ({ url: input.value.trim(), label: String(index + 1) }))
    .filter((image, index) => image.url || index === 0);
  const piecesText = value(form, "scramblePieces");
  const pieces = piecesText.includes(",")
    ? piecesText.split(",").map((piece) => piece.trim()).filter(Boolean)
    : Array.from(piecesText.replace(/\s/g, ""));
  return {
    id: value(form, "id") || makeId("quiz"),
    type,
    question: value(form, "question"),
    images: type === "order" ? images.slice(0, 6) : [images[0] || { url: "", label: "1" }],
    options: [0, 1, 2, 3].map((index) => value(form, `option${index}`)),
    correctOptionIndex: Math.min(3, Math.max(0, Number(value(form, "correctOptionIndex") || 1) - 1)),
    correctOptionIndexes: parseQuizIndexList(value(form, "correctOptionIndexes"), 4),
    textAnswer: value(form, "textAnswer"),
    alternativeAnswers: value(form, "alternativeAnswers").split("|").map((answer) => answer.trim()).filter(Boolean),
    answerOrder: value(form, "answerOrder"),
    orderItems: [0, 1, 2, 3].map((index) => value(form, `orderItem${index}`)),
    pieces,
    pairs: [0, 1, 2, 3].map((index) => ({
      left: value(form, `pairLeft${index}`),
      right: value(form, `pairRight${index}`)
    }))
  };
}

function customQuizTypeLabel(type) {
  return {
    text: "주관식",
    choice: "단일 선택",
    multiple: "복수 선택",
    order: "순서 배열",
    scramble: "글자 배열",
    match: "좌우 연결"
  }[type] || "단일 선택";
}

function parseQuizIndexList(valueText, maxCount) {
  return String(valueText || "")
    .split(/[^0-9]+/)
    .map((valueTextPart) => Number(valueTextPart) - 1)
    .filter((index, position, indexes) => index >= 0 && index < maxCount && indexes.indexOf(index) === position);
}

function customQuizValidationMessage(quiz) {
  if (!hasRegisteredText(quiz.question)) return "문제 문장을 입력하세요.";
  const images = (quiz.images || []).filter((image) => hasRegisteredText(image.url));
  if (!images.length) return "문제 이미지를 주소로 입력하거나 파일로 선택하세요.";
  if (quiz.type === "text") {
    return hasRegisteredText(quiz.textAnswer) ? "" : "주관식 정답을 입력하세요.";
  }
  if (quiz.type === "choice" || quiz.type === "multiple") {
    if ((quiz.options || []).filter(hasRegisteredText).length < 2) return "선택지를 두 개 이상 입력하세요.";
    if (quiz.type === "choice" && !hasRegisteredText(quiz.options[quiz.correctOptionIndex])) return "입력된 선택지의 정답 번호를 지정하세요.";
    if (quiz.type === "multiple" && !(quiz.correctOptionIndexes || []).length) return "복수 정답 번호를 하나 이상 입력하세요.";
    return "";
  }
  if (quiz.type === "scramble") {
    if (!hasRegisteredText(quiz.textAnswer)) return "완성될 정답을 입력하세요.";
    return (quiz.pieces || []).length >= 2 ? "" : "글자 조각을 두 개 이상 입력하세요.";
  }
  if (quiz.type === "match") {
    const pairCount = (quiz.pairs || []).filter((pair) => hasRegisteredText(pair.left) && hasRegisteredText(pair.right)).length;
    return pairCount >= 2 ? "" : "좌우 연결 항목을 두 쌍 이상 입력하세요.";
  }
  const orderItems = (quiz.orderItems || []).filter(hasRegisteredText);
  const itemCount = orderItems.length || images.length;
  if (itemCount < 2) return "순서를 정할 항목 또는 이미지를 두 개 이상 입력하세요.";
  const answerOrder = String(quiz.answerOrder || "").replace(/[^1-9]/g, "").split("");
  const uniqueNumbers = new Set(answerOrder);
  return answerOrder.length === itemCount && uniqueNumbers.size === itemCount
    ? ""
    : `1부터 ${itemCount}까지 한 번씩 사용한 정답 순서를 입력하세요.`;
}

function findCustomQuiz(id) {
  return (data.customQuizzes || []).find((quiz) => quiz.id === id);
}

function renderDataManager() {
  const summary = [
    ["인물", data.people.length],
    ["기술", data.techniques.length],
    ["에피소드", data.episodes.length],
    ["열매", data.devilFruits.length],
    ["직접 만든 문제", (data.customQuizzes || []).length],
    ["세부 조직", data.subOrganizations.length],
    ["출신 국가", data.originCountries.length]
  ];
  editorBody.innerHTML = `
    <section class="data-manager">
      <h3>데이터 관리</h3>
      <p>웹에서 저장한 내용은 이 브라우저에 남습니다. JSON으로 내보내면 다른 곳에 옮길 수 있습니다.</p>
      <div class="data-summary">
        ${summary.map(([label, count]) => `<span><b>${escapeHtml(label)}</b>${count.toLocaleString("ko-KR")}개</span>`).join("")}
      </div>
      <div class="data-actions">
        <button class="primary" id="exportButton" type="button">JSON 내보내기</button>
        <label class="file-button">JSON 불러오기<input id="importInput" type="file" accept="application/json" /></label>
        <button class="sub-card" id="previewJsonButton" type="button">JSON 미리보기 생성</button>
        <button class="danger" id="resetButton" type="button">처음 예시로 되돌리기</button>
      </div>
      <textarea id="jsonPreview" rows="16" readonly placeholder="미리보기가 필요할 때만 생성합니다."></textarea>
    </section>
  `;
  document.querySelector("#exportButton").addEventListener("click", exportJson);
  document.querySelector("#importInput").addEventListener("change", importJson);
  document.querySelector("#previewJsonButton").addEventListener("click", () => {
    document.querySelector("#jsonPreview").value = JSON.stringify(data, null, 2);
  });
  document.querySelector("#resetButton").addEventListener("click", () => {
    localStorage.removeItem(PATCH_STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    Object.keys(data).forEach((key) => delete data[key]);
    Object.assign(data, structuredClone(baseData));
    normalizeInPlace(data);
    saveData();
    renderDataManager();
  });
}

function renderEpisodeLinks(episodes, personId = "") {
  return episodes.map((episode) => {
    const label = personId ? appearanceTypeLabel(appearanceTypeForCharacter(episode, personId)) : "";
    const title = [episodeTitleText(episode), label].filter(Boolean).join(" · ");
    return `
    <button class="episode-number-chip" type="button" data-episode-link="${escapeAttribute(episode.id)}" title="${escapeAttribute(title)}">
      <span>${episode.number}</span>${label ? `<span class="mini-chip">${escapeHtml(label)}</span>` : ""}
    </button>
  `;
  }).join("") || `<span class="muted">등록된 화수가 없습니다.</span>`;
}

function syncEpisodeCharacterAppearances(episode, characterIds) {
  const previous = new Map((episode.characterAppearances || []).map((appearance) => [appearance.characterId, appearance]));
  return characterIds.map((characterId) => ({
    characterId,
    appearanceType: previous.get(characterId)?.appearanceType || "main"
  }));
}

function bindEpisodeLinks() {
  detail.querySelectorAll("[data-episode-link]").forEach((button) => {
    button.addEventListener("click", () => navigateToEpisode(button.dataset.episodeLink));
  });
  detail.querySelectorAll("[data-person-link]").forEach((button) => {
    button.addEventListener("click", () => navigateToPerson(button.dataset.personLink));
  });
  detail.querySelectorAll("[data-technique-link]").forEach((button) => {
    button.addEventListener("click", () => navigateToTechnique(button.dataset.techniqueLink));
  });
  detail.querySelectorAll("[data-episode-technique-open]").forEach((button) => {
    button.addEventListener("click", () => {
      activeEpisodeTechniqueEditorId = button.dataset.episodeTechniqueOpen;
      render();
    });
  });
  detail.querySelectorAll("[data-episode-technique-close]").forEach((button) => {
    button.addEventListener("click", () => {
      activeEpisodeTechniqueEditorId = "";
      render();
    });
  });
  detail.querySelectorAll("[data-episode-technique-form]").forEach((form) => {
    const episode = findEpisode(form.dataset.episodeTechniqueForm);
    if (!episode) return;
    if (form.dataset.episodeTechniqueBound === "true") return;
    form.dataset.episodeTechniqueBound = "true";
    bindEpisodeTechniqueEditor(form, episode.characterIds || []);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      saveEpisodeTechniqueAppearances(episode, readEpisodeTechniqueRows(form));
    });
  });
}

function saveEpisodeTechniqueAppearances(episode, techniqueAppearances) {
  syncTechniqueOwnersFromEpisode(techniqueAppearances);
  const characterIds = uniqueExistingPersonIds([
    ...(episode.characterIds || []),
    ...(episode.characterAppearances || []).map((entry) => entry.characterId),
    ...techniqueAppearances.flatMap(episodeTechniqueCharacterIds)
  ]);
  upsert(data.episodes, episode.id, {
    ...episode,
    characterIds,
    characterAppearances: syncEpisodeCharacterAppearances(episode, characterIds),
    techniqueAppearances,
    techniqueIds: techniqueIdsFromAppearanceRows(techniqueAppearances)
  });
  activeEpisodeTechniqueEditorId = "";
  saveData();
  render();
}

function navigateToEpisode(episodeId) {
  const episode = findEpisode(episodeId);
  if (!episode) return;
  currentView = "episodes";
  activeEpisodeTechniqueEditorId = "";
  activePersonPanel = "basic";
  searchInput.value = "";
  activeId = String(episode.volume);
  activeEpisodeId = episode.id;
  activeFruitId = "";
  activeFruitGroupKey = "all";
  activeSubOrgId = "";
  setActiveTab();
  render();
}

function navigateToPerson(personId) {
  currentView = "people";
  activePersonPanel = "basic";
  activeId = personId;
  activeEpisodeId = "";
  activeFruitId = "";
  activeSubOrgId = "";
  setActiveTab();
  render();
}

function navigateToTechnique(techniqueId) {
  const technique = findTechnique(techniqueId);
  if (!technique) return;
  currentView = "techniques";
  activePersonPanel = "basic";
  searchInput.value = "";
  activeId = techniqueId;
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
    nameKo: value(form, "nameKo"),
    aliases: value(form, "aliases"),
    job: value(form, "job"),
    jobCategory: value(form, "job"),
    jobDetail: value(form, "jobDetail"),
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
  const originalName = personOriginalNameText(person);
  return `
    <div class="result person-result">
      ${image}
      <div>
        <strong>${escapeHtml(personDisplayName(person))}</strong>
        ${originalName ? `<small class="person-name-alt">${escapeHtml(originalName)}</small>` : ""}
        <span>${escapeHtml(organizationName(person.organization))} · ${escapeHtml(subOrganizationName(person.subOrganization))} · ${escapeHtml(personJobLabel(person))} · ${person.age}세 · ${currentHeight(person)}cm · ${formatBounty(currentBounty(person))}</span>
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
      <span>${escapeHtml(personDisplayName(person))}</span>
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
  syncActiveNavigation();
  searchInput.value = "";
}

function syncActiveNavigation() {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === currentView));
  mobileNavButtons.forEach((button) => button.classList.toggle("active", button.dataset.mobileNav === currentView));
  mobileViewSelect.value = currentView;
  nameModeSelect.value = nameDisplayMode;
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
        const displayName = personDisplayName(person);
        quizCardCache.get("timeline").push({
          category: "timeline",
          personId: person.id,
          front: `${displayName}: ${content}은 언제?`,
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
        front: `${localizedName(fruit)}의 현재 능력자는?`,
        back: personDisplayName(currentUser),
        acceptedAnswers: personAnswerVariants(currentUser),
        imageUrl: currentUser.imageUrl || ""
      });
    }
  });
  (data.customQuizzes || []).forEach((quiz) => {
    const card = buildCustomQuizCard(quiz);
    if (card) quizCardCache.get("custom").push(card);
  });
  quizCardCache.set("__ready", true);
}

function buildCustomQuizCard(quiz) {
  if (!quiz?.id || !hasRegisteredText(quiz.question)) return null;
  const supportedTypes = ["text", "choice", "multiple", "order", "scramble", "match"];
  const type = supportedTypes.includes(quiz.type) ? quiz.type : "choice";
  const images = (quiz.images || []).filter((image) => hasRegisteredText(image.url));
  const imageUrl = images[0]?.url || "";
  if (!imageUrl) return null;
  if (type === "text") {
    const answer = String(quiz.textAnswer || "").trim();
    if (!answer) return null;
    const alternativeAnswers = (quiz.alternativeAnswers || []).map((item) => String(item || "").trim()).filter(Boolean);
    return {
      category: "custom",
      customType: "text",
      sourceId: quiz.id,
      front: quiz.question,
      back: answer,
      acceptedAnswers: [answer, ...alternativeAnswers],
      imageUrl
    };
  }
  if (type === "choice" || type === "multiple") {
    const options = (quiz.options || []).map((option) => String(option || "").trim()).filter(Boolean);
    if (options.length < 2) return null;
    if (type === "multiple") {
      const correctOptionIndexes = (quiz.correctOptionIndexes || [])
        .map(Number)
        .filter((index, position, indexes) => index >= 0 && index < options.length && indexes.indexOf(index) === position)
        .sort((a, b) => a - b);
      if (!correctOptionIndexes.length) return null;
      return {
        category: "custom",
        customType: "multiple",
        sourceId: quiz.id,
        front: quiz.question,
        back: correctOptionIndexes.map((index) => options[index]).join(", "),
        acceptedAnswers: [correctOptionIndexes.map((index) => index + 1).join("")],
        imageUrl,
        options,
        correctOptionIndexes
      };
    }
    const correctIndex = Number(quiz.correctOptionIndex || 0);
    if (!options[correctIndex]) return null;
    return {
      category: "custom",
      customType: "choice",
      sourceId: quiz.id,
      front: quiz.question,
      back: options[correctIndex],
      acceptedAnswers: [options[correctIndex], String(correctIndex + 1)],
      imageUrl: images[0].url,
      options,
      correctOptionIndex: correctIndex
    };
  }
  if (type === "scramble") {
    const answer = String(quiz.textAnswer || "").trim();
    const pieces = (quiz.pieces || []).map((piece) => String(piece || "")).filter(Boolean);
    if (!answer || pieces.length < 2) return null;
    return {
      category: "custom",
      customType: "scramble",
      sourceId: quiz.id,
      front: quiz.question,
      back: answer,
      acceptedAnswers: [answer, ...(quiz.alternativeAnswers || [])],
      imageUrl,
      pieces
    };
  }
  if (type === "match") {
    const pairs = (quiz.pairs || [])
      .map((pair) => ({ left: String(pair?.left || "").trim(), right: String(pair?.right || "").trim() }))
      .filter((pair) => pair.left && pair.right);
    if (pairs.length < 2) return null;
    const rightOptions = shuffleCards(pairs.map((pair) => pair.right));
    return {
      category: "custom",
      customType: "match",
      sourceId: quiz.id,
      front: quiz.question,
      back: pairs.map((pair) => `${pair.left} → ${pair.right}`).join(", "),
      acceptedAnswers: [],
      imageUrl,
      pairs,
      rightOptions,
      correctRightIndexes: pairs.map((pair) => rightOptions.indexOf(pair.right))
    };
  }
  const orderItems = (quiz.orderItems || []).map((item) => String(item || "").trim()).filter(Boolean);
  const itemCount = orderItems.length || images.length;
  const answerOrder = String(quiz.answerOrder || "")
    .replace(/[^1-9]/g, "")
    .split("")
    .map((digit) => Number(digit))
    .filter((number, index, list) => number >= 1 && number <= itemCount && list.indexOf(number) === index);
  if (itemCount < 2 || answerOrder.length !== itemCount) return null;
  return {
    category: "custom",
    customType: "order",
    sourceId: quiz.id,
    front: quiz.question,
    back: answerOrder.map((number) => orderItems[number - 1] || `이미지 ${number}`).join(" → "),
    acceptedAnswers: [answerOrder.join(""), answerOrder.join("-"), answerOrder.join(",")],
    imageUrl,
    images,
    orderItems,
    answerOrder
  };
}

function buildPersonQuizCard(category, person, fruit) {
  const imageUrl = person.imageUrl || "";
  if (!imageUrl) return null;
  const age = Number(person.age || 0);
  const height = currentHeight(person);
  const bounty = currentBounty(person);
  const origin = registeredOriginLabel(person);
  const organization = registeredOrganizationLabel(person);
  const displayName = personDisplayName(person);
  const definitions = {
    name: imageUrl && hasRegisteredText(displayName) ? {
      front: "이 인물의 이름은?",
      back: displayName,
      acceptedAnswers: personAnswerVariants(person)
    } : null,
    age: age > 0 ? {
      front: `${displayName}의 나이는?`,
      back: `${age}세`,
      acceptedAnswers: [String(age), `${age}세`, `${age}살`],
      numericAnswer: age
    } : null,
    height: height > 0 ? {
      front: `${displayName}의 현재 키는?`,
      back: `${height}cm`,
      acceptedAnswers: [String(height), `${height}cm`, `${height}센티`, `${height}센티미터`],
      numericAnswer: height
    } : null,
    bounty: bounty > 0 ? {
      front: `${displayName}의 현재 현상금은?`,
      back: formatBounty(bounty),
      acceptedAnswers: bountyAnswerVariants(bounty),
      numericAnswer: bounty
    } : null,
    bloodType: hasRegisteredText(person.bloodType) ? {
      front: `${displayName}의 혈액형은?`,
      back: person.bloodType,
      acceptedAnswers: [person.bloodType]
    } : null,
    birthday: hasRegisteredText(person.birthday) ? {
      front: `${displayName}의 생일은?`,
      back: person.birthday,
      acceptedAnswers: birthdayAnswerVariants(person.birthday)
    } : null,
    origin: origin ? {
      front: `${displayName}의 출신지는?`,
      back: origin,
      acceptedAnswers: origin.split("/").map((part) => part.trim()).filter(Boolean).concat(origin)
    } : null,
    alias: hasRegisteredText(person.aliases) ? {
      front: `${displayName}의 별명은?`,
      back: person.aliases,
      acceptedAnswers: [person.aliases]
    } : null,
    likes: hasRegisteredText(person.likes) ? {
      front: `${displayName}이 좋아하는 것은?`,
      back: person.likes,
      acceptedAnswers: [person.likes]
    } : null,
    fruit: fruit?.name ? {
      front: `${displayName}이 먹은 악마의 열매는?`,
      back: localizedName(fruit),
      acceptedAnswers: localizedAnswerVariants(fruit)
    } : null,
    organization: organization ? {
      front: `${displayName}의 소속은?`,
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
    personDisplayName(person),
    `${organizationName(person.organization)} / ${subOrganizationName(person.subOrganization)} / ${personJobLabel(person)}`,
    person,
    `${personNameSearchText(person)} ${person.aliases} ${personJobSearchText(person)} ${person.origin} ${originRegionName(person.originRegion)} ${originCountryName(person.originCountry)} ${person.birthday} ${person.bloodType} ${organizationName(person.organization)} ${subOrganizationName(person.subOrganization)} ${findFruit(person.devilFruitId)?.name || ""}`
  );
}

function groupToItem(group, unit) {
  return item(group.id, group.name, `${group.people.length}${unit}`, group, `${group.name} ${group.people.map(personNameSearchText).join(" ")}`);
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
      if (aMissing && bMissing) return personDisplayName(a).localeCompare(personDisplayName(b), "ko");
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
  return people.sort((a, b) => personDisplayName(a).localeCompare(personDisplayName(b), "ko"));
}

function sortedStatPeople() {
  return [...data.people].sort((a, b) => {
    const aValue = statSortValue(a);
    const bValue = statSortValue(b);
    const aMissing = !Number.isFinite(aValue) || aValue <= 0;
    const bMissing = !Number.isFinite(bValue) || bValue <= 0;
    if (aMissing && bMissing) return personDisplayName(a).localeCompare(personDisplayName(b), "ko");
    if (aMissing) return 1;
    if (bMissing) return -1;
    const difference = statDirection === "desc" ? bValue - aValue : aValue - bValue;
    return difference || personDisplayName(a).localeCompare(personDisplayName(b), "ko");
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
  const sortValue = statSortValue(person);
  if (!Number.isFinite(sortValue) || sortValue <= 0) return "미등록";
  if (statMetric === "height") return `${currentHeight(person)}cm`;
  if (statMetric === "age") return `${person.age}세`;
  if (statMetric === "bounty") return formatBounty(currentBounty(person));
  if (statMetric === "birthday") return person.birthday;
  return "미등록";
}

function buildAppearanceOrderMap() {
  return lookupIndexes.appearanceOrder || new Map();
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

function renderEpisodeTechniqueEditor(draft) {
  const rows = normalizeEpisodeTechniqueAppearances(draft);
  const characterIds = uniqueExistingPersonIds([...(draft.characterIds || []), ...rows.flatMap(episodeTechniqueCharacterIds)]);
  return `
    <fieldset class="check-list episode-technique-editor" id="episodeTechniqueEditor">
      <legend>${escapeHtml(draft.number || "")}화에 나온 기술</legend>
      <p class="picker-empty">사용자를 고르면 그 사용자의 기술만 뜹니다. 합동기술은 함께 사용한 인물을 추가하세요.</p>
      <div class="episode-technique-rows" id="episodeTechniqueRows">
        ${renderEpisodeTechniqueRows(rows, characterIds)}
      </div>
      <button class="episode-technique-add" id="addEpisodeTechniqueRow" type="button">사람 / 기술 추가</button>
    </fieldset>
  `;
}

function renderEpisodeTechniqueRows(rows = [], characterIds = []) {
  return rows.map((row, index) => renderEpisodeTechniqueRow(row, index, characterIds)).join("")
    || `<p class="picker-empty" data-empty-technique-rows>아직 기록한 기술이 없습니다.</p>`;
}

function renderEpisodeTechniqueRow(row = {}, index = 0, characterIds = []) {
  const rowCharacterIds = episodeTechniqueCharacterIds(row);
  const primaryId = row.characterId || rowCharacterIds[0] || "";
  return `
    <div class="episode-technique-row" data-episode-technique-row>
      <span class="episode-technique-row-number">${index + 1}</span>
      <label>사람<select name="techniqueCharacterId" data-technique-character-select>
        ${renderEpisodeTechniqueCharacterOptions(characterIds, primaryId)}
      </select></label>
      <div class="episode-technique-pick">
        <label>기술<select name="episodeTechniqueId" data-technique-select>
          ${renderEpisodeTechniqueOptions(primaryId, row.techniqueId)}
        </select></label>
        <div class="episode-technique-new">
          <input type="text" data-new-technique-name placeholder="새 기술명" />
          <button class="episode-technique-add small" type="button" data-create-episode-technique>기술 추가</button>
        </div>
        <span class="episode-technique-status" data-new-technique-status></span>
      </div>
      <div class="episode-technique-participants">
        <span>합동 인물</span>
        <div class="selected-person-list compact-participants" data-technique-participants>
          ${renderEpisodeTechniqueParticipantChips(rowCharacterIds, primaryId)}
        </div>
        <div class="episode-technique-partner-tools">
          <select data-technique-partner-select>${renderEpisodeTechniquePartnerOptions(characterIds, rowCharacterIds)}</select>
          <button class="episode-technique-add small" type="button" data-add-technique-partner>추가</button>
        </div>
      </div>
      <button class="episode-technique-remove" type="button" data-remove-episode-technique>삭제</button>
    </div>
  `;
}

function renderEpisodeTechniqueCharacterOptions(characterIds = [], selectedId = "") {
  const ids = uniqueExistingPersonIds([...characterIds, selectedId].filter(Boolean));
  return `<option value="">사람 선택</option>${ids.map((id) => {
    const person = findPerson(id);
    return option(id, person ? personDisplayName(person) : id, selectedId);
  }).join("")}`;
}

function renderEpisodeTechniqueOptions(characterId = "", selectedId = "") {
  if (!characterId) return `<option value="">사용자를 먼저 선택</option>`;
  const owned = data.techniques
    .filter((technique) => technique.ownerId === characterId || technique.user === characterId)
    .sort((a, b) => localizedName(a).localeCompare(localizedName(b), "ko"));
  const selectedTechnique = selectedId ? findTechnique(selectedId) : null;
  const list = selectedTechnique && !owned.some((technique) => technique.id === selectedTechnique.id)
    ? [...owned, selectedTechnique]
    : owned;
  if (!list.length) return `<option value="">이 사용자의 등록 기술이 없습니다</option>`;
  return `<option value="">기술 선택</option>${list.map((technique) => {
    const suffix = technique.ownerId === characterId || technique.user === characterId ? "" : " / 다른 사용자 기술";
    return option(technique.id, `${localizedName(technique)}${suffix}`, selectedId);
  }).join("")}`;
}

function renderEpisodeTechniqueParticipantChips(ids = [], primaryId = "") {
  const participantIds = uniqueExistingPersonIds([primaryId, ...ids].filter(Boolean));
  return participantIds.map((id) => {
    const person = findPerson(id);
    const label = id === primaryId ? "사용자" : "삭제";
    const tag = id === primaryId ? "span" : "button";
    const removable = id === primaryId ? "" : ` type="button" data-remove-technique-participant="${escapeAttribute(id)}"`;
    return `
      <${tag} class="selected-person-chip ${id === primaryId ? "locked" : ""}" data-technique-participant="${escapeAttribute(id)}"${removable}>
        ${escapeHtml(person ? personDisplayName(person) : id)} <span>${label}</span>
      </${tag}>
    `;
  }).join("") || `<p class="picker-empty">함께 사용한 인물이 없습니다.</p>`;
}

function renderEpisodeTechniquePartnerOptions(characterIds = [], selectedIds = []) {
  const selected = new Set(selectedIds);
  const ids = uniqueExistingPersonIds(characterIds).filter((id) => !selected.has(id));
  return `<option value="">인물 추가</option>${ids.map((id) => {
    const person = findPerson(id);
    return option(id, person ? personDisplayName(person) : id, "");
  }).join("")}`;
}

function bindEpisodeTechniqueEditor(form, baseCharacterIds = []) {
  const editor = form.querySelector("#episodeTechniqueEditor");
  const rowsWrap = form.querySelector("#episodeTechniqueRows");
  const characterPicker = form.querySelector("#episodeCharacterPicker");
  if (!editor || !rowsWrap) return;
  if (editor.dataset.episodeTechniqueEditorBound === "true") return;
  editor.dataset.episodeTechniqueEditorBound = "true";
  const baseIds = Array.isArray(baseCharacterIds) ? baseCharacterIds : (baseCharacterIds.characterIds || []);

  const currentCharacterIds = () => uniqueExistingPersonIds([
    ...baseIds,
    ...checkedValues(form, "characterIds"),
    ...readEpisodeTechniqueRows(form).flatMap(episodeTechniqueCharacterIds)
  ]);
  const ensureEmptyState = () => {
    if (rowsWrap.querySelector("[data-episode-technique-row]")) return;
    rowsWrap.innerHTML = `<p class="picker-empty" data-empty-technique-rows>아직 기록한 기술이 없습니다.</p>`;
  };
  const refreshRowNumbers = () => {
    rowsWrap.querySelectorAll("[data-episode-technique-row]").forEach((row, index) => {
      row.querySelector(".episode-technique-row-number").textContent = String(index + 1);
    });
    ensureEmptyState();
  };
  const refreshCharacterSelects = () => {
    const ids = currentCharacterIds();
    rowsWrap.querySelectorAll("[data-technique-character-select]").forEach((select) => {
      const selected = select.value;
      select.innerHTML = renderEpisodeTechniqueCharacterOptions(ids, selected);
    });
  };
  const rowParticipantIds = (row) => Array.from(row.querySelectorAll("[data-technique-participant]")).map((chip) => chip.dataset.techniqueParticipant).filter(Boolean);
  const refreshRowParticipants = (row) => {
    const ids = currentCharacterIds();
    const primaryId = row.querySelector("[data-technique-character-select]")?.value || "";
    const selectedIds = uniqueExistingPersonIds([primaryId, ...rowParticipantIds(row)]);
    const participants = row.querySelector("[data-technique-participants]");
    const partnerSelect = row.querySelector("[data-technique-partner-select]");
    if (participants) participants.innerHTML = renderEpisodeTechniqueParticipantChips(selectedIds, primaryId);
    if (partnerSelect) partnerSelect.innerHTML = renderEpisodeTechniquePartnerOptions(ids, selectedIds);
  };
  const addRow = () => {
    rowsWrap.querySelector("[data-empty-technique-rows]")?.remove();
    const ids = currentCharacterIds();
    const characterId = ids[0] || "";
    const index = rowsWrap.querySelectorAll("[data-episode-technique-row]").length;
    rowsWrap.insertAdjacentHTML("beforeend", renderEpisodeTechniqueRow({ characterId, characterIds: characterId ? [characterId] : [], techniqueId: "" }, index, ids));
  };

  editor.querySelector("#addEpisodeTechniqueRow").addEventListener("click", addRow);
  editor.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-episode-technique]");
    const addPartnerButton = event.target.closest("[data-add-technique-partner]");
    const removePartnerButton = event.target.closest("[data-remove-technique-participant]");
    const createTechniqueButton = event.target.closest("[data-create-episode-technique]");
    if (removeButton) {
      removeButton.closest("[data-episode-technique-row]")?.remove();
      refreshRowNumbers();
    }
    if (createTechniqueButton) {
      createEpisodeTechniqueFromRow(createTechniqueButton.closest("[data-episode-technique-row]"), form);
    }
    if (addPartnerButton) {
      const row = addPartnerButton.closest("[data-episode-technique-row]");
      const partnerSelect = row?.querySelector("[data-technique-partner-select]");
      const id = partnerSelect?.value || "";
      if (!id) return;
      const primaryId = row.querySelector("[data-technique-character-select]")?.value || "";
      const selectedIds = uniqueExistingPersonIds([primaryId, ...rowParticipantIds(row), id]);
      row.querySelector("[data-technique-participants]").innerHTML = renderEpisodeTechniqueParticipantChips(selectedIds, primaryId);
      partnerSelect.value = "";
      refreshRowParticipants(row);
    }
    if (removePartnerButton) {
      const row = removePartnerButton.closest("[data-episode-technique-row]");
      removePartnerButton.remove();
      refreshRowParticipants(row);
    }
  });
  editor.addEventListener("change", (event) => {
    const characterSelect = event.target.closest("[data-technique-character-select]");
    if (!characterSelect) return;
    const row = characterSelect.closest("[data-episode-technique-row]");
    const techniqueSelect = row?.querySelector("[data-technique-select]");
    if (techniqueSelect) techniqueSelect.innerHTML = renderEpisodeTechniqueOptions(characterSelect.value, "");
    const participants = row?.querySelector("[data-technique-participants]");
    const partnerSelect = row?.querySelector("[data-technique-partner-select]");
    const ids = characterSelect.value ? [characterSelect.value] : [];
    if (participants) participants.innerHTML = renderEpisodeTechniqueParticipantChips(ids, characterSelect.value);
    if (partnerSelect) partnerSelect.innerHTML = renderEpisodeTechniquePartnerOptions(currentCharacterIds(), ids);
  });
  characterPicker?.addEventListener("click", () => window.setTimeout(refreshCharacterSelects, 0));
}

function createEpisodeTechniqueFromRow(row, form) {
  if (!row) return;
  const characterId = row.querySelector("[data-technique-character-select]")?.value || "";
  const nameInput = row.querySelector("[data-new-technique-name]");
  const techniqueSelect = row.querySelector("[data-technique-select]");
  const status = row.querySelector("[data-new-technique-status]");
  const name = nameInput?.value.trim() || "";
  const setStatus = (message, type = "") => {
    if (!status) return;
    status.textContent = message;
    status.dataset.statusType = type;
  };
  if (!characterId) {
    setStatus("사람을 먼저 선택하세요.", "warn");
    return;
  }
  if (!name) {
    setStatus("새 기술명을 입력하세요.", "warn");
    return;
  }
  const existing = findExistingTechniqueForCharacter(characterId, name);
  const technique = existing || {
    id: makeId("technique"),
    name,
    ownerId: characterId,
    user: characterId,
    target: "",
    chapter: Number(findEpisode(form.dataset.episodeTechniqueForm)?.number || 0),
    location: "",
    orderInStory: data.techniques.length + 1,
    reading: "",
    originalNotation: "",
    note: ""
  };
  if (!existing) {
    data.techniques.push(technique);
    saveData();
  }
  if (techniqueSelect) techniqueSelect.innerHTML = renderEpisodeTechniqueOptions(characterId, technique.id);
  if (nameInput) nameInput.value = "";
  setStatus(existing ? "이미 등록된 기술을 선택했습니다." : "기술 탭에 추가했습니다.", existing ? "info" : "ok");
}

function findExistingTechniqueForCharacter(characterId, name) {
  const normalized = name.trim().toLocaleLowerCase("ko-KR");
  return data.techniques.find((technique) => {
    if (technique.ownerId !== characterId && technique.user !== characterId) return false;
    return [technique.name, technique.nameKo, technique.nameJa, technique.nameEn, technique.originalNotation]
      .filter(hasRegisteredText)
      .some((candidate) => candidate.trim().toLocaleLowerCase("ko-KR") === normalized);
  });
}

function readEpisodeTechniqueRows(form) {
  return Array.from(form.querySelectorAll("[data-episode-technique-row]"))
    .map((row) => {
      const primaryId = row.querySelector("[data-technique-character-select]")?.value || "";
      const characterIds = uniqueExistingPersonIds([
        primaryId,
        ...Array.from(row.querySelectorAll("[data-technique-participant]")).map((chip) => chip.dataset.techniqueParticipant)
      ]);
      return {
        characterId: characterIds[0] || "",
        characterIds,
        techniqueId: row.querySelector("[data-technique-select]")?.value || ""
      };
    })
    .filter((row) => row.characterIds.length && row.techniqueId);
}

function syncTechniqueOwnersFromEpisode(rows = []) {
  rows.forEach((row) => {
    const technique = data.techniques.find((item) => item.id === row.techniqueId);
    const ownerId = row.characterId || row.characterIds?.[0] || "";
    if (!technique || !ownerId) return;
    technique.ownerId = ownerId;
    technique.user = ownerId;
  });
}

function uniquePersonIds(ids = []) {
  return Array.from(new Set(ids.filter(Boolean)));
}

function uniqueExistingPersonIds(ids = []) {
  return Array.from(new Set(ids)).filter((id) => findPerson(id));
}

function renderSelectedCharacterChips(ids = []) {
  return ids.map((id) => {
    const person = findPerson(id);
    return `
      <button class="selected-person-chip" type="button" data-remove-character="${escapeAttribute(id)}">
        ${escapeHtml(person ? personDisplayName(person) : id)} <span>삭제</span>
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
      <strong>${escapeHtml(personDisplayName(person))}</strong>
      <span>${escapeHtml(organizationName(person.organization))} · ${escapeHtml(subOrganizationName(person.subOrganization))} · ${escapeHtml(personJobLabel(person))}</span>
    </button>
  `).join("") || `<p class="picker-empty">검색 결과가 없습니다.</p>`;
}

function checkboxList(name, label, people, selectedIds) {
  return `
    <fieldset class="check-list">
      <legend>${escapeHtml(label)}</legend>
      ${people.map((person) => `
        <label><input type="checkbox" name="${escapeAttribute(name)}" value="${escapeAttribute(person.id)}" ${selectedIds.includes(person.id) ? "checked" : ""} /> ${escapeHtml(personDisplayName(person))}</label>
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

function refreshLookupIndexes() {
  const episodesByPerson = new Map();
  const episodesByTechnique = new Map();
  const techniquesByPerson = new Map();
  const appearanceOrder = new Map();
  const pushToMap = (map, id, value) => {
    if (!id) return;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(value);
  };
  data.episodes.forEach((episode) => {
    const characterIds = new Set([...(episode.characterIds || []), ...(episode.characterAppearances || []).map((entry) => entry.characterId)]);
    characterIds.forEach((id) => {
      if (id && !appearanceOrder.has(id)) appearanceOrder.set(id, Number(episode.number || 0));
    });
    characterIds.forEach((id) => pushToMap(episodesByPerson, id, episode));
    episodeTechniqueIdList(episode).forEach((id) => pushToMap(episodesByTechnique, id, episode));
  });
  episodesByPerson.forEach((episodes) => episodes.sort(sortEpisodes));
  episodesByTechnique.forEach((episodes) => episodes.sort(sortEpisodes));
  data.techniques.forEach((technique) => pushToMap(techniquesByPerson, technique.ownerId, technique));
  techniquesByPerson.forEach((techniques) => techniques.sort((a, b) => localizedName(a).localeCompare(localizedName(b), "ko")));
  lookupIndexes = {
    people: new Map(data.people.map((person) => [person.id, person])),
    techniques: new Map(data.techniques.map((technique) => [technique.id, technique])),
    episodes: new Map(data.episodes.map((episode) => [episode.id, episode])),
    fruits: new Map(data.devilFruits.map((fruit) => [fruit.id, fruit])),
    groups: new Map(data.groups.map((group) => [group.id, group])),
    subOrganizations: new Map(data.subOrganizations.map((sub) => [sub.id, sub])),
    originCountries: new Map(data.originCountries.map((country) => [country.id, country])),
    organizations: new Map(data.organizations.map((org) => [org.id, org])),
    originRegions: new Map(data.originRegions.map((region) => [region.id, region])),
    devilFruitTypes: new Map(data.devilFruitTypes.map((type) => [type.id, type])),
    episodesByPerson,
    episodesByTechnique,
    techniquesByPerson,
    appearanceOrder
  };
}

function blankPerson() {
  return {
    id: makeId("person"),
    name: "",
    nameKo: "",
    aliases: "",
    job: "",
    jobCategory: "",
    jobDetail: "",
    jobEn: "",
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
  return lookupIndexes.people?.get(id);
}

function findTechnique(id) {
  return lookupIndexes.techniques?.get(id);
}

function findEpisode(id) {
  return lookupIndexes.episodes?.get(id);
}

function findFruit(id) {
  return lookupIndexes.fruits?.get(id);
}

function findGroup(id) {
  return lookupIndexes.groups?.get(id);
}

function findSubOrganization(id) {
  return lookupIndexes.subOrganizations?.get(id);
}

function findOriginCountry(id) {
  return lookupIndexes.originCountries?.get(id);
}

function organizationName(id) {
  return lookupIndexes.organizations?.get(id)?.name || "기타";
}

function originRegionName(id) {
  return lookupIndexes.originRegions?.get(id)?.name || "미등록";
}

function originCountryName(id) {
  return lookupIndexes.originCountries?.get(id)?.name || "미등록";
}

function subOrganizationName(id) {
  return lookupIndexes.subOrganizations?.get(id)?.name || "미등록";
}

function devilFruitTypeName(id) {
  return lookupIndexes.devilFruitTypes?.get(id)?.name || "미등록";
}

function zoanSubtypeName(id) {
  return { normal: "일반종", ancient: "고대종", mythical: "환수종", smile: "스마일" }[id] || "미등록";
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
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) return Infinity;
  return monthNumber * 100 + dayNumber;
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
      map.get(year).push({ personName: personDisplayName(person), content: timelineContent(entry) });
    });
  });
  return Array.from(map.entries()).map(([year, events]) => ({ year, events }));
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}`;
}

function nextEpisodeNumber() {
  return Math.max(0, ...data.episodes.map((episode) => Number(episode.number || 0))) + 1;
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
  const blank = (value) => value === undefined || value === null || value === "" || value === 0 || (Array.isArray(value) && value.length === 0);
  const fillFromBase = (merged, saved, base, keys) => {
    keys.forEach((key) => {
      if (blank(saved[key]) && !blank(base[key])) merged[key] = structuredClone(base[key]);
    });
  };
  const mergeBaseList = (savedList = [], baseList = []) => {
    const baseById = new Map(baseList.map((item) => [item.id, item]));
    const merged = savedList.map((item) => ({
      ...structuredClone(baseById.get(item.id) || {}),
      ...item
    }));
    const savedIds = new Set(merged.map((item) => item.id));
    baseList.forEach((item) => {
      if (!savedIds.has(item.id)) {
        merged.push(structuredClone(item));
        savedIds.add(item.id);
      }
    });
    return merged;
  };
  target.people = (target.people || []).map((person) => {
    const basePerson = basePeopleById.get(person.id) || {};
    const merged = {
      aliases: "",
      nameKo: "",
      jobCategory: "",
      jobDetail: "",
      jobEn: "",
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
      ...basePerson,
      ...person
    };
    fillFromBase(merged, person, basePerson, [
      "aliases", "job", "jobCategory", "jobDetail", "jobEn", "age", "birthday",
      "nameKo", "heightCm", "heightHistory", "bounty", "bountyHistory", "bloodType",
      "originRegion", "originCountry", "origin", "description", "wikiTitle", "wikiUrl"
    ]);
    if ((blank(person.organization) || person.organization === "etc") && !blank(basePerson.organization)) merged.organization = basePerson.organization;
    if ((blank(person.subOrganization) || (person.id === "wt100-21" && person.subOrganization === "wt-org-281")) && !blank(basePerson.subOrganization)) {
      merged.subOrganization = basePerson.subOrganization;
    }
    if (person.id === "wt100-21" && /대위/.test(String(person.jobDetail || "")) && !blank(basePerson.jobDetail)) {
      merged.jobDetail = basePerson.jobDetail;
    }
    const savedHaki = person.haki || {};
    const baseHaki = basePerson.haki || {};
    const savedHasHaki = Boolean(savedHaki.armament || savedHaki.observation || savedHaki.conqueror);
    const baseHasHaki = Boolean(baseHaki.armament || baseHaki.observation || baseHaki.conqueror);
    if (!savedHasHaki && baseHasHaki) merged.haki = structuredClone(baseHaki);
    return {
      ...merged,
      heightHistory: merged.heightHistory?.length ? merged.heightHistory : [{ period: "현재", cm: Number(merged.heightCm || 0) }],
      bountyHistory: merged.bountyHistory?.length ? merged.bountyHistory : [{ period: "현재", amount: Number(merged.bounty || 0) }]
    };
  });
  const savedPersonIds = new Set(target.people.map((person) => person.id));
  baseData.people.forEach((person) => {
    if (!savedPersonIds.has(person.id)) {
      target.people.push(structuredClone(person));
      savedPersonIds.add(person.id);
    }
  });
  target.techniques = (target.techniques || []).map((technique, index) => ({
    nameKo: "",
    nameJa: "",
    nameEn: "",
    user: "",
    target: "",
    chapter: 0,
    location: "",
    orderInStory: index + 1,
    reading: "",
    originalNotation: "",
    sourceTitle: "",
    sourceUrl: "",
    note: "",
    ...baseTechniquesById.get(technique.id),
    ...technique
  }));
  const savedTechniqueIds = new Set(target.techniques.map((technique) => technique.id));
  baseData.techniques.forEach((technique) => {
    if (!savedTechniqueIds.has(technique.id)) {
      target.techniques.push(structuredClone(technique));
      savedTechniqueIds.add(technique.id);
    }
  });
  target.episodes = (target.episodes || structuredClone(baseData.episodes) || []).map((episode) => {
    const baseEpisode = baseEpisodesById.get(episode.id) || {};
    const merged = {
      characterIds: [],
      characterAppearances: [],
      techniqueIds: [],
      techniqueAppearances: [],
      summary: "",
      title: "",
      ...baseEpisode,
      ...episode
    };
    const savedTitle = String(episode.title || "");
    if (baseEpisode.titleKo && (!episode.titleKo || savedTitle === baseEpisode.titleEn || /[A-Za-z]/.test(savedTitle))) {
      merged.title = baseEpisode.titleKo;
      merged.titleKo = baseEpisode.titleKo;
    }
    if (!Number(merged.volume)) merged.volume = inferEpisodeVolume(merged.number);
    merged.techniqueAppearances = normalizeEpisodeTechniqueAppearances(merged, target.techniques);
    merged.techniqueIds = techniqueIdsFromAppearanceRows(merged.techniqueAppearances);
    return merged;
  });
  const savedEpisodeIds = new Set(target.episodes.map((episode) => episode.id));
  baseData.episodes.forEach((episode) => {
    if (!savedEpisodeIds.has(episode.id)) {
      target.episodes.push(structuredClone(episode));
      savedEpisodeIds.add(episode.id);
    }
  });
  target.organizations = mergeBaseList(target.organizations, baseData.organizations);
  target.originRegions = mergeBaseList(target.originRegions, baseData.originRegions);
  target.originCountries = mergeBaseList(target.originCountries, baseData.originCountries);
  target.subOrganizations = mergeBaseList(target.subOrganizations, baseData.subOrganizations);
  target.devilFruitTypes = mergeBaseList(target.devilFruitTypes, baseData.devilFruitTypes);
  target.devilFruits = mergeBaseList(target.devilFruits, baseData.devilFruits).map((fruit) => ({
    zoanSubtype: "",
    model: "",
    awakened: false,
    ...baseFruitsById.get(fruit.id),
    ...fruit
  }));
  target.groups = target.groups || structuredClone(baseData.groups);
  target.bloodTypes = target.bloodTypes || structuredClone(baseData.bloodTypes);
  target.customQuizzes = (target.customQuizzes || []).map(normalizeCustomQuizDraft);
  applyCharacterIdentityCorrections(target);
  return target;
}

function applyCharacterIdentityCorrections(target) {
  const ninjinId = "wt100-52";
  const carrotId = "wt100-896";
  const ninjin = (target.people || []).find((person) => person.id === ninjinId);
  const correctedNinjin = basePeopleById.get(ninjinId);
  const hasLegacyCarrotData = ninjin && (
    ninjin.wikiTitle === "Carrot"
    || ninjin.nameKo === "캐럿"
    || ninjin.sourceNameEn === "Carrot"
    || (Number(ninjin.age) === 15 && ninjin.birthday === "5월 24일" && Number(ninjin.heightCm) === 161)
  );
  if (ninjin && correctedNinjin && hasLegacyCarrotData) {
    [
      "name", "nameKo", "nameEn", "sourceNameEn", "aliases", "job", "organization", "age", "birthday",
      "heightCm", "heightHistory", "bloodType", "originRegion", "originCountry", "origin",
      "likes", "description", "wikiTitle", "wikiUrl", "jobEn", "jobCategory", "jobDetail"
    ].forEach((key) => {
      ninjin[key] = structuredClone(correctedNinjin[key]);
    });
    ninjin.sourceSearch = structuredClone(correctedNinjin.sourceSearch);
  }

  const normalizeTitle = (value) => String(value || "").trim().toLowerCase();
  const peerAppearanceType = (episode) => {
    const peer = (episode.characterAppearances || []).find((appearance) => {
      const title = normalizeTitle(appearance.sourceTitle);
      return title === "piiman" || title === "tamanegi";
    });
    return peer?.appearanceType || "main";
  };

  (target.episodes || []).forEach((episode) => {
    const sourceTitles = (episode.sourceCharacterTitles || []).map(normalizeTitle);
    const appearances = (episode.characterAppearances || []).map((appearance) => {
      const title = normalizeTitle(appearance.sourceTitle);
      if (title === "carrot") return { ...appearance, characterId: carrotId };
      if (title === "ninjin") return { ...appearance, characterId: ninjinId };
      return appearance;
    });
    const hasNinjin = sourceTitles.includes("ninjin") || appearances.some((appearance) => normalizeTitle(appearance.sourceTitle) === "ninjin");
    const hasCarrot = sourceTitles.includes("carrot") || appearances.some((appearance) => normalizeTitle(appearance.sourceTitle) === "carrot");
    if (!hasNinjin && !hasCarrot) return;

    if (hasNinjin && !appearances.some((appearance) => appearance.characterId === ninjinId)) {
      appearances.push({
        characterId: ninjinId,
        sourceTitle: "Ninjin",
        appearanceType: peerAppearanceType(episode)
      });
    }

    const deduplicated = [];
    const seenIds = new Set();
    appearances.forEach((appearance) => {
      if (!appearance.characterId || seenIds.has(appearance.characterId)) return;
      seenIds.add(appearance.characterId);
      deduplicated.push(appearance);
    });
    episode.characterAppearances = deduplicated;
    const otherIds = (episode.characterIds || []).filter((id) => id !== ninjinId && id !== carrotId);
    const correctedIds = deduplicated
      .map((appearance) => appearance.characterId)
      .filter((id) => id === ninjinId || id === carrotId);
    episode.characterIds = [...new Set([...otherIds, ...correctedIds])];
  });
}

function loadSavedData() {
  const patch = loadJsonFromStorage(PATCH_STORAGE_KEY);
  if (patch) {
    return applySavedPatch(structuredClone(baseData), patch);
  }

  const legacy = loadJsonFromStorage(STORAGE_KEY) || loadJsonFromStorage(LEGACY_STORAGE_KEY);
  if (legacy) {
    return normalizeInPlace(legacy);
  }

  return null;
}

function loadJsonFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn(`Failed to load saved data from ${key}.`, error);
    return null;
  }
}

function saveData() {
  invalidateDataCaches();
  refreshLookupIndexes();
  persistDataPatch();
}

function persistDataPatch() {
  const patch = createDataPatch(data);
  try {
    if (hasPatchChanges(patch)) {
      localStorage.setItem(PATCH_STORAGE_KEY, JSON.stringify(patch));
    } else {
      localStorage.removeItem(PATCH_STORAGE_KEY);
    }
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return true;
  } catch (error) {
    console.warn("Failed to save local changes.", error);
    showStorageWarning();
    return false;
  }
}

function showStorageWarning() {
  if (storageWarningShown) return;
  storageWarningShown = true;
  alert("브라우저 저장공간이 부족해서 수정 내용을 저장하지 못했습니다. 데이터 관리에서 JSON 내보내기로 백업한 뒤, 사진은 주소(URL) 위주로 쓰면 더 안정적입니다.");
}

function createDataPatch(source) {
  const base = getNormalizedBaseData();
  const lists = {};
  PERSISTED_LIST_KEYS.forEach((key) => {
    lists[key] = createListPatch(source[key] || [], base[key] || []);
  });
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    lists
  };
}

function createListPatch(currentList, baseList) {
  const baseById = new Map(baseList.map((item) => [item.id, item]));
  const currentIds = new Set(currentList.map((item) => item.id));
  const upserts = currentList
    .filter((item) => !stableEqual(item, baseById.get(item.id)))
    .map((item) => structuredClone(item));
  const deletions = baseList
    .filter((item) => !currentIds.has(item.id))
    .map((item) => item.id);
  return { upserts, deletions };
}

function applySavedPatch(target, patch) {
  const lists = patch?.lists || {};
  PERSISTED_LIST_KEYS.forEach((key) => {
    const listPatch = lists[key];
    if (!listPatch) return;
    const deletions = new Set(listPatch.deletions || []);
    const list = (target[key] || []).filter((item) => !deletions.has(item.id));
    (listPatch.upserts || []).forEach((item) => {
      upsert(list, item.id, structuredClone(item));
    });
    target[key] = list;
  });
  return normalizeInPlace(target);
}

function hasPatchChanges(patch) {
  return Object.values(patch.lists || {}).some((listPatch) => (
    (listPatch.upserts || []).length || (listPatch.deletions || []).length
  ));
}

function getNormalizedBaseData() {
  if (!normalizedBaseCache) {
    normalizedBaseCache = normalizeInPlace(structuredClone(baseData));
  }
  return normalizedBaseCache;
}

function stableEqual(a, b) {
  return stableStringify(a) === stableStringify(b);
}

function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort()
    .reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
}

function invalidateDataCaches() {
  quizCardCache.clear();
  listItemCache.clear();
  quizSession = null;
  quizAnswerDraft = "";
  quizStudyFlipped = false;
}

function invalidateNameDisplayCaches() {
  quizCardCache.clear();
  listItemCache.clear();
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
refreshLookupIndexes();
render();
