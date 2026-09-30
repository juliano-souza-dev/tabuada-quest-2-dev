import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeViewportMetrics,
  enforceViewportBackgroundLayout,
  resolveViewportNodeLayout
} from "../src/runtime/layout/ViewportLayout.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const reference = { width: 390, height: 844 };

const viewports = [
  { width: 1440, height: 735 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 900, height: 1440 }
];

const almostEqual = (a, b, tolerance = 0.001) =>
  Math.abs(a - b) <= tolerance;

test("canonical stage spans the whole physical viewport", () => {
  for (const host of viewports) {
    const metrics = computeViewportMetrics(host, reference);
    assert.ok(
      almostEqual(metrics.logicalViewport.width * metrics.viewportScale, host.width),
      `stage width failed for ${host.width}x${host.height}`
    );
    assert.ok(
      almostEqual(metrics.logicalViewport.height * metrics.viewportScale, host.height),
      `stage height failed for ${host.width}x${host.height}`
    );
  }
});

test("regular nodes keep canonical dimensions on wide screens", () => {
  const host = { width: 1440, height: 735 };
  const metrics = computeViewportMetrics(host, reference);
  const layout = resolveViewportNodeLayout(
    { x: 131, y: 358, width: 128, height: 128 },
    {
      reference,
      logicalViewport: metrics.logicalViewport,
      sceneOffset: metrics.sceneOffset
    }
  );
  assert.equal(layout.width, 128);
  assert.equal(layout.height, 128);
});

test("background fallback becomes viewport-cover", () => {
  const node = {
    id: "login.background",
    kind: "image",
    src: "./assets/backgrounds/background.jpg",
    x: -1.48,
    y: 3.95,
    width: 389.54,
    height: 828.1
  };
  enforceViewportBackgroundLayout(node);
  assert.equal(node.layout?.mode, "viewport-cover");
});

test("viewport-cover background covers the physical viewport", () => {
  for (const host of viewports) {
    const metrics = computeViewportMetrics(host, reference);
    const layout = resolveViewportNodeLayout(
      {
        id: "login.background",
        kind: "image",
        src: "./assets/backgrounds/background.jpg",
        x: -1.48,
        y: 3.95,
        width: 389.54,
        height: 828.1,
        layout: { mode: "viewport-cover" }
      },
      {
        reference,
        logicalViewport: metrics.logicalViewport,
        sceneOffset: metrics.sceneOffset
      }
    );

    assert.ok(
      layout.width * metrics.viewportScale + 0.001 >= host.width,
      `background width regressed for ${host.width}x${host.height}`
    );
    assert.ok(
      layout.height * metrics.viewportScale + 0.001 >= host.height,
      `background height regressed for ${host.width}x${host.height}`
    );
  }
});

async function collectSceneFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectSceneFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".scene.json")) files.push(path);
  }
  return files;
}

test("committed scene backgrounds explicitly declare viewport-cover", async () => {
  const sceneDir = join(root, "src", "scenes");
  const files = await collectSceneFiles(sceneDir);
  assert.ok(files.length > 0, "no committed scene files found");

  for (const file of files) {
    const scene = JSON.parse(await readFile(file, "utf8"));
    for (const node of scene.nodes || []) {
      const src = String(node?.src || "");
      const isBackground = node?.kind === "image" && (
        src.startsWith("./assets/backgrounds/") ||
        String(node?.id || "").endsWith(".background")
      );
      if (!isBackground) continue;
      assert.equal(
        node.layout?.mode,
        "viewport-cover",
        `${relative(root, file)} -> ${node.id} must use viewport-cover`
      );
    }
  }
});


test("DEV toolbar remains horizontally reachable on narrow viewports", async () => {
  const css = await readFile(join(root, "src", "styles", "app.css"), "utf8");
  assert.match(css, /\.tq-dev\{[^}]*max-width:calc\(100vw - 12px\)/);
  assert.match(css, /\.tq-dev__bar\{[^}]*overflow-x:auto/);
  assert.match(css, /\.tq-dev__bar>button\{flex:0 0 auto\}/);
  assert.match(css, /\[data-drag\]\{position:sticky;left:0/);
  assert.match(css, /\[data-collapse\]\{position:sticky;right:0/);
});
