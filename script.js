const svgNS = "http://www.w3.org/2000/svg";

const ui = {
  nameInput: document.getElementById("nameInput"),
  winnerSelect: document.getElementById("winnerSelect"),
  secretPanel: document.getElementById("secretPanel"),
  generateBtn: document.getElementById("generateBtn"),
  startBtn: document.getElementById("startBtn"),
  ladderSvg: document.getElementById("ladderSvg"),
  statusText: document.getElementById("statusText"),
  flashOverlay: document.getElementById("flashOverlay"),
  confettiLayer: document.getElementById("confettiLayer"),
  credit: document.getElementById("credit"),
};

const state = {
  names: [],
  winnerIndex: 0,
  board: null,
  rungs: [],
  rowMap: [],
  paths: [],
  bottomItems: [],
  running: false,
  topTags: [],
  resultGroups: [],
  resultTexts: [],
  traceLayer: null,
  secretUnlocked: false,
  secretCommandBuffer: "",
  secretActionClicks: 0,
  secretActionTimer: null,
};

const secretCommands = ["uraopen", "/admin"];

document.addEventListener("keydown", onSecretCommandKeydown);
ui.credit.addEventListener("click", onSecretActionClick);
ui.nameInput.addEventListener("input", refreshWinnerOptions);
ui.generateBtn.addEventListener("click", generateShow);
ui.startBtn.addEventListener("click", startShow);

bootstrap();

function bootstrap() {
  ui.nameInput.value = "佐藤\n田中\n鈴木\n高橋";
  refreshWinnerOptions();
  renderEmptyBoard();
  setSecretControlsEnabled(false);
}

function parseNames() {
  const raw = ui.nameInput.value.replace(/\r/g, "");
  return raw
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function refreshWinnerOptions() {
  const names = parseNames();
  const prev = ui.winnerSelect.value;
  ui.winnerSelect.innerHTML = "";

  if (!names.length) {
    const opt = document.createElement("option");
    opt.value = "0";
    opt.textContent = "参加者を入力";
    ui.winnerSelect.append(opt);
    ui.winnerSelect.disabled = true;
    return;
  }

  names.forEach((name, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = name;
    ui.winnerSelect.append(opt);
  });
  ui.winnerSelect.disabled = !state.secretUnlocked;
  ui.winnerSelect.value =
    Number(prev) >= 0 && Number(prev) < names.length ? prev : "0";
}

function setSecretControlsEnabled(enabled) {
  if (!parseNames().length) {
    ui.winnerSelect.disabled = true;
  } else {
    ui.winnerSelect.disabled = !enabled;
  }
}

function onSecretCommandKeydown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key.length !== 1) return;

  state.secretCommandBuffer = (
    state.secretCommandBuffer + event.key.toLowerCase()
  ).slice(-24);

  const matched = secretCommands.find((command) =>
    state.secretCommandBuffer.endsWith(command)
  );
  if (!matched) return;

  state.secretCommandBuffer = "";
  revealSecretPanel("コマンド");
}

function onSecretActionClick() {
  state.secretActionClicks += 1;

  if (state.secretActionTimer) {
    window.clearTimeout(state.secretActionTimer);
  }

  state.secretActionTimer = window.setTimeout(() => {
    state.secretActionClicks = 0;
    state.secretActionTimer = null;
  }, 1000);

  if (state.secretActionClicks < 3) return;
  state.secretActionClicks = 0;
  window.clearTimeout(state.secretActionTimer);
  state.secretActionTimer = null;
  revealSecretPanel("隠し操作");
}

function revealSecretPanel(source) {
  if (!state.secretUnlocked) {
    state.secretUnlocked = true;
    setSecretControlsEnabled(true);
    if (!state.running) {
      setStatus(`🔐 裏設定を解放しました（${source}）`);
    }
  }
  ui.secretPanel.classList.add("open");
  ui.secretPanel.setAttribute("aria-hidden", "false");
}

function generateShow() {
  if (state.running) return;
  const names = parseNames();
  if (names.length < 2) {
    setStatus("2人以上の名前を入力してください。");
    ui.startBtn.disabled = true;
    return;
  }

  state.names = names;
  state.winnerIndex = Math.min(
    Math.max(Number(ui.winnerSelect.value) || 0, 0),
    names.length - 1
  );

  const board = createBoardSpec(names.length);
  const ladder = createLadder(board);

  state.board = board;
  state.rungs = ladder.rungs;
  state.rowMap = ladder.rowMap;
  state.paths = names.map((_, idx) => buildPath(idx));
  state.bottomItems = buildBottomItems();

  renderBoard();
  setStatus("あみだを生成しました。演出スタートで抽選を開始します。");
  ui.startBtn.disabled = false;
}

function createBoardSpec(count) {
  const width = Math.max(920, count * 125 + 180);
  const height = 560;
  const topY = 92;
  const bottomY = 444;
  const left = 88;
  const right = width - 88;
  const cols = count - 1;
  const colGap = cols > 0 ? (right - left) / cols : 0;
  const xs = Array.from({ length: count }, (_, i) => left + colGap * i);

  const rows = Math.max(13, Math.min(21, count * 2 + 9));
  const stepY = (bottomY - topY) / (rows + 1);
  const rowYs = Array.from({ length: rows }, (_, i) => topY + stepY * (i + 1));

  return { width, height, topY, bottomY, xs, rows, rowYs };
}

function createLadder(board) {
  const rungs = [];
  const rowMap = Array.from({ length: board.rows }, () => new Set());
  const density = 0.4;

  for (let row = 0; row < board.rows; row += 1) {
    const blocked = new Set();
    for (let col = 0; col < board.xs.length - 1; col += 1) {
      if (blocked.has(col)) continue;
      if (Math.random() < density) {
        rungs.push({ row, col });
        rowMap[row].add(col);
        blocked.add(col);
        blocked.add(col + 1);
      }
    }
  }

  if (rungs.length < board.xs.length * 2) {
    return createLadder(board);
  }

  return { rungs, rowMap };
}

function buildPath(startCol) {
  const { xs, rowYs, topY, bottomY } = state.board;
  let col = startCol;
  let d = `M ${xs[col]} ${topY}`;

  for (let row = 0; row < rowYs.length; row += 1) {
    const y = rowYs[row];
    d += ` L ${xs[col]} ${y}`;
    if (state.rowMap[row].has(col)) {
      col += 1;
      d += ` L ${xs[col]} ${y}`;
    } else if (col > 0 && state.rowMap[row].has(col - 1)) {
      col -= 1;
      d += ` L ${xs[col]} ${y}`;
    }
  }

  d += ` L ${xs[col]} ${bottomY}`;
  return { d, endCol: col };
}

function buildBottomItems() {
  const result = Array.from({ length: state.names.length }, () => ({
    text: "",
    win: false,
  }));
  const winBottom = state.paths[state.winnerIndex].endCol;

  for (let i = 0; i < result.length; i += 1) {
    if (i === winBottom) {
      result[i] = { text: "🎯 当たり！", win: true };
    } else {
      result[i] = { text: "ハズレ", win: false };
    }
  }
  return result;
}

function renderEmptyBoard() {
  ui.ladderSvg.setAttribute("viewBox", "0 0 900 560");
  ui.ladderSvg.innerHTML = "";
  setStatus("参加者を入力して「あみだ生成」を押してください。");
}

function renderBoard() {
  const { width, height, topY, bottomY, xs, rowYs } = state.board;
  ui.ladderSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  ui.ladderSvg.innerHTML = "";

  state.topTags = [];
  state.resultGroups = [];
  state.resultTexts = [];

  const lineLayer = createSvg("g");
  const tagLayer = createSvg("g");
  state.traceLayer = createSvg("g");
  ui.ladderSvg.append(lineLayer, state.traceLayer, tagLayer);

  for (let i = 0; i < xs.length; i += 1) {
    const line = createSvg("line", {
      x1: xs[i],
      y1: topY,
      x2: xs[i],
      y2: bottomY,
      class: "vline",
    });
    lineLayer.append(line);
  }

  state.rungs.forEach(({ row, col }) => {
    const hline = createSvg("line", {
      x1: xs[col],
      y1: rowYs[row],
      x2: xs[col + 1],
      y2: rowYs[row],
      class: "hline",
    });
    lineLayer.append(hline);
  });

  xs.forEach((x, i) => {
    const topTag = createTag({
      x,
      y: 42,
      text: trimLabel(state.names[i], 8),
      className: "tag-top",
    });
    tagLayer.append(topTag.group);
    state.topTags.push(topTag.group);
  });

  xs.forEach((x, i) => {
    const resultTag = createTag({
      x,
      y: 502,
      text: "？？？",
      className: "result-box waiting",
    });
    tagLayer.append(resultTag.group);
    state.resultGroups.push(resultTag.group);
    state.resultTexts.push(resultTag.text);
  });
}

function createTag({ x, y, text, className }) {
  const group = createSvg("g", { class: className });
  const rect = createSvg("rect", {
    x: x - 56,
    y: y - 18,
    width: 112,
    height: 36,
    rx: 10,
    class: "tag-rect",
  });
  const label = createSvg("text", {
    x,
    y,
    class: "tag-text",
  });
  label.textContent = text;
  group.append(rect, label);
  return { group, text: label };
}

async function startShow() {
  if (state.running || !state.paths.length) return;
  state.running = true;
  ui.generateBtn.disabled = true;
  ui.startBtn.disabled = true;
  resetResults();
  clearTraces();
  flash();

  setStatus("カウントダウン開始...");
  await countdown();

  const order = makeRevealOrder();
  const winnerName = state.names[state.winnerIndex];

  for (let step = 0; step < order.length; step += 1) {
    const idx = order[step];
    const isWinner = idx === state.winnerIndex;
    const actor = state.names[idx];

    if (isWinner && step > 0) {
      await fakeSpotlight();
    }

    setActiveTop(idx);
    setStatus(`${actor} さんのルートを追跡中...`);

    const endCol = await animateTrace(idx, "#8fd1ff", 2300);
    revealResult(endCol);

    if (isWinner) {
      setStatus(`${actor} さんが当たり！残りを確認中...`);
      await wait(800);
    } else {
      setStatus(`${actor} さんは ${state.bottomItems[endCol].text}`);
      await wait(700);
    }
  }

  setActiveTop(-1);
  flash();
  confettiBurst();
  setStatus(`抽選終了。今回の暴露相手は ${winnerName} さん！`);
  window.alert(`今回の暴露相手は....「${winnerName}」に決定！！`);
  ui.generateBtn.disabled = false;
  ui.startBtn.disabled = false;
  state.running = false;
}

function makeRevealOrder() {
  const all = state.names.map((_, i) => i);
  return shuffle(all);
}

function resetResults() {
  state.resultGroups.forEach((group, idx) => {
    group.setAttribute("class", "result-box waiting");
    state.resultTexts[idx].textContent = "？？？";
  });
}

function revealResult(col) {
  const item = state.bottomItems[col];
  const group = state.resultGroups[col];
  group.setAttribute(
    "class",
    `result-box revealed ${item.win ? "win" : "lose"}`
  );
  state.resultTexts[col].textContent = item.text;
}

function clearTraces() {
  if (state.traceLayer) state.traceLayer.innerHTML = "";
}

function setActiveTop(index) {
  state.topTags.forEach((tag, i) => {
    tag.setAttribute("class", i === index ? "tag-top active" : "tag-top");
  });
}

function animateTrace(idx, color, duration) {
  const pathData = state.paths[idx];
  const path = createSvg("path", {
    d: pathData.d,
    class: "trace-path",
    stroke: color,
  });
  state.traceLayer.append(path);

  const length = path.getTotalLength();
  path.style.strokeDasharray = `${length}`;
  path.style.strokeDashoffset = `${length}`;

  const anim = path.animate(
    [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
    {
      duration,
      fill: "forwards",
      easing: "cubic-bezier(0.2, 0.95, 0.25, 1)",
    }
  );

  return anim.finished.then(() => pathData.endCol);
}

async function countdown() {
  const seq = ["3", "2", "1", "START!"];
  for (const value of seq) {
    setStatus(`まもなく開始... ${value}`);
    flash();
    await wait(600);
  }
}

async function fakeSpotlight() {
  const losers = state.names
    .map((_, idx) => idx)
    .filter((idx) => idx !== state.winnerIndex);
  if (!losers.length) return;
  const fake = losers[Math.floor(Math.random() * losers.length)];
  setActiveTop(fake);
  setStatus(`会場騒然... ${state.names[fake]} さんに当たりの気配!?`);
  flash();
  await wait(850);
  setStatus("判定保留。最終ルートへ...");
  await wait(450);
}

function setStatus(text) {
  ui.statusText.textContent = text;
}

function flash() {
  ui.flashOverlay.classList.remove("flash");
  void ui.flashOverlay.offsetWidth;
  ui.flashOverlay.classList.add("flash");
}

function confettiBurst() {
  ui.confettiLayer.innerHTML = "";
  const colors = ["#ffd166", "#06d6a0", "#4cc9f0", "#ef476f", "#f9c74f"];
  const count = 84;

  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.setProperty("--xmove", `${(Math.random() - 0.5) * 260}px`);
    piece.style.setProperty("--rot", `${(Math.random() - 0.5) * 920}deg`);
    piece.style.animationDuration = `${2.1 + Math.random() * 1.4}s`;
    piece.style.animationDelay = `${Math.random() * 0.45}s`;
    ui.confettiLayer.append(piece);
  }

  window.setTimeout(() => {
    ui.confettiLayer.innerHTML = "";
  }, 4200);
}

function createSvg(tag, attrs = {}) {
  const node = document.createElementNS(svgNS, tag);
  Object.entries(attrs).forEach(([key, val]) => node.setAttribute(key, val));
  return node;
}

function trimLabel(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
