(function () {
  // Seeded RNG (mulberry32)
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s += 0x6d2b79f5;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function findSolution(nums, target) {
    if (nums.some((n) => n === target)) return [];
    if (nums.length < 2) return null;
    for (let i = 0; i < nums.length; i++) {
      for (let j = 0; j < nums.length; j++) {
        if (i === j) continue;
        const a = nums[i],
          b = nums[j];
        const rest = nums.filter((_, k) => k !== i && k !== j);
        const ops = [
          { sym: "+", val: a + b },
          { sym: "−", val: a - b },
          { sym: "×", val: a * b },
        ];
        if (b !== 0 && Number.isInteger(a / b))
          ops.push({ sym: "÷", val: a / b });
        for (const { sym, val } of ops) {
          if (val > 0) {
            const steps = findSolution([...rest, val], target);
            if (steps !== null) return [`${a} ${sym} ${b} = ${val}`, ...steps];
          }
        }
      }
    }
    return null;
  }

  function dateToSeed(d) {
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function getPuzzleDate() {
    const param = new URLSearchParams(location.search).get("date");
    if (!param) return { date: new Date(), error: null };

    const m = param.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!m) return { date: null, error: "Invalid date in URL." };

    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (isNaN(d)) return { date: null, error: "Invalid date in URL." };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    if (d > today)
      return { date: null, error: "You can't peek at future puzzles!" };

    return { date: d, error: null };
  }

  function formatDate(d) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cmp = new Date(d);
    cmp.setHours(0, 0, 0, 0);
    if (cmp.getTime() === today.getTime()) return "Today";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function dateParam(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }

  function getDailyPuzzle(d) {
    const baseSeed = dateToSeed(d);
    const small = [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ];
    const large = [25, 50, 75, 100];

    for (let attempt = 0; attempt < 200; attempt++) {
      const rand = rng(baseSeed * 1000 + attempt);
      const nLarge = Math.floor(rand() * 3); // 0, 1, or 2 large numbers
      const pool = [];
      const largeCopy = [...large];
      for (let i = 0; i < nLarge; i++) {
        const idx = Math.floor(rand() * largeCopy.length);
        pool.push(largeCopy.splice(idx, 1)[0]);
      }
      const smallCopy = [...small];
      while (pool.length < 6) {
        const idx = Math.floor(rand() * smallCopy.length);
        pool.push(smallCopy.splice(idx, 1)[0]);
      }
      const target = 100 + Math.floor(rand() * 900);
      if (findSolution([...pool], target) !== null) {
        return { numbers: pool, target };
      }
    }
    return { numbers: [3, 6, 8, 9, 75, 100], target: 952 };
  }

  // State
  let tiles = []; // { id, value, used, derived }
  let target = 0;
  let selected1 = null; // tile id
  let selectedOp = null; // '+' '−' '×' '÷'
  let history = []; // { id1, id2, resultId, expr }
  let nextId = 0;
  let solved = false;
  let storageKey = "";

  function saveState() {
    const moves = history.map((h) => ({ a: h._a, op: h._op, b: h._b }));
    try {
      localStorage.setItem(storageKey, JSON.stringify({ moves, solved }));
    } catch (_) {}
  }

  function applyMove(a, op, b) {
    const t1 = tiles.find((t) => !t.used && t.value === a);
    if (!t1) return false;
    const t2 = tiles.find((t) => !t.used && t.value === b && t.id !== t1.id);
    if (!t2) return false;

    let result;
    if (op === "+") result = a + b;
    else if (op === "−") result = a - b;
    else if (op === "×") result = a * b;
    else if (op === "÷") {
      if (b === 0 || !Number.isInteger(a / b)) return false;
      result = a / b;
    }
    if (result <= 0) return false;

    const resultId = nextId++;
    t1.used = true;
    t2.used = true;
    tiles.push({ id: resultId, value: result, used: false, derived: true });
    history.push({
      id1: t1.id,
      id2: t2.id,
      resultId,
      expr: `${a} ${op} ${b} = ${result}`,
      _a: a,
      _op: op,
      _b: b,
      _result: result,
    });
    return true;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const { moves, solved: wasSolved } = JSON.parse(raw);
      for (const { a, op, b } of moves) applyMove(a, op, b);
      if (wasSolved) {
        solved = true;
        render();
        dateLabelEl.innerHTML =
          dateLabelEl.textContent + ' <span id="solved-check">✓</span>';
        undoBtn.disabled = true;
      } else {
        render();
      }
    } catch (_) {}
  }

  // DOM refs
  const tilesEl = document.getElementById("tiles");
  const targetEl = document.getElementById("target-number");
  const exprEl = document.getElementById("expression");
  const historyEl = document.getElementById("history-list");
  const undoBtn = document.getElementById("undoBtn");
  const solutionBtn = document.getElementById("solutionBtn");
  const solutionOverlay = document.getElementById("solution-overlay");
  const solutionSteps = document.getElementById("solution-steps");
  const solutionClose = document.getElementById("solution-close");
  const solvedBanner = document.getElementById("solved-banner");
  const opBtns = document.querySelectorAll(".op-btn");
  const dateLabelEl = document.getElementById("date-label");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const errorArea = document.getElementById("error-area");
  const errorMsg = document.getElementById("error-msg");
  const gameContent = document.getElementById("numbers-area");

  function showError(msg) {
    errorArea.classList.remove("hidden");
    errorMsg.textContent = msg;
    document.getElementById("target-label").classList.add("hidden");
    gameContent.classList.add("hidden");
    document.getElementById("ops-area").classList.add("hidden");
    document.getElementById("expression-area").classList.add("hidden");
    document.getElementById("history-area").classList.add("hidden");
    document.getElementById("action-area").classList.add("hidden");
  }

  function init(puzzle, dateKey) {
    storageKey = `numup:${dateKey}`;
    tiles = puzzle.numbers.map((v) => ({
      id: nextId++,
      value: v,
      used: false,
      derived: false,
    }));
    target = puzzle.target;
    selected1 = null;
    selectedOp = null;
    history = [];
    solved = false;
    solvedBanner.classList.add("hidden");
    targetEl.textContent = target;
    loadState();
    if (!solved) render();
  }

  function render() {
    // Tiles
    tilesEl.innerHTML = "";
    tiles.forEach((t) => {
      const el = document.createElement("button");
      el.className = "tile";
      if (t.used) el.classList.add("used");
      if (t.derived) el.classList.add("derived");
      if (t.id === selected1) el.classList.add("selected");
      el.textContent = t.value;
      el.dataset.id = t.id;
      el.addEventListener("click", () => onTile(t.id));
      tilesEl.appendChild(el);
    });

    // Ops
    opBtns.forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.op === selectedOp);
    });

    // Expression preview
    const t1 = tiles.find((t) => t.id === selected1);
    if (t1 && selectedOp) {
      exprEl.textContent = `${t1.value} ${selectedOp} ?`;
    } else if (t1) {
      exprEl.textContent = `${t1.value} …`;
    } else {
      exprEl.textContent = "";
    }

    // History
    historyEl.innerHTML = "";
    history.forEach((h) => {
      const el = document.createElement("div");
      el.className = "history-entry";
      el.textContent = h.expr;
      historyEl.appendChild(el);
    });

    undoBtn.disabled = history.length === 0 || solved;
  }

  function onTile(id) {
    if (solved) return;
    const tile = tiles.find((t) => t.id === id);
    if (!tile || tile.used) return;

    if (selected1 === null) {
      selected1 = id;
      render();
      return;
    }

    if (selected1 === id) {
      // Deselect
      selected1 = null;
      selectedOp = null;
      render();
      return;
    }

    if (selectedOp === null) {
      // Switch first selection
      selected1 = id;
      render();
      return;
    }

    // We have: selected1, selectedOp, and now id as second number
    compute(selected1, selectedOp, id);
  }

  function onOp(op) {
    if (solved) return;
    if (selected1 === null) return; // need a number first
    selectedOp = selectedOp === op ? null : op;
    render();
  }

  function compute(id1, op, id2) {
    const t1 = tiles.find((t) => t.id === id1);
    const t2 = tiles.find((t) => t.id === id2);
    if (!t1 || !t2) return;

    const a = t1.value,
      b = t2.value;
    let result;
    switch (op) {
      case "+":
        result = a + b;
        break;
      case "−":
        result = a - b;
        break;
      case "×":
        result = a * b;
        break;
      case "÷":
        if (b === 0 || !Number.isInteger(a / b)) {
          flash("invalid");
          return;
        }
        result = a / b;
        break;
    }

    if (result <= 0) {
      flash("invalid");
      return;
    }

    const resultId = nextId++;
    const expr = `${a} ${op} ${b} = ${result}`;
    t1.used = true;
    t2.used = true;
    tiles.push({ id: resultId, value: result, used: false, derived: true });
    history.push({
      id1,
      id2,
      resultId,
      expr,
      _a: a,
      _op: op,
      _b: b,
      _result: result,
    });

    selected1 = null;
    selectedOp = null;
    render();
    saveState();

    if (result === target) {
      const newTile = document.querySelector(`.tile[data-id="${resultId}"]`);
      if (newTile) newTile.classList.add("target-hit");
      setTimeout(() => {
        solved = true;
        saveState();
        dateLabelEl.innerHTML =
          dateLabelEl.textContent + ' <span id="solved-check">✓</span>';
        solvedBanner.classList.remove("hidden");
        solvedBanner.addEventListener("click", dismissSolved, { once: true });
      }, 400);
    }
  }

  function dismissSolved() {
    solvedBanner.classList.add("hidden");
  }

  function undo() {
    if (history.length === 0) return;
    const last = history.pop();
    tiles = tiles.filter((t) => t.id !== last.resultId);
    const t1 = tiles.find((t) => t.id === last.id1);
    const t2 = tiles.find((t) => t.id === last.id2);
    if (t1) t1.used = false;
    if (t2) t2.used = false;
    selected1 = null;
    selectedOp = null;
    render();
    saveState();
  }

  function flash(type) {
    tilesEl.style.transition = "none";
    tilesEl.style.opacity = type === "invalid" ? "0.4" : "1";
    setTimeout(() => {
      tilesEl.style.transition = "opacity 0.3s";
      tilesEl.style.opacity = "1";
    }, 150);
  }

  // Share
  document.getElementById("shareBtn").addEventListener("click", () => {
    const steps = history.map((h) => h.expr).join("\n");
    const text = `NumUp ${new Date().toLocaleDateString()}\nTarget: ${target}\n\n ${location.origin + location.pathname}`;
    if (navigator.share) {
      navigator.share({ title: "NumUp", text }).catch(() => {});
    } else {
      navigator.clipboard
        .writeText(text)
        .then(() => alert("Copied to clipboard!"));
    }
  });

  // Solution
  solutionBtn.addEventListener("click", () => {
    const now = new Date();
    const isPast6pm = now.getHours() >= 18;
    const isToday = (() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const pd = new Date(puzzleDate);
      pd.setHours(0, 0, 0, 0);
      return pd.getTime() === today.getTime();
    })();

    if (isToday && !isPast6pm) {
      solutionSteps.innerHTML = "";
      const msg = document.createElement("div");
      msg.className = "solution-step";
      msg.textContent = "The solution will be revealed at 6 PM. Keep trying!";
      solutionSteps.appendChild(msg);
      solutionOverlay.classList.remove("hidden");
      return;
    }

    const puzzle = getDailyPuzzle(puzzleDate);
    const steps = findSolution([...puzzle.numbers], puzzle.target);
    solutionSteps.innerHTML = "";
    (steps || []).forEach((s) => {
      const el = document.createElement("div");
      el.className = "solution-step";
      el.textContent = s;
      solutionSteps.appendChild(el);
    });
    solutionOverlay.classList.remove("hidden");
  });
  solutionClose.addEventListener("click", () =>
    solutionOverlay.classList.add("hidden"),
  );
  solutionOverlay.addEventListener("click", (e) => {
    if (e.target === solutionOverlay) solutionOverlay.classList.add("hidden");
  });

  // Events
  opBtns.forEach((btn) =>
    btn.addEventListener("click", () => onOp(btn.dataset.op)),
  );
  undoBtn.addEventListener("click", undo);

  // Boot
  let puzzleDate;
  const { date, error } = getPuzzleDate();
  if (error) {
    puzzleDate = new Date();
    showError(error);
    dateLabelEl.textContent = "Today";
  } else {
    puzzleDate = date;
    dateLabelEl.textContent = formatDate(puzzleDate);
    init(getDailyPuzzle(puzzleDate), dateParam(puzzleDate));
  }

  const yesterday = new Date(puzzleDate);
  yesterday.setDate(yesterday.getDate() - 1);
  prevBtn.href = `?date=${dateParam(yesterday)}`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pd = new Date(puzzleDate);
  pd.setHours(0, 0, 0, 0);
  if (pd < today) {
    const tomorrow = new Date(puzzleDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    nextBtn.href = `?date=${dateParam(tomorrow)}`;
    nextBtn.classList.remove("hidden");
  }
})();
