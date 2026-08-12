/**
 * Builds contact sheets from the design-evidence screenshots.
 *
 * The screenshot matrix only earns its cost if someone LOOKS at the output, and
 * several hundred full-page PNGs is not a reviewable artefact. This lays them
 * out in labelled grids so a whole role, viewport and theme can be taken in at
 * once, and anything that looks wrong can then be opened at full resolution.
 *
 * Each cell is captioned with the route and the TRUE full-page height, because
 * the thumbnail is cropped to its top band: a page that renders 9000px tall is
 * usually a layout defect, and cropping would otherwise hide exactly that.
 *
 *   node scripts/contact-sheet.mjs <screens-dir> <out-dir>
 *
 * Reads nothing but the PNGs it is pointed at. Uses sharp, already present as a
 * Next.js dependency — no new package, no network.
 */
import sharp from "sharp";
import { readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [, , SRC = "e2e/.artifacts/screens", OUT = "e2e/.artifacts/sheets"] = process.argv;

const CELL_W = 380;
const CELL_H = 520;
const LABEL_H = 26;
const COLS = 4;
const PAD = 8;
const BG = { r: 24, g: 26, b: 30, alpha: 1 };

/** Caption strip. Escaped, because route names travel into SVG markup. */
function label(text, sub) {
  const esc = (s) =>
    String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
  return Buffer.from(
    `<svg width="${CELL_W}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg">
       <rect width="100%" height="100%" fill="#101216"/>
       <text x="6" y="18" font-family="monospace" font-size="13" fill="#e8eef6">${esc(text)}</text>
       <text x="${CELL_W - 6}" y="18" text-anchor="end" font-family="monospace" font-size="11"
             fill="#8fa3ba">${esc(sub)}</text>
     </svg>`,
  );
}

/** One screenshot, scaled to the cell width and cropped to its top band. */
async function cell(file, name) {
  const img = sharp(file);
  const meta = await img.metadata();
  const scaled = sharp(await img.resize({ width: CELL_W }).png().toBuffer());
  const sMeta = await scaled.metadata();

  // Crop rather than squash. A full-page shot can be 10x the cell height, and
  // fitting it whole would reduce every page to an unreadable strip.
  const body = await scaled
    .extract({ left: 0, top: 0, width: CELL_W, height: Math.min(CELL_H, sMeta.height) })
    .toBuffer();

  const tall = meta.height > 3000 ? " ⚠tall" : "";
  return sharp({
    create: { width: CELL_W, height: CELL_H + LABEL_H, channels: 4, background: BG },
  })
    .composite([
      { input: label(name, `${meta.width}x${meta.height}${tall}`), top: 0, left: 0 },
      { input: body, top: LABEL_H, left: 0 },
    ])
    .png()
    .toBuffer();
}

async function sheet(files, outFile) {
  const cells = [];
  for (const f of files) cells.push({ buf: await cell(f.file, f.name), ...f });

  const rows = Math.ceil(cells.length / COLS);
  const W = COLS * (CELL_W + PAD) + PAD;
  const H = rows * (CELL_H + LABEL_H + PAD) + PAD;

  await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
    .composite(
      cells.map((c, i) => ({
        input: c.buf,
        left: PAD + (i % COLS) * (CELL_W + PAD),
        top: PAD + Math.floor(i / COLS) * (CELL_H + LABEL_H + PAD),
      })),
    )
    .png({ compressionLevel: 9 })
    .toFile(outFile);

  return { outFile, count: cells.length };
}

const viewports = await readdir(SRC);
await mkdir(OUT, { recursive: true });
const index = [];

for (const vp of viewports) {
  for (const theme of await readdir(path.join(SRC, vp))) {
    const dir = path.join(SRC, vp, theme);
    const pngs = (await readdir(dir)).filter((f) => f.endsWith(".png")).sort();

    // Group by role so a sheet is one coherent thing to review.
    const byRole = new Map();
    for (const f of pngs) {
      const role = f.split("-")[0];
      if (!byRole.has(role)) byRole.set(role, []);
      byRole.get(role).push({
        file: path.join(dir, f),
        name: f.replace(/^[^-]+-/, "").replace(/\.png$/, ""),
      });
    }

    for (const [role, files] of byRole) {
      // Cap a sheet at 12 cells; beyond that the grid stops being scannable.
      for (let i = 0; i < files.length; i += 12) {
        const chunk = files.slice(i, i + 12);
        const part = files.length > 12 ? `-${i / 12 + 1}` : "";
        const out = path.join(OUT, `${vp}-${theme}-${role}${part}.png`);
        index.push(await sheet(chunk, out));
      }
    }
  }
}

await writeFile(
  path.join(OUT, "INDEX.txt"),
  index.map((i) => `${i.outFile}  (${i.count} screens)`).join("\n") + "\n",
);
console.log(`${index.length} sheets, ${index.reduce((n, i) => n + i.count, 0)} screens`);
