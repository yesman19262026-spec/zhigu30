const app = document.querySelector("#app");
const dialog = document.querySelector("#lessonDialog");
const dialogContent = document.querySelector("#lessonContent");
const toast = document.querySelector("#toast");

const store = {
  completed: new Set(JSON.parse(localStorage.getItem("zstock-completed") || "[]")),
  attempts: JSON.parse(localStorage.getItem("zstock-attempts") || "{}"),
  currentPage: "today",
  courseFilter: "全部",
  activeLesson: null,
  lessonAnswers: {},
  marketSnapshot: 0,
  liveMarket: null,
  liveMarketState: "idle",
  quoteScenario: 0,
  quoteMode: "learn",
  selectedTerm: null,
  klineFrame: 0,
  klineTimer: null,
  klineDraft: { open: 12.10, high: 12.50, low: 12.00, close: 12.35 },
  klineDraftNote: "修改四个价格后，点击“生成这根 K 线”。",
  financialCase: 0,
  financialFocus: "income",
  financialReveal: false,
  reduceMotion: localStorage.getItem("zstock-reduce-motion") === "true"
};

function persist() {
  localStorage.setItem("zstock-completed", JSON.stringify([...store.completed]));
  localStorage.setItem("zstock-attempts", JSON.stringify(store.attempts));
  localStorage.setItem("zstock-reduce-motion", String(store.reduceMotion));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function sectionHeading(title, subtitle = "", action = "") {
  return `<div class="section-heading"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div>${action}</div>`;
}

function completedPercent() {
  return Math.round((store.completed.size / COURSES.length) * 100);
}

function nextCourse() {
  return COURSES.find(course => !store.completed.has(course.day)) || COURSES[COURSES.length - 1];
}

function glossaryById(id) {
  return GLOSSARY.find(item => item.id === id);
}

function termChip(id) {
  const term = glossaryById(id);
  return term ? `<button class="term-chip" data-open-term="${term.id}">${escapeHtml(term.term)}</button>` : "";
}

// 三家虚构教学公司用于同题对照；数字为简化后的亿元口径，不能用于任何投资判断。
const FINANCIAL_CASES = [
  {
    name: "安禾零售", tag: "稳健经营", context: "收入增长温和，回款稳定；适合练习把利润和现金流一起看。",
    income: { title: "利润表 · 一年赚了什么", rows: [["营业收入", "120"], ["营业成本", "78"], ["毛利", "42"], ["期间费用", "25"], ["归母净利润", "12"]], reading: "收入 120 减去成本 78 后还有 42 的毛利；再扣除期间费用与税费，最终归母净利润为 12。读利润表时要继续追问毛利率和费用率是否持续。" },
    balance: { title: "资产负债表 · 期末有什么与欠什么", rows: [["货币资金", "22"], ["应收账款", "8"], ["存货", "15"], ["有息负债", "18"], ["股东权益", "64"]], reading: "现金、应收和存货都是资产，但变现速度和质量不同。这里的现金 22 高于短期经营周转所需的压力，仍要结合债务期限进一步核验。" },
    cash: { title: "现金流量表 · 钱实际怎样流动", rows: [["经营现金流", "14"], ["投资现金流", "-9"], ["筹资现金流", "-3"], ["期末现金净增加", "2"]], reading: "经营现金流 14 略高于净利润 12，说明当期利润大部分已经回到现金；投资流出 9 代表设备、门店等投入，需要与未来经营能力一起观察。" },
    link: "同一组经营事实：净利润 12 进入股东权益的一部分；经营现金流 14 说明回款较顺畅；投资支出 9 则解释了为何现金净增加只有 2。三张表在讲同一个故事。"
  },
  {
    name: "远航设备", tag: "周期制造", context: "利润改善明显，但应收账款与存货增长更快；适合练习“增长从哪里来”。",
    income: { title: "利润表 · 增长是否可持续", rows: [["营业收入", "96"], ["营业成本", "67"], ["毛利", "29"], ["期间费用", "17"], ["归母净利润", "8"]], reading: "净利润较上一年提升，但只看这一个结果还不够。制造企业需要同时查看产品价格、订单、产能利用率和原材料成本。" },
    balance: { title: "资产负债表 · 增长留下的痕迹", rows: [["货币资金", "7"], ["应收账款", "24"], ["存货", "28"], ["有息负债", "31"], ["股东权益", "42"]], reading: "应收账款和存货占用的资金较多，而现金较少、负债较高。它们是需要继续核验的线索，不等于已得出风险结论。" },
    cash: { title: "现金流量表 · 利润为什么没变成现金", rows: [["经营现金流", "-2"], ["投资现金流", "-6"], ["筹资现金流", "10"], ["期末现金净增加", "2"]], reading: "净利润为 8，但经营现金流为 -2，可能与回款变慢、备货增加有关。筹资现金流为正说明当期现金增加依赖新增融资，下一步应查看债务期限和经营回款。" },
    link: "利润表显示净利润 8；资产负债表中应收与存货占用资金；现金流量表的经营现金流为 -2。将三处放在一起，才能提出“增长质量是否需要核验”的问题。"
  },
  {
    name: "新芽软件", tag: "高增长投入", context: "收入增长快、研发投入高；适合练习区分“亏损”与“现金耗用”。",
    income: { title: "利润表 · 高投入阶段", rows: [["营业收入", "55"], ["营业成本", "18"], ["毛利", "37"], ["研发与销售费用", "45"], ["归母净利润", "-6"]], reading: "毛利空间较高，但研发和获客投入更高，因而出现亏损。亏损本身不自动说明好或坏，关键是收入质量、留存、竞争和现金储备。" },
    balance: { title: "资产负债表 · 还能支撑多久", rows: [["货币资金", "36"], ["应收账款", "11"], ["合同负债", "9"], ["有息负债", "4"], ["股东权益", "48"]], reading: "现金储备较多、债务较低，但仍需要结合现金消耗速度、续费情况和融资能力估算经营缓冲，而不是只看某个估值倍数。" },
    cash: { title: "现金流量表 · 现金消耗速度", rows: [["经营现金流", "-11"], ["投资现金流", "-2"], ["筹资现金流", "24"], ["期末现金净增加", "11"]], reading: "经营现金流为 -11，筹资现金流为 24。学习者应关注未来是否持续需要外部融资，以及融资条件变化会怎样影响经营。" },
    link: "亏损 -6 和经营现金流 -11 提示公司处于投入期；期末现金增加来自筹资。三张表合读的重点是现金跑道与增长质量，而不是给出买卖结论。"
  }
];

function normalizedOhlc() {
  const raw = store.klineDraft;
  const open = Number(raw.open) || 0;
  const close = Number(raw.close) || 0;
  const inputHigh = Number(raw.high) || 0;
  const inputLow = Number(raw.low) || 0;
  const high = Math.max(open, close, inputHigh);
  const low = Math.min(open, close, inputLow);
  return { open, high, low, close, corrected: high !== inputHigh || low !== inputLow };
}

function singleCandleSvg() {
  const { open, high, low, close, corrected } = normalizedOhlc();
  const min = Math.min(low, open, close) - 0.08;
  const max = Math.max(high, open, close) + 0.08;
  const y = value => 18 + (max - value) / (max - min || 1) * 142;
  const up = close >= open;
  const top = Math.min(y(open), y(close));
  const body = Math.max(6, Math.abs(y(open) - y(close)));
  const direction = up ? "阳线：收盘高于开盘" : "阴线：收盘低于开盘";
  const correction = corrected ? "已自动把最高/最低价修正到能包含开盘与收盘的位置。" : "四个价格关系正确。";
  return `<div class="draft-kline-wrap"><svg class="draft-kline-svg" viewBox="0 0 300 200" role="img" aria-label="根据输入开高低收生成的 K 线"><path class="chart-grid" d="M24 38H276M24 100H276M24 162H276"/><line class="draft-wick ${up ? "rise" : "fall"}" x1="150" x2="150" y1="${y(high)}" y2="${y(low)}"/><rect class="draft-body ${up ? "rise" : "fall"}" x="118" y="${top}" width="64" height="${body}" rx="4"/><text x="20" y="${y(high) - 5}">最高 ${high.toFixed(2)}</text><text x="190" y="${y(open) + 4}">开 ${open.toFixed(2)}</text><text x="190" y="${y(close) + 4}">收 ${close.toFixed(2)}</text><text x="20" y="${y(low) + 13}">最低 ${low.toFixed(2)}</text></svg><div class="draft-summary"><strong>${direction}</strong><span>${correction}</span></div></div>`;
}

function renderFinancialTrainer() {
  const sample = FINANCIAL_CASES[store.financialCase];
  const focus = sample[store.financialFocus];
  const tabs = [["income", "利润表"], ["balance", "资产负债表"], ["cash", "现金流量表"], ["link", "三表联读"]];
  const content = store.financialFocus === "link" ? `<p class="statement-reading">${sample.link}</p>` : `<div class="statement-grid">${focus.rows.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong><small>亿元</small></div>`).join("")}</div><p class="statement-reading">${focus.reading}</p>`;
  return `<article class="card lab-card financial-trainer"><div class="lab-title-row"><div><p class="eyebrow">DAY 7–15 · 财报带练</p><h3>三张表不是三组孤立数字</h3></div><span class="status-badge">虚构案例</span></div><p>选择公司，再依次阅读一张表，最后切换到“三表联读”。先描述事实，再提出要核验的问题。</p><div class="scenario-strip">${FINANCIAL_CASES.map((item, index) => `<button class="scenario-chip ${index === store.financialCase ? "active" : ""}" data-financial-case="${index}">${item.name}</button>`).join("")}</div><div class="financial-context"><strong>${sample.name} · ${sample.tag}</strong><span>${sample.context}</span></div><div class="statement-tabs">${tabs.map(([id, label]) => `<button class="${id === store.financialFocus ? "active" : ""}" data-financial-focus="${id}">${label}</button>`).join("")}</div><div class="statement-sheet"><h4>${store.financialFocus === "link" ? "把三个角度连起来" : focus.title}</h4>${content}</div><button class="secondary-button" data-financial-reveal>${store.financialReveal ? "已显示阅读提示" : "核对本页应问什么"}</button>${store.financialReveal ? `<div class="result-box financial-result"><strong>正确的下一步不是下结论</strong><p>${store.financialFocus === "income" ? "追问收入来源、毛利与费用的变化是否持续。" : store.financialFocus === "balance" ? "追问应收、存货、债务的期限与质量，而不是只比较资产总额。" : store.financialFocus === "cash" ? "对照净利润、营运资本变化和资本开支，解释现金流的来源。" : "检查利润、资产负债与现金流是否能够相互解释；若不能，标记为待核验。"}</p></div>` : ""}</article>`;
}

function renderToday() {
  const course = nextCourse();
  const percent = completedPercent();
  app.innerHTML = `
    <section class="hero">
      <p class="hero-kicker">免费 · 公益投教 · 本地教学版</p>
      <h2>先看懂屏幕，再理解市场。</h2>
      <p>每天约25分钟：读概念、看图解、做练习、记录风险边界。</p>
      <div class="progress-line"><span style="width:${percent}%"></span></div>
      <div class="hero-meta"><span>已完成 ${store.completed.size}/30 天</span><span>${percent}%</span></div>
    </section>
    ${sectionHeading("今日课程", `核心学习约 ${course.duration} 分钟`)}
    <article class="card today-card">
      <div class="day-chip"><span><small>DAY</small>${course.day}</span></div>
      <div><p class="eyebrow">${course.module}</p><h3>${course.title}</h3><p>${course.goal}</p><div class="card-actions"><button class="primary-button" data-open-lesson="${course.day}">${store.completed.has(course.day) ? "再次复习" : "开始学习"}</button><button class="secondary-button" data-page-jump="quote">看模拟行情</button></div></div>
    </article>
    ${sectionHeading("三条学习入口", "先学概念，再回到盘面找位置")}
    <div class="quick-grid">
      <button class="card quick-card" data-page-jump="glossary"><span>术</span><strong>术语词典</strong><small>PE、量比、委比、K线</small></button>
      <button class="card quick-card" data-page-jump="quote"><span>盘</span><strong>模拟行情</strong><small>原创证券 App 对照界面</small></button>
      <button class="card quick-card" data-page-jump="labs"><span>图</span><strong>K线实验室</strong><small>逐步播放 OHLC 动画</small></button>
    </div>
    ${sectionHeading("今日风险提醒")}
    <article class="card tip-card"><strong>一个数字只是一条线索</strong><p>无论是委比、量比、PE还是一根K线，都要同时说明口径、时间、证据与失效条件。</p></article>
  `;
}

function renderCourses() {
  const filtered = store.courseFilter === "全部" ? COURSES : COURSES.filter(course => course.module === store.courseFilter);
  app.innerHTML = `
    ${sectionHeading("30天学习地图", "每节包含情境、术语、案例、练习与来源", `<button class="text-button" data-page-jump="glossary">术语词典 ›</button>`)}
    <div class="module-filter">${MODULES.map(module => `<button class="filter-chip ${store.courseFilter === module ? "active" : ""}" data-filter="${module}">${module}</button>`).join("")}</div>
    <div class="course-list">${filtered.map(course => `<article class="card course-card ${store.completed.has(course.day) ? "completed" : ""}" data-open-lesson="${course.day}" tabindex="0"><div class="course-index">${store.completed.has(course.day) ? "✓" : course.day}</div><div><p class="eyebrow">${course.module} · ${course.duration}分钟</p><h3>${course.title}</h3><p>${escapeHtml(course.content.scenario)}</p><div class="mini-term-row">${course.content.terms.map(termChip).join("")}</div></div><span class="course-arrow">›</span></article>`).join("")}</div>
  `;
}

function renderMarket() {
  const snapshot = MARKET_SNAPSHOTS[store.marketSnapshot];
  const [up, flat, down] = snapshot.breadth;
  app.innerHTML = `
    <div class="market-status"><div><span class="status-badge"><span class="status-dot"></span>教学收盘快照 · 非实时</span></div><div class="data-time">${snapshot.date}</div></div>
    ${sectionHeading("市场复盘学习", "市场数据是教学样本，不连接真实行情")}
    <div class="scenario-strip">${MARKET_SNAPSHOTS.map((item, index) => `<button class="scenario-chip ${index === store.marketSnapshot ? "active" : ""}" data-market-snapshot="${index}">${item.date.slice(5, 10)}</button>`).join("")}</div>
    <article class="card market-lesson-card"><p class="eyebrow">${snapshot.source}</p><h3>${snapshot.title}</h3><p>${snapshot.lesson}</p></article>
    ${sectionHeading("核心指数")}
    <div class="index-grid">${snapshot.indices.map(([name, value]) => `<article class="card index-card"><h3>${name}</h3><div class="market-change ${value.startsWith("-") ? "down" : "up"}">${value}</div></article>`).join("")}</div>
    ${sectionHeading("市场宽度", "不要只看一个指数")}
    <article class="card breadth"><div><strong class="up">${up}</strong><span>上涨</span></div><div><strong>${flat}</strong><span>平盘</span></div><div><strong class="down">${down}</strong><span>下跌</span></div></article>
    ${sectionHeading("成交与行业")}
    <article class="card"><div class="market-stat"><span>全市场成交额</span><strong>${snapshot.turnover}</strong></div><div class="sector-list">${snapshot.sectors.map(([name, value]) => `<div class="sector-row ${value.startsWith("-") ? "negative" : ""}"><span>${name}</span><span class="sector-track"><i></i></span><strong class="${value.startsWith("-") ? "down" : "up"}">${value}</strong></div>`).join("")}</div></article>
    <div class="notice">仅用于学习“指数、宽度、成交、行业”之间的关系。请勿将教学快照当作实时行情或买卖依据。</div>
    ${renderLiveMarketPanel()}
    <div class="card-actions"><button class="primary-button" data-page-jump="quote">进入模拟证券 App</button></div>
  `;
}

function renderLiveMarketPanel() {
  if (store.liveMarketState === "loading") return `<article class="card live-market-card"><p class="eyebrow">AKShare 定时行情快照</p><h3>正在读取最近一次真实市场数据…</h3><p>正在核验数据来源、时间戳与快照状态。</p></article>`;
  if (store.liveMarket?.mode === "akshare") {
    const data = store.liveMarket;
    const breadth = data.breadth || {};
    const amount = data.turnover?.amount_billion;
    const turnover = Number.isFinite(Number(amount)) && amount !== null ? `${Number(amount).toLocaleString("zh-CN")} 亿` : "--";
    return `<article class="card live-market-card"><div class="live-header"><div><p class="eyebrow">AKShare 定时行情快照 · ${escapeHtml(data.freshness || "延时数据")}</p><h3>真实市场概览</h3></div><button class="text-button" data-refresh-live>重新读取</button></div><p class="data-time">数据时间：${escapeHtml(data.data_time || "--")} · 来源：${escapeHtml(data.source || "AKShare")}</p><div class="index-grid">${(data.indices || []).slice(0, 3).map(index => `<div class="live-index"><span>${escapeHtml(index.name)}</span><strong>${Number(index.last).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><b class="${Number(index.change_pct) < 0 ? "down" : "up"}">${Number(index.change_pct) >= 0 ? "+" : ""}${Number(index.change_pct).toFixed(2)}%</b></div>`).join("")}</div><div class="live-breadth"><span>上涨 <b class="up">${breadth.up_count ?? "--"}</b></span><span>平盘 ${breadth.flat_count ?? "--"}</span><span>下跌 <b class="down">${breadth.down_count ?? "--"}</b></span><span>成交额 ${turnover}</span></div><p class="data-time">${escapeHtml(data.service_notice || "每约30分钟更新一次；仅用于投教与市场观察，不构成买卖建议。")}</p></article>`;
  }
  const message = store.liveMarketState === "unavailable" ? "定时快照暂未生成或暂不可读取，当前继续展示教学快照。" : "首次发布后，GitHub Actions 会自动写入免费的 AKShare 市场快照。";
  return `<article class="card live-market-card"><div class="live-header"><div><p class="eyebrow">AKShare 定时行情快照</p><h3>真实市场概览</h3></div><span class="status-badge">${store.liveMarketState === "unavailable" ? "暂不可用" : "等待首次快照"}</span></div><p>${message}</p><button class="secondary-button" data-refresh-live>${store.liveMarketState === "unavailable" ? "重新读取" : "读取最新快照"}</button><p class="data-time">快照约每30分钟更新，GitHub 的排程可能延后；教学快照不受服务状态影响。</p></article>`;
}

async function loadLiveMarket() {
  store.liveMarketState = "loading";
  renderMarket();
  try {
    const configured = String(window.MARKET_API_URL || "").trim().replace(/\/$/, "");
    const endpoint = configured ? `${configured}/api/market` : "./data/live-market.json";
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    const type = response.headers.get("content-type") || "";
    if (!response.ok || !type.includes("application/json")) throw new Error("market response unavailable");
    const data = await response.json();
    if (data.mode !== "akshare") throw new Error("live provider not configured");
    store.liveMarket = data;
    store.liveMarketState = "ready";
  } catch (_) {
    store.liveMarket = null;
    store.liveMarketState = "unavailable";
  }
  if (store.currentPage === "market") renderMarket();
}

function polyline(points, width = 332, height = 112) {
  const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
  return points.map((point, index) => `${16 + index * ((width - 32) / Math.max(points.length - 1, 1))},${height - 16 - ((point - min) / span) * (height - 32)}`).join(" ");
}

function intradaySvg(scenario) {
  const line = polyline(scenario.points);
  const volumes = scenario.volume.map((value, index) => `<rect x="${18 + index * 42}" y="${175 - value}" width="22" height="${value}" rx="2" />`).join("");
  return `<svg class="intraday-svg" viewBox="0 0 332 188" role="img" aria-label="虚构分时图与成交量"><path class="chart-grid" d="M16 30H316M16 72H316M16 114H316M16 156H316"/><polyline class="price-line" points="${line}"/><path class="avg-line" d="M16 88 C86 80 150 96 220 84 S286 88 316 76"/>${volumes}<text x="16" y="184">09:30</text><text x="151" y="184">11:30</text><text x="280" y="184">15:00</text></svg>`;
}

function candleSvg(frame = 4, compact = false) {
  const candles = [[36,12.10,12.42,12.04,12.31],[82,12.31,12.54,12.24,12.48],[128,12.48,12.52,12.25,12.30],[174,12.30,12.38,12.13,12.21],[220,12.21,12.43,12.18,12.36]];
  const min = 12.0, max = 12.6, height = compact ? 150 : 188;
  const y = price => 14 + (max - price) / (max - min) * (height - 42);
  return `<svg class="kline-svg ${store.reduceMotion ? "motion-off" : ""}" viewBox="0 0 292 ${height}" role="img" aria-label="K线教学图"><path class="chart-grid" d="M12 32H280M12 ${height / 2}H280M12 ${height - 30}H280"/>${candles.map(([x, open, high, low, close], index) => { const visible = index < frame; const up = close >= open; const top = Math.min(y(open), y(close)); const body = Math.max(5, Math.abs(y(open) - y(close))); return `<g class="candle ${visible ? "shown" : ""} ${up ? "rise" : "fall"}" style="--delay:${index * 120}ms"><line x1="${x}" x2="${x}" y1="${y(high)}" y2="${y(low)}"/><rect x="${x - 10}" y="${top}" width="20" height="${body}" rx="2"/><rect class="volume-bar" x="${x - 10}" y="${height - 28 - (index + 2) * 5}" width="20" height="${(index + 2) * 5}" rx="2"/></g>`; }).join("")}<text x="12" y="${height - 4}">开高低收 · 成交量</text></svg>`;
}

function quoteMetric(label, value, termId, tone = "") {
  return `<button class="quote-metric ${tone}" data-open-term="${termId}"><small>${label}</small><strong>${value}</strong><span>学习说明 ›</span></button>`;
}

function renderQuote() {
  const scenario = QUOTE_SCENARIOS[store.quoteScenario];
  const learn = store.quoteMode === "learn";
  app.innerHTML = `
    <div class="quote-topbar"><button class="back-button" data-page-jump="market">‹ 市场复盘</button><span class="status-badge">原创教学盘面</span></div>
    ${sectionHeading("模拟行情", "虚构公司 · 不提供交易与荐股")}
    <div class="mode-switch"><button data-quote-mode="learn" class="${learn ? "active" : ""}">学习模式</button><button data-quote-mode="screen" class="${!learn ? "active" : ""}">盘面模式</button></div>
    <div class="scenario-strip">${QUOTE_SCENARIOS.map((item, index) => `<button class="scenario-chip ${index === store.quoteScenario ? "active" : ""}" data-quote-scenario="${index}">${item.label}</button>`).join("")}</div>
    <article class="quote-shell">
      <div class="quote-header"><div><p>星云制造 · 6000X1</p><small>${scenario.state}</small></div><div class="quote-price"><strong>${scenario.price}</strong><span class="${String(scenario.change).startsWith("-") ? "down" : "up"}">${scenario.change}</span></div></div>
      <div class="quote-tabs"><span class="active">分时</span><span>K线</span><span>资讯</span><span>财务</span></div>
      ${intradaySvg(scenario)}
      <div class="quote-subtitle">日内模拟数据</div>
      <div class="quote-grid">${quoteMetric("量比", scenario.volumeRatio, "volume-ratio")}${quoteMetric("换手率", scenario.turnover, "turnover")}${quoteMetric("委比", scenario.orderRatio === "--" ? "--" : `${scenario.orderRatio}%`, "order-ratio", scenario.orderRatio < 0 ? "negative" : "")}${quoteMetric("委差", scenario.orderDiff === "--" ? "--" : `${scenario.orderDiff}手`, "order-difference", scenario.orderDiff < 0 ? "negative" : "")}</div>
      <div class="quote-book"><div class="book-title"><span>五档盘口</span>${learn ? `<button class="text-button" data-open-term="order-book">这是什么？</button>` : ""}</div>${scenario.book.map(([side, price, amount]) => `<div class="book-row ${side.startsWith("买") ? "buy" : "sell"}"><span>${side}</span><b>${price}</b><small>${amount}</small></div>`).join("")}</div>
      <div class="quote-valuation">${quoteMetric("PE (TTM)", `${scenario.pe}倍`, "pe")}${quoteMetric("PB", `${scenario.pb}倍`, "pb")}${quoteMetric("总市值", scenario.marketCap, "market-cap")}${quoteMetric("分时图", "查看说明", "intraday")}</div>
      <div class="quote-kline"><div><strong>K线预览</strong>${learn ? `<button class="text-button" data-page-jump="labs">学习K线 ›</button>` : ""}</div>${candleSvg(5, true)}</div>
      <div class="quote-note">${scenario.note}</div>
    </article>
    ${learn ? `<article class="card learn-banner"><strong>怎么用这个界面学习？</strong><p>点选量比、委比、盘口、PE/PB等字段，先确认定义与口径，再看它在当前情境中只能说明什么。</p></article>` : ""}
  `;
}

function renderLabs() {
  const frameLabel = ["开盘价出现", "最高与最低形成影线", "收盘价决定实体方向", "成交量柱记录活跃度", "结合位置与后续确认"][store.klineFrame] || "完成一根K线";
  app.innerHTML = `
    ${sectionHeading("互动训练场", "把概念变成一次可完成的观察；所有数据均为虚构教学案例")}
    <div class="lab-grid">
      ${renderFinancialTrainer()}
      <article class="card lab-card kline-lab"><div class="lab-title-row"><div><p class="eyebrow">DAY 16–21 · K线带练</p><h3>K线是怎样形成的</h3></div><button class="text-button" data-toggle-motion>${store.reduceMotion ? "开启动效" : "减少动效"}</button></div><p>先播放形成过程，再用下一张卡片亲手输入开、高、低、收。K 线只记录价格事实，不提供买卖结论。</p>${candleSvg(Math.max(1, store.klineFrame + 1))}<div class="frame-label">第 ${store.klineFrame + 1} 步：${frameLabel}</div><div class="card-actions"><button class="secondary-button" data-kline-step>下一步</button><button class="primary-button" data-kline-play>${store.klineTimer ? "暂停" : "播放"}</button><button class="text-button" data-kline-reset>重播</button></div></article>
      <article class="card lab-card kline-builder"><h3>自己生成一根 K 线</h3><p>输入任意一组教学价格。系统会检查最高价、最低价是否能包含开盘与收盘。</p><div class="ohlc-fields"><div class="field"><label for="draftOpen">开盘 O</label><input id="draftOpen" type="number" step="0.01" value="${store.klineDraft.open}"></div><div class="field"><label for="draftHigh">最高 H</label><input id="draftHigh" type="number" step="0.01" value="${store.klineDraft.high}"></div><div class="field"><label for="draftLow">最低 L</label><input id="draftLow" type="number" step="0.01" value="${store.klineDraft.low}"></div><div class="field"><label for="draftClose">收盘 C</label><input id="draftClose" type="number" step="0.01" value="${store.klineDraft.close}"></div></div><div class="card-actions"><button class="primary-button" data-update-draft-kline>生成这根 K 线</button></div>${singleCandleSvg()}<p class="data-time">${store.klineDraftNote}</p></article>
      <article class="card lab-card"><h3>同一根长下影线</h3><p>位置、趋势、量能和后续确认共同决定解释。</p><div class="check-list"><button class="check-item secondary-button" data-kline-context="下跌末端">下跌末端</button><button class="check-item secondary-button" data-kline-context="上涨末端">上涨末端</button><button class="check-item secondary-button" data-kline-context="震荡区间">震荡区间</button></div><div id="klineFeedback" class="result-box">选择一个位置，比较还需要哪些证据。</div></article>
      <article class="card lab-card"><h3>估值情景器</h3><p>用盈利与估值倍数做教学演算，不输出目标价。</p><div class="field-row"><div class="field"><label for="earnings">假设盈利（亿元）</label><input id="earnings" type="number" value="10" min="0" step="0.1"></div><div class="field"><label for="pe">假设PE（倍）</label><input id="pe" type="number" value="15" min="0" step="0.1"></div></div><div class="result-box">情景市值约 <strong id="valuationResult">150.0亿元</strong><div class="data-time">${termChip("pe")} 只是一种估值表达</div></div></article>
      <article class="card lab-card"><h3>财报红旗练习</h3><p>勾选需要继续核验的线索，而不是给企业下结论。</p><div class="check-list">${["净利润增长，但经营现金流连续下降", "应收账款增速显著高于收入", "短期借款高，而可用现金很少", "审计机构频繁更换"].map((item, index) => `<label class="check-item"><input type="checkbox" class="risk-check" value="${index}"><span>${item}</span></label>`).join("")}</div><div class="result-box">已发现 <strong id="riskCount">0</strong> 个核验线索</div></article>
    </div>
  `;
}

function renderGlossary() {
  const selected = store.selectedTerm ? glossaryById(store.selectedTerm) : null;
  app.innerHTML = `
    <div class="quote-topbar"><button class="back-button" data-page-jump="courses">‹ 课程地图</button><span class="status-badge">基础术语</span></div>
    ${sectionHeading("证券术语词典", "点开每个词，理解定义、公式、位置与风险")}
    <div class="glossary-search"><input id="glossarySearch" placeholder="搜索：市盈率、量比、委比、K线…" value=""><span>⌕</span></div>
    <div id="glossaryList" class="glossary-list">${glossaryCards(GLOSSARY)}</div>
    ${selected ? `<div class="notice">已选择：${selected.term}</div>` : ""}
  `;
}

function glossaryCards(items) {
  return items.map(item => `<article class="card glossary-card" data-open-term="${item.id}"><div><p class="eyebrow">Day ${item.lesson} · ${item.location}</p><h3>${item.term}</h3><p>${item.short}</p></div><span>›</span></article>`).join("");
}

function renderProfile() {
  const modules = MODULES.filter(item => item !== "全部");
  app.innerHTML = `
    <article class="card profile-hero"><div class="avatar">知</div><h2>我的学习档案</h2><p>进度只保存在当前设备，不要求登录。</p></article>
    ${sectionHeading("能力进度", "完成课程后逐步点亮")}
    <article class="card ability-list">${modules.map(module => { const courses = COURSES.filter(item => item.module === module); const done = courses.filter(item => store.completed.has(item.day)).length; const value = Math.round(done / courses.length * 100); return `<div class="ability-row"><span>${module}</span><div class="ability-track"><span style="width:${value}%"></span></div><strong>${value}%</strong></div>`; }).join("")}</article>
    ${sectionHeading("产品原则")}
    <article class="card"><div class="check-list"><div class="check-item">永久免费，不设置课程付费或会员等级</div><div class="check-item">只做投资者教育，不荐股、不承诺收益</div><div class="check-item">模拟行情和市场快照均为教学数据</div><div class="check-item">课程标注来源、版本与复核日期</div></div></article>
    <div class="card-actions" style="margin-top:14px"><button class="secondary-button" id="resetProgress">重置学习进度</button></div>
  `;
}

function render() {
  document.querySelectorAll(".tab-item").forEach(button => {
    const active = button.dataset.page === store.currentPage;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
  });
  if (store.currentPage === "today") renderToday();
  if (store.currentPage === "courses") renderCourses();
  if (store.currentPage === "market") renderMarket();
  if (store.currentPage === "quote") renderQuote();
  if (store.currentPage === "labs") renderLabs();
  if (store.currentPage === "glossary") renderGlossary();
  if (store.currentPage === "profile") renderProfile();
  window.scrollTo({ top: 0, behavior: store.reduceMotion ? "auto" : "smooth" });
}

function goToPage(page) {
  stopKlineAnimation();
  store.currentPage = page;
  history.replaceState(null, "", `#${page}`);
  render();
}

function openTerm(id) {
  const term = glossaryById(id);
  if (!term) return;
  store.selectedTerm = id;
  dialogContent.innerHTML = `<article class="lesson-body term-detail"><p class="lesson-number">术语词典 · Day ${term.lesson}</p><h2>${term.term}</h2><p class="lesson-goal">${term.short}</p><section class="lesson-section"><h3>公式或构成</h3><p>${term.formula}</p></section><section class="lesson-section"><h3>在模拟证券 App 的位置</h3><p>${term.location}</p></section><section class="lesson-section"><h3>例子</h3><p>${term.example}</p></section><section class="lesson-section"><h3>常见误解</h3><div class="risk-box">${term.myth}</div></section><section class="lesson-section"><h3>风险提醒</h3><p>${term.risk}</p><div class="mini-term-row">${term.related.map(name => `<span class="term-chip static">${name}</span>`).join("")}</div></section><div class="card-actions"><button class="primary-button" data-page-jump="quote">在模拟盘面中查找</button></div></article>`;
  dialog.showModal();
}

function openLesson(day) {
  const course = COURSES.find(item => item.day === Number(day));
  if (!course) return;
  store.activeLesson = course;
  store.lessonAnswers = {};
  const guide = course.content.guide;
  const labLabel = course.module === "基本面" ? "去财报训练" : course.module === "技术面" ? "去 K线训练" : "去互动训练场";
  dialogContent.innerHTML = `
    <article class="lesson-body"><p class="lesson-number">DAY ${course.day} · ${course.module} · 核心约 ${course.duration} 分钟</p><h2>${course.title}</h2><p class="lesson-goal">${course.goal}</p>
    <section class="lesson-section"><h3>先判断</h3><p>${course.content.scenario}</p></section>
    <section class="lesson-section guided-reading"><h3>${guide?.title || "先把概念讲清楚"}</h3>${(guide?.explain || course.points).map((paragraph, index) => `<div class="guided-step"><b>第 ${index + 1} 步</b><p>${paragraph}</p></div>`).join("")}</section>
    <section class="lesson-section"><h3>本课要建立的三个连接</h3>${course.points.map((point, index) => `<div class="concept-row"><b>${index + 1}</b><p>${point}</p></div>`).join("")}</section>
    <section class="lesson-section"><h3>术语预习</h3><div class="mini-term-row">${course.content.terms.length ? course.content.terms.map(termChip).join("") : `<span class="data-time">本课以框架和案例训练为主</span>`}</div></section>
    <section class="lesson-section"><h3>案例拆解</h3><p>${guide?.case || course.content.caseStudy}</p><div class="notice">把“数据事实”“可能解释”“还要核验什么”写在三列中，避免把故事直接当结论。</div></section>
    <section class="lesson-section"><h3>拓展理解</h3><p>${course.content.deepDive}</p></section>
    ${course.content.lens ? `<section class="lesson-section investor-lens"><p class="eyebrow">思想镜头 · 非操作指令</p><h3>${course.content.lens.title}</h3><p>${course.content.lens.idea}</p><div class="lens-boundary"><strong>适用边界</strong><span>${course.content.lens.boundary}</span></div><small>延伸阅读：${course.content.lens.source}（概念转述，未摘录原文）</small></section>` : ""}
    <section class="lesson-section"><h3>风险与误区</h3><div class="risk-box">${course.risk}</div></section>
    <section class="lesson-section"><h3>动手任务</h3><p>${guide?.task || course.content.practice}</p><div class="card-actions"><button class="secondary-button" data-page-jump="labs">${labLabel}</button></div></section>
    <section class="lesson-section"><h3>完成本课练习</h3><p class="data-time">依次练基础理解、情境应用与证据辨析；每题都对应当天案例。</p>${course.checks.map((check, qIndex) => `<div class="check-card"><em class="question-kind">${check.kind || "应用练习"}</em><strong>${qIndex + 1}. ${check.q}</strong><div class="quiz-options">${check.options.map((option, optionIndex) => `<button class="quiz-option" data-lesson-answer="${qIndex}:${optionIndex}">${String.fromCharCode(65 + optionIndex)}. ${option}</button>`).join("")}</div><div class="quiz-feedback" data-feedback="${qIndex}"></div></div>`).join("")}<button class="primary-button" data-check-lesson="${course.day}">查看练习反馈</button></section>
    <section class="lesson-section source-box"><h3>来源与版本</h3><p>${course.content.source}</p><small>内容版本：本地教学版 · 复核：${course.content.reviewed}。规则和市场制度上线前须按最新原文复核。</small></section>
    <div class="card-actions"><button class="primary-button" data-complete-lesson="${course.day}">${store.completed.has(course.day) ? "已完成 · 再次确认" : "完成本课"}</button><button class="secondary-button" data-page-jump="quote">回到模拟盘面</button></div>
    </article>`;
  dialog.showModal();
}

function checkLesson() {
  const course = store.activeLesson;
  let answered = 0;
  course.checks.forEach((check, index) => {
    const selected = store.lessonAnswers[index];
    const feedback = dialog.querySelector(`[data-feedback="${index}"]`);
    if (selected === undefined) {
      feedback.className = "quiz-feedback show wrong";
      feedback.textContent = "请先选择一个答案。";
      return;
    }
    answered += 1;
    const correct = selected === check.answer;
    feedback.className = `quiz-feedback show ${correct ? "correct" : "wrong"}`;
    feedback.textContent = `${correct ? "判断正确。" : "再想一步。"}${check.explain}`;
  });
  store.attempts[course.day] = { answered, total: course.checks.length, at: Date.now() };
  persist();
  if (answered === course.checks.length) showToast("已完成本课练习，查看每条解释");
}

function stopKlineAnimation() {
  if (store.klineTimer) clearInterval(store.klineTimer);
  store.klineTimer = null;
}

function toggleKlineAnimation() {
  if (store.klineTimer) {
    stopKlineAnimation();
    renderLabs();
    return;
  }
  store.klineTimer = setInterval(() => {
    store.klineFrame = (store.klineFrame + 1) % 5;
    if (store.currentPage === "labs") renderLabs();
  }, store.reduceMotion ? 1300 : 800);
  renderLabs();
}

app.addEventListener("click", event => {
  const lessonTarget = event.target.closest("[data-open-lesson]");
  if (lessonTarget) return openLesson(lessonTarget.dataset.openLesson);
  const termTarget = event.target.closest("[data-open-term]");
  if (termTarget) return openTerm(termTarget.dataset.openTerm);
  const pageTarget = event.target.closest("[data-page-jump]");
  if (pageTarget) return goToPage(pageTarget.dataset.pageJump);
  const filterTarget = event.target.closest("[data-filter]");
  if (filterTarget) { store.courseFilter = filterTarget.dataset.filter; return renderCourses(); }
  const snapshotTarget = event.target.closest("[data-market-snapshot]");
  if (snapshotTarget) { store.marketSnapshot = Number(snapshotTarget.dataset.marketSnapshot); return renderMarket(); }
  if (event.target.closest("[data-refresh-live]")) return loadLiveMarket();
  const quoteTarget = event.target.closest("[data-quote-scenario]");
  if (quoteTarget) { store.quoteScenario = Number(quoteTarget.dataset.quoteScenario); return renderQuote(); }
  const modeTarget = event.target.closest("[data-quote-mode]");
  if (modeTarget) { store.quoteMode = modeTarget.dataset.quoteMode; return renderQuote(); }
  const financialCase = event.target.closest("[data-financial-case]");
  if (financialCase) { store.financialCase = Number(financialCase.dataset.financialCase); store.financialReveal = false; return renderLabs(); }
  const financialFocus = event.target.closest("[data-financial-focus]");
  if (financialFocus) { store.financialFocus = financialFocus.dataset.financialFocus; store.financialReveal = false; return renderLabs(); }
  if (event.target.closest("[data-financial-reveal]")) { store.financialReveal = true; return renderLabs(); }
  if (event.target.closest("[data-update-draft-kline]")) {
    store.klineDraft = {
      open: document.querySelector("#draftOpen").value,
      high: document.querySelector("#draftHigh").value,
      low: document.querySelector("#draftLow").value,
      close: document.querySelector("#draftClose").value
    };
    const value = normalizedOhlc();
    store.klineDraftNote = value.corrected ? "输入的最高/最低价不能包含开盘或收盘；系统已校正图形。请回头检查 OHLC 的基本关系。" : "四个价格关系成立：最高价 ≥ 开盘/收盘 ≥ 最低价。现在请描述实体与影线，而不是预测下一根。";
    return renderLabs();
  }
  if (event.target.closest("[data-kline-step]")) { store.klineFrame = (store.klineFrame + 1) % 5; return renderLabs(); }
  if (event.target.closest("[data-kline-play]")) return toggleKlineAnimation();
  if (event.target.closest("[data-kline-reset]")) { stopKlineAnimation(); store.klineFrame = 0; return renderLabs(); }
  if (event.target.closest("[data-toggle-motion]")) { store.reduceMotion = !store.reduceMotion; persist(); return renderLabs(); }
  const context = event.target.closest("[data-kline-context]");
  if (context) {
    const messages = { "下跌末端": "需要观察是否出现承接、量能变化和后续是否收复关键位置；一根K线不能确认反转。", "上涨末端": "长下影可能反映波动加大；还要观察高位成交、后续低点和基本面证据。", "震荡区间": "更可能是区间内试探与回收；先定义区间边界和失效条件。" };
    document.querySelector("#klineFeedback").textContent = messages[context.dataset.klineContext];
  }
  if (event.target.id === "resetProgress") {
    if (confirm("确定重置本机的全部学习进度吗？")) { store.completed.clear(); store.attempts = {}; persist(); render(); showToast("学习进度已重置"); }
  }
});

app.addEventListener("input", event => {
  if (["earnings", "pe"].includes(event.target.id)) {
    const earnings = Number(document.querySelector("#earnings").value) || 0;
    const pe = Number(document.querySelector("#pe").value) || 0;
    document.querySelector("#valuationResult").textContent = `${(earnings * pe).toLocaleString("zh-CN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}亿元`;
  }
  if (event.target.classList.contains("risk-check")) document.querySelector("#riskCount").textContent = document.querySelectorAll(".risk-check:checked").length;
  if (event.target.id === "glossarySearch") {
    const keyword = event.target.value.trim().toLowerCase();
    const list = GLOSSARY.filter(item => `${item.term} ${item.short} ${item.related.join(" ")}`.toLowerCase().includes(keyword));
    document.querySelector("#glossaryList").innerHTML = glossaryCards(list);
  }
});

dialog.addEventListener("click", event => {
  if (event.target.classList.contains("dialog-close")) return dialog.close();
  const termTarget = event.target.closest("[data-open-term]");
  if (termTarget) return openTerm(termTarget.dataset.openTerm);
  const pageTarget = event.target.closest("[data-page-jump]");
  if (pageTarget) { dialog.close(); return goToPage(pageTarget.dataset.pageJump); }
  const answer = event.target.closest("[data-lesson-answer]");
  if (answer) {
    const [question, option] = answer.dataset.lessonAnswer.split(":").map(Number);
    store.lessonAnswers[question] = option;
    dialog.querySelectorAll(`[data-lesson-answer^="${question}:"]`).forEach(button => button.classList.toggle("selected", button === answer));
    return;
  }
  if (event.target.closest("[data-check-lesson]")) return checkLesson();
  const complete = event.target.closest("[data-complete-lesson]");
  if (complete) { store.completed.add(Number(complete.dataset.completeLesson)); persist(); dialog.close(); showToast("本课已完成"); render(); }
});

document.querySelectorAll(".tab-item").forEach(button => button.addEventListener("click", () => goToPage(button.dataset.page)));
const route = location.hash.slice(1);
if (["today", "courses", "market", "quote", "labs", "glossary", "profile"].includes(route)) store.currentPage = route;
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
render();
