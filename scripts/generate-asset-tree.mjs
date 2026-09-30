import { readdir, mkdir, writeFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";

const ROOT = "assets";
const OUTPUT = "src/config/asset-tree.json";
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"]);

const toPosix = value => value.split(sep).join("/");

async function scanDirectory(absolutePath) {
  const entries = await readdir(absolutePath, { withFileTypes: true });
  const children = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name.toLowerCase() === "readme.md") continue;

    const fullPath = join(absolutePath, entry.name);
    const repoPath = toPosix(relative(".", fullPath));

    if (entry.isDirectory()) {
      children.push({
        type: "directory",
        name: entry.name,
        path: repoPath,
        children: await scanDirectory(fullPath)
      });
      continue;
    }

    if (!entry.isFile()) continue;
    if (!IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;

    children.push({
      type: "image",
      name: entry.name,
      path: repoPath
    });
  }

  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name, "pt-BR", { numeric: true, sensitivity: "base" });
  });

  return children;
}

const root = {
  type: "directory",
  name: "assets",
  path: "assets",
  children: await scanDirectory(ROOT)
};

const flattenImages = node => node.type === "image"
  ? [node]
  : node.children.flatMap(flattenImages);

const manifest = {
  schema: "tq.asset-tree",
  version: 1,
  generatedFrom: "repository-filesystem",
  root,
  assets: flattenImages(root)
};

await mkdir("src/config", { recursive: true });
await writeFile(OUTPUT, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Generated ${OUTPUT}: ${manifest.assets.length} images`);
