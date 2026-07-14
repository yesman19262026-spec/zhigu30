import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");
const assets = ["index.html", "styles.css", "market-config.js", "manifest.webmanifest", "sw.js", "assets"];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const asset of assets) {
  await cp(resolve(root, asset), resolve(dist, asset), { recursive: true });
}

await mkdir(resolve(dist, "data"), { recursive: true });
await cp(resolve(root, "data", "market-snapshot.json"), resolve(dist, "data", "market-snapshot.json"));
await cp(resolve(root, "data", "live-market.json"), resolve(dist, "data", "live-market.json"));

// 将课程数据与界面程序合并为一个文件，避免静态托管时因独立数据文件丢失而白屏。
const [courses, app] = await Promise.all([
  readFile(resolve(root, "data", "courses.js"), "utf8"),
  readFile(resolve(root, "app.js"), "utf8")
]);
await writeFile(resolve(dist, "app.js"), `${courses}\n\n${app}`, "utf8");

console.log(`Prepared ${assets.length + 2} frontend assets in ${dist}`);
