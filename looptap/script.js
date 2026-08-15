const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const COLORS = [
  "#ED5565",
  "#D9444F",
  "#ED5F56",
  "#DA4C43",
  "#F87D52",
  "#E7663F",
  "#FAB153",
  "#F59B43",
  "#FDCE55",
  "#F6BA43",
  "#C2D568",
  "#B1C353",
  "#99D469",
  "#83C251",
  "#42CB70",
  "#3CB85D",
  "#47CEC0",
  "#3BBEB0",
  "#4FC2E7",
  "#3CB2D9",
  "#5C9DED",
  "#4C8CDC",
  "#9398EC",
  "#7277D5",
  "#CC93EF",
  "#B377D9",
  "#ED87BF",
  "#D870AE",
];

let ink = { main: "#2c3d51", strong: "#34495e", soft: "#7f8c8d" };
function readInk() {
  const cs = getComputedStyle(document.documentElement);
  const pick = (name, fallback) =>
    cs.getPropertyValue(name).trim() || fallback;
  ink = {
    main: pick("--ink", ink.main),
    strong: pick("--ink-strong", ink.strong),
    soft: pick("--ink-soft", ink.soft),
  };
}
readInk();
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    readInk();
    draw();
  });

// Game state
let state = "init"; // "init" | "started" | "stopped"
let ignoreNext = false;
let score = 0;
let best = getHighscore("looptap");
let taps = 0;
let prevTapTime = 0;
let ballAngle = 0;
let arcStart = 180;
let arcEnd = 270;
let lastFrameTime = null;
let rafId = null;

// Canvas sizing — square, fits in available space
let logicalSize = 0;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const header = document.getElementById("site-header");
  const hintEl = document.getElementById("hint");
  const availW = document.body.clientWidth;
  const availH = window.innerHeight - header.offsetHeight - (hintEl ? hintEl.offsetHeight : 0);
  logicalSize = Math.floor(Math.min(availW, availH));
  canvas.width = logicalSize * dpr;
  canvas.height = logicalSize * dpr;
  canvas.style.width = logicalSize + "px";
  canvas.style.height = logicalSize + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

// Geometry helpers
const DEG = Math.PI / 180;

function polarToXY(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * DEG;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function randomArc() {
  const start = Math.floor(Math.random() * 300);
  let end = start + Math.floor(Math.random() * 100) + 10;
  if (end > 360) end = 360;
  arcStart = start;
  arcEnd = end;
}

function arcColor() {
  const idx =
    score < 270 ? Math.floor(score / 10) : Math.floor((score - 270) / 10);
  return COLORS[idx] || "#bdc3c7";
}

// Drawing
function draw() {
  const w = logicalSize;
  const h = logicalSize;
  const cx = w / 2;
  const cy = h / 2;
  const trackR = w * 0.32;
  const ballR = w * 0.04;
  const arcWidth = w * 0.09;

  ctx.clearRect(0, 0, w, h);

  // Arc (colored segment)
  ctx.beginPath();
  ctx.arc(cx, cy, trackR, (arcStart - 90) * DEG, (arcEnd - 90) * DEG);
  ctx.strokeStyle = arcColor();
  ctx.lineWidth = arcWidth;
  ctx.lineCap = "round";
  ctx.stroke();

  // Ball
  const ball = polarToXY(cx, cy, trackR, ballAngle);
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ballR, 0, Math.PI * 2);
  ctx.fillStyle = ink.main;
  ctx.fill();

  // Text overlays
  ctx.textAlign = "center";
  ctx.fillStyle = ink.main;

  if (state === "started") {
    ctx.font = `bold ${w * 0.18}px system-ui, sans-serif`;
    ctx.fillText(score, cx, cy + w * 0.07);
  }

  if (state === "stopped") {
    ctx.font = `bold ${w * 0.18}px system-ui, sans-serif`;
    ctx.fillStyle = ink.strong;
    ctx.fillText(score, cx, cy - w * 0.06);
    ctx.font = `${w * 0.07}px system-ui, sans-serif`;
    ctx.fillStyle = ink.soft;
    ctx.fillText(`Best: ${best}`, cx, cy + w * 0.12);
  }

  if (state === "init") {
    // Play triangle with rounded corners
    const ts = w * 0.13;
    const r = ts * 0.45;
    const p = [
      { x: cx - ts * 0.5, y: cy - ts * 0.65 },
      { x: cx + ts * 0.9, y: cy },
      { x: cx - ts * 0.5, y: cy + ts * 0.65 },
    ];
    ctx.fillStyle = ink.main;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const prev = p[(i + 2) % 3];
      const curr = p[i];
      const next = p[(i + 1) % 3];
      const d0x = curr.x - prev.x,
        d0y = curr.y - prev.y;
      const d1x = next.x - curr.x,
        d1y = next.y - curr.y;
      const l0 = Math.hypot(d0x, d0y),
        l1 = Math.hypot(d1x, d1y);
      const t0x = curr.x - (d0x / l0) * r,
        t0y = curr.y - (d0y / l0) * r;
      const t1x = curr.x + (d1x / l1) * r,
        t1y = curr.y + (d1y / l1) * r;
      if (i === 0) ctx.moveTo(t0x, t0y);
      else ctx.lineTo(t0x, t0y);
      ctx.quadraticCurveTo(curr.x, curr.y, t1x, t1y);
    }
    ctx.closePath();
    ctx.fill();

  }

  if (state === "stopped") {
    // Replay triangle with rounded corners
    const ts = w * 0.13;
    const r = ts * 0.45;
    const oy = cy + w * 0.18;
    const p = [
      { x: cx - ts * 0.5, y: oy },
      { x: cx + ts * 0.9, y: oy + ts * 0.65 },
      { x: cx - ts * 0.5, y: oy + ts * 1.3 },
    ];
    ctx.fillStyle = ink.main;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const prev = p[(i + 2) % 3];
      const curr = p[i];
      const next = p[(i + 1) % 3];
      const d0x = curr.x - prev.x,
        d0y = curr.y - prev.y;
      const d1x = next.x - curr.x,
        d1y = next.y - curr.y;
      const l0 = Math.hypot(d0x, d0y),
        l1 = Math.hypot(d1x, d1y);
      const t0x = curr.x - (d0x / l0) * r,
        t0y = curr.y - (d0y / l0) * r;
      const t1x = curr.x + (d1x / l1) * r,
        t1y = curr.y + (d1y / l1) * r;
      if (i === 0) ctx.moveTo(t0x, t0y);
      else ctx.lineTo(t0x, t0y);
      ctx.quadraticCurveTo(curr.x, curr.y, t1x, t1y);
    }
    ctx.closePath();
    ctx.fill();
  }
}

// Game loop
function loop(now) {
  if (state !== "started") return;
  if (!lastFrameTime) lastFrameTime = now;
  const delta = now - lastFrameTime;
  lastFrameTime = now;
  const speed = Math.max(500, 2000 - taps * 10);
  ballAngle = (ballAngle + (360 * delta) / speed) % 360;
  draw();
  rafId = requestAnimationFrame(loop);
}

const hint = document.getElementById("hint");

function setHint(visible) {
  hint.classList.toggle("hidden", !visible);
}

function startPlay() {
  state = "started";
  setHint(false);
  score = 0;
  taps = 0;
  ballAngle = 0;
  lastFrameTime = null;
  prevTapTime = Date.now();
  randomArc();
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function stopPlay() {
  if (state !== "started") return;
  state = "stopped";
  ignoreNext = true;
  setHint(true);
  best = postHighscore("looptap", score);
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  draw();
}

function tap(e) {
  if (e instanceof MouseEvent && e.button !== 0) return;
  if (e.target.closest("a, button")) return;
  e.preventDefault();
  if (state === "stopped" && ignoreNext) { ignoreNext = false; return; }
  if (state === "init" || state === "stopped") {
    startPlay();
    return;
  }
  if (state === "started") {
    if (ballAngle + 6 > arcStart && ballAngle - 6 < arcEnd) {
      const now = Date.now();
      const interval = now - prevTapTime;
      taps++;
      score += interval < 500 ? 5 : interval < 1000 ? 2 : 1;
      prevTapTime = now;
      randomArc();
      playBubble();
    } else {
      playError();
      stopPlay();
    }
  }
}

// Sound effects
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playBubble() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(520, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

function playError() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.25);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.25);
}

// Share
initShareButton(() => ({
  text: `Beat my score: ${score}\nLooptap - a minimal game to waste your time.\n${location.origin + location.pathname}`,
}));

// Input
if ("ontouchstart" in window) {
  document.addEventListener("touchstart", tap, { passive: false });
} else {
  document.addEventListener("mousedown", tap);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") tap(e);
  });
}

// Init
window.addEventListener("resize", resize);
resize();
draw();
