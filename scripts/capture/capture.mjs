import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { captureScenes, FIXED_NOW } from "../../src/testing/captureScenes.ts";

const manifestUrl = new URL("./scenes.json", import.meta.url);
const chromePath =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const viewports = {
  phone: { width: 440, height: 956, deviceScaleFactor: 3 },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 2 },
};

function sceneManifest() {
  return captureScenes.map(({ id, params, viewport }) => {
    const query = Object.entries({ scene: id, ...params })
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");
    return { id, url: `/capture?${query}`, viewport };
  });
}

async function capture(browser, base, out, scene) {
  const page = await browser.newPage();
  const errors = [];
  try {
    await page.setViewport(viewports[scene.viewport]);
    await page.emulateTimezone("Asia/Manila");
    await page.evaluateOnNewDocument((now) => {
      const NativeDate = globalThis.Date;
      globalThis.Date = new Proxy(NativeDate, {
        apply() {
          return new NativeDate(now).toString();
        },
        construct(target, args, receiver) {
          return Reflect.construct(
            target,
            args.length ? args : [now],
            receiver,
          );
        },
        get(target, key, receiver) {
          return key === "now" ? () => now : Reflect.get(target, key, receiver);
        },
      });
    }, FIXED_NOW);

    page.on("pageerror", (error) =>
      errors.push(error.message ?? String(error)),
    );
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.origin === base.origin ||
        url.origin === "https://api.mapbox.com" ||
        ["data:", "blob:"].includes(url.protocol)
      ) {
        return request.continue();
      }
      errors.push(`Blocked external request to ${url.origin}${url.pathname}`);
      return request.abort();
    });

    const response = await page.goto(new URL(scene.url, base).href, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    if (!response?.ok()) {
      throw new Error(`Expo returned HTTP ${response?.status() ?? "unknown"}`);
    }

    const selector = `#capture-${scene.id}`;
    await page.waitForFunction(
      (target) => Boolean(document.querySelector(target)?.textContent?.trim()),
      { timeout: 20_000 },
      selector,
    );
    await page.addStyleTag({
      content:
        "* { scrollbar-width: none !important; } *::-webkit-scrollbar { display: none !important; }",
    });

    await delay(1500);
    await page.waitForFunction(
      () =>
        document.fonts.status === "loaded" &&
        Array.from(document.images).every((img) => img.complete),
      { timeout: 30_000 },
    );
    const brokenImages = await page.evaluate(async () => {
      await document.fonts.ready;
      return Array.from(document.images)
        .filter((img) => img.currentSrc && !img.naturalWidth)
        .map((img) => img.currentSrc);
    });
    if (brokenImages.length) {
      throw new Error(`Images failed to load: ${brokenImages.join(", ")}`);
    }
    if (errors.length) {
      throw new Error("The screen reported errors");
    }
    const path = resolve(out, `${scene.id}.png`);
    await page.screenshot({ path });
    console.log(`${scene.id}  ${path}`);
  } catch (error) {
    throw new Error([error.message, ...new Set(errors)].join("\n"), {
      cause: error,
    });
  } finally {
    await page.close();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      base: { type: "string", default: "http://localhost:8081" },
      only: { type: "string" },
      out: {
        type: "string",
        default: fileURLToPath(
          new URL("../../docs/store/raw-screens/", import.meta.url),
        ),
      },
      list: { type: "boolean" },
      "write-scenes": { type: "boolean" },
    },
  });
  const expected = sceneManifest();
  if (values["write-scenes"]) {
    await writeFile(manifestUrl, `${JSON.stringify(expected, null, 2)}\n`);
    return;
  }

  const scenes = JSON.parse(await readFile(manifestUrl, "utf8"));
  if (JSON.stringify(scenes) !== JSON.stringify(expected)) {
    throw new Error(
      "Scene manifest is out of date. Run node scripts/capture/capture.mjs --write-scenes.",
    );
  }
  const only = values.only?.split(",").map((id) => id.trim());
  const unknown = only?.filter(
    (id) => !scenes.some((scene) => scene.id === id),
  );
  if (unknown?.length) {
    throw new Error(`Unknown scene IDs: ${unknown.join(", ")}`);
  }
  const selected = only ? scenes.filter(({ id }) => only.includes(id)) : scenes;
  if (values.list) {
    selected.forEach(({ id, viewport, url }) =>
      console.log(`${id}\t${viewport}\t${url}`),
    );
    return;
  }

  const base = new URL(values.base);
  await mkdir(values.out, { recursive: true });
  const { default: puppeteer } = await import("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--disable-background-networking"],
  });
  try {
    for (const scene of selected) {
      try {
        await capture(browser, base, values.out, scene);
      } catch (error) {
        console.error(`${scene.id}: ${error.message}`);
        process.exitCode = 1;
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
