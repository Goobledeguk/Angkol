// Composes App Store and Google Play screenshots from raw captures.
// Usage: node scripts/capture/store.mjs [--raw docs/store/raw-screens] [--out docs/store]
//
// Rules this file keeps:
// - Copy is laid out in normal flow and the art sits below it, so a phone can
//   never cover a headline, whatever its length.
// - Phones run off the bottom edge, so the top of each screen (where the
//   content is) gets the space and empty screen bottoms are never shown.
// - Upright devices only, sentence-case headlines, one accent.
// - App Store: 10 shots at 1320 x 2868. Google Play: 8 shots at 1080 x 1920 (9:16)
//   with an Android frame, plus the 1024 x 500 feature graphic.
import { mkdirSync, writeFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const RAW = resolve(ROOT, arg("raw", "docs/store/raw-screens"));
const OUT = resolve(ROOT, arg("out", "docs/store"));
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const url = (p) => pathToFileURL(p).href;
const raw = (id) => url(resolve(RAW, `${id}.png`));
const asset = (p) => url(resolve(ROOT, "assets", p));

// Raw captures are 440 x 956 CSS px. A crop is given in those units.
const RAW_W = 440;
const RAW_H = 956;

// Order is the order a rider meets things. The first eight go to Google Play.
const slides = [
  {
    id: "01-book",
    tone: "photo",
    title: "Book a tricycle in Calbayog",
    sub: "Regular or special, at the city’s fixed fare. Pay the driver in cash.",
    screen: "p-home",
  },
  {
    id: "02-body-number",
    tone: "white",
    title: "Board only if the number matches",
    sub: "Every tricycle shows its TODA and body number. Yours is on screen before it arrives.",
    screen: "p-arrived",
    detail: { y: 84 },
  },
  {
    id: "03-request",
    tone: "white",
    title: "Nearest driver is asked first",
    sub: "Your request goes to tricycles close to your pickup. It closes after 10 minutes if no one accepts.",
    screen: "p-searching",
  },
  {
    id: "04-para",
    tone: "yellow",
    title: "Tap PARA! where you want to get off",
    sub: "The driver pulls over where you tap. Then pay the fare on screen, in cash.",
    screen: "p-track",
  },
  {
    id: "05-jeepney",
    tone: "white",
    title: "Hold a seat on the next jeepney",
    sub: "Check the plate, the next departure and the fare before you walk to the terminal.",
    screen: "p-seat",
  },
  {
    id: "06-routes",
    tone: "ink",
    title: "Jeepney routes, stops and fares",
    sub: "How often each route runs and where it starts.",
    screen: "p-routes",
  },
  {
    id: "07-receipt",
    tone: "white",
    title: "A receipt for every ride",
    sub: "Route, driver and fare, ready to share with family.",
    screen: "p-receipt",
  },
  {
    id: "08-driver-offer",
    tone: "ink",
    title: "Drivers see the fare before they accept",
    sub: "Pickup, drop-off and the amount up front. The cash goes straight to the driver.",
    screen: "d-requests",
  },
  {
    id: "09-approach",
    tone: "white",
    title: "See your driver coming",
    sub: "The map shows the tricycle and where you agreed to meet.",
    screen: "p-accepted",
  },
  {
    id: "10-driver-week",
    tone: "white",
    title: "A driver’s week, day by day",
    sub: "Trips and cash fares for the last seven days. Angkol takes no commission.",
    screen: "d-earnings",
  },
];

const fonts = ["Regular", "Medium", "SemiBold", "Bold"]
  .map((n, i) => `@font-face{font-family:Archivo;font-weight:${400 + i * 100};src:url(${asset(`fonts/Archivo-${n}.ttf`)})}`)
  .join("");

const css = (W, H) => `${fonts}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{font-family:Archivo;background:#fff;color:#111512;-webkit-font-smoothing:antialiased;display:flex;flex-direction:column;position:relative}
body.ink{background:#111512;color:#fff}
body.yellow{background:#FFC20E}
body.photo{background:#111512 var(--photo) 50% 0/118% auto no-repeat;color:#fff}
body.photo::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,12,11,.72) 0%,rgba(10,12,11,.38) 30%,rgba(10,12,11,0) 48%)}
.copy{position:relative;z-index:2;padding:var(--pad-top) var(--pad) 0}
.logo{display:block;width:150px;margin:-14px 0 6px -18px}
h1{font-weight:700;font-size:var(--h1);line-height:1.08;letter-spacing:-.6px;max-width:var(--measure)}
p{margin-top:12px;font-weight:400;font-size:var(--p);line-height:1.4;max-width:var(--measure)}
.white p{color:#4F5551}.ink p{color:#C9CCC6}.yellow p{color:#3A3206}.photo p{color:#EDEFEC}
.art{position:relative;flex:1;min-height:0;margin-top:var(--gap)}
.phone{position:absolute;left:50%;transform:translateX(-50%);top:0;width:var(--phone);aspect-ratio:${RAW_W}/${RAW_H + 32};border-radius:var(--r-out);background:#0B0D0C;padding:var(--bezel);box-shadow:0 0 0 1px rgba(255,255,255,.08)}
.white .phone{box-shadow:0 24px 60px -28px rgba(0,0,0,.45)}
.screen{width:100%;height:100%;border-radius:var(--r-in);overflow:hidden;background:#fff;display:flex;flex-direction:column}
.screen img{width:100%;display:block}
.sb{flex:0 0 auto;height:var(--sb);display:flex;align-items:center;justify-content:space-between;padding:0 var(--sb-pad);font-weight:600;font-size:var(--sb-font);color:#111512;position:relative}
.sb .cam{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#000}
.ios .sb .cam{width:28%;height:62%;border-radius:999px}
.android .sb .cam{width:var(--sb-font);height:var(--sb-font);border-radius:50%}
.sb svg{height:calc(var(--sb-font) * .85)}
.detail{position:absolute;left:var(--pad);right:var(--pad);top:0;bottom:-40px;border-radius:22px;overflow:hidden;background-color:#fff;background-repeat:no-repeat;box-shadow:0 0 0 1.5px #111512}
`;

const icons = `<svg viewBox="0 0 64 12"><g fill="#111512"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/><path d="M30 3.2a10 10 0 0 1 13 0l-1.6 1.7a7.6 7.6 0 0 0-9.8 0zM32.6 6a6.3 6.3 0 0 1 7.8 0l-1.6 1.7a4 4 0 0 0-4.6 0zM36.5 11.5l-1.9-2a2.7 2.7 0 0 1 3.8 0z"/><rect x="47" y="1" width="15" height="10" rx="3" fill="none" stroke="#111512" stroke-width="1.4"/><rect x="49" y="3" width="10" height="6" rx="1.4"/></g></svg>`;

const phone = (id) =>
  `<div class="phone"><div class="screen"><div class="sb"><span>9:41</span><i class="cam"></i>${icons}</div><img src="${raw(id)}"></div></div>`;

// The real screen without a device, enlarged to the full width so the
// important part reads at carousel size. It starts at \`y\` and runs off the bottom.
const detail = (id, y, width) => {
  const scale = width / RAW_W;
  return `<div class="detail" style="background-image:url(${raw(id)});background-size:${RAW_W * scale}px auto;background-position:0 -${Math.round(y * scale)}px"></div>`;
};

function page(slide, store) {
  const ios = store === "ios";
  const W = ios ? 440 : 360;
  const H = ios ? 956 : 640;
  const vars = ios
    ? { pad: 28, padTop: 64, h1: 40, p: 18, measure: 384, gap: 34, phone: 330, bezel: 10, rOut: 50, rIn: 40, sb: 30, sbPad: 26, sbFont: 12 }
    : { pad: 24, padTop: 40, h1: 31, p: 15, measure: 312, gap: 24, phone: 262, bezel: 7, rOut: 30, rIn: 24, sb: 22, sbPad: 18, sbFont: 10 };
  const style = [
    `--pad:${vars.pad}px`,
    `--pad-top:${slide.tone === "photo" ? vars.padTop - 8 : vars.padTop}px`,
    `--h1:${vars.h1}px`,
    `--p:${vars.p}px`,
    `--measure:${vars.measure}px`,
    `--gap:${vars.gap}px`,
    `--phone:${vars.phone}px`,
    `--bezel:${vars.bezel}px`,
    `--r-out:${vars.rOut}px`,
    `--r-in:${vars.rIn}px`,
    `--sb:${vars.sb}px`,
    `--sb-pad:${vars.sbPad}px`,
    `--sb-font:${vars.sbFont}px`,
    `--photo:url(${asset("calbayog-welcome-portrait.png")})`,
  ].join(";");
  const logo = slide.tone === "photo" ? `<img class="logo" src="${asset("angkol-white-centered.png")}" alt="Angkol">` : "";
  const art = `<div class="art">${slide.detail ? detail(slide.screen, slide.detail.y, W - vars.pad * 2) : phone(slide.screen)}</div>`;
  return {
    W,
    H,
    html: `<!doctype html><html><head><meta charset="utf-8"><style>${css(W, H)}</style></head>
<body class="${slide.tone} ${ios ? "ios" : "android"}" style="${style}">
<div class="copy">${logo}<h1>${slide.title}</h1><p>${slide.sub}</p></div>
${art}
</body></html>`,
  };
}

function featureGraphic() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(1024, 500)}
body{background:#111512 url(${asset("calbayog-welcome.jpg")}) center 40%/cover no-repeat;color:#fff}
body::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(10,12,11,.86) 0%,rgba(10,12,11,.55) 42%,rgba(10,12,11,0) 72%)}
.fg{position:relative;z-index:2;padding:0 64px;margin:auto 0}
.fg img{display:block;width:300px;margin:0 0 4px -36px}
.fg h1{font-size:40px;max-width:440px}
.fg p{font-size:19px;color:#E4E6E2;max-width:420px}
</style></head><body>
<div class="fg"><img src="${asset("angkol-white-centered.png")}" alt="Angkol"><h1>Tricycles and jeepneys in Calbayog</h1><p>Fixed city fares, paid to the driver in cash.</p></div>
</body></html>`;
}

for (const slide of slides) {
  if (!existsSync(resolve(RAW, `${slide.screen}.png`))) throw new Error(`missing raw screen ${slide.screen}`);
}
for (const dir of ["app-store-6.9in", "google-play"]) {
  const folder = resolve(OUT, dir);
  if (existsSync(folder)) {
    readdirSync(folder)
      .filter((f) => f.endsWith(".png"))
      .forEach((f) => rmSync(resolve(folder, f)));
  }
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--allow-file-access-from-files"] });
const tab = await browser.newPage();
const tmp = resolve(HERE, ".store-tmp.html");
async function render(html, w, h, file, scale) {
  writeFileSync(tmp, html);
  await tab.setViewport({ width: w, height: h, deviceScaleFactor: scale });
  await tab.goto(url(tmp), { waitUntil: "load" });
  await tab.evaluate(() => document.fonts.ready);
  // Guard: the copy block must end above the art.
  const clash = await tab.evaluate(() => {
    const copy = document.querySelector(".copy")?.getBoundingClientRect();
    const art = document.querySelector(".detail, .phone")?.getBoundingClientRect();
    return copy && art ? copy.bottom > art.top : false;
  });
  if (clash) throw new Error(`${file}: copy overlaps the art`);
  mkdirSync(dirname(file), { recursive: true });
  await tab.screenshot({ path: file, type: "png" });
  console.log(file.replace(ROOT + "/", ""));
}
for (const slide of slides) {
  const ios = page(slide, "ios");
  await render(ios.html, ios.W, ios.H, resolve(OUT, "app-store-6.9in", `${slide.id}.png`), 3);
}
for (const slide of slides.slice(0, 8)) {
  const play = page(slide, "android");
  await render(play.html, play.W, play.H, resolve(OUT, "google-play", `${slide.id}.png`), 3);
}
await render(featureGraphic(), 1024, 500, resolve(OUT, "google-play", "feature-graphic-1024x500.png"), 1);
await browser.close();
rmSync(tmp, { force: true });
