/**
 * Isolated ML cutout worker. Runs outside the Next.js process so onnxruntime /
 * nested sharp cannot crash the dev server.
 *
 * Usage: node scripts/cutout-worker.mjs <inputPath> <outputPath>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { removeBackground } from "@imgly/background-removal-node";
import sharp from "sharp";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/cutout-worker.mjs <input> <output.webp>");
  process.exit(2);
}

const sourceBytes = readFileSync(inputPath);

const resized = await sharp(sourceBytes, {
  failOn: "error",
  limitInputPixels: 12_000_000,
})
  .rotate()
  .resize({
    width: 512,
    height: 640,
    fit: "inside",
    withoutEnlargement: true,
  })
  .jpeg({ quality: 92 })
  .toBuffer();

const cutoutBlob = await removeBackground(
  new Blob([resized], { type: "image/jpeg" }),
  {
    model: "medium",
    output: { format: "image/png", quality: 0.92 },
  },
);
const cutoutBytes = Buffer.from(await cutoutBlob.arrayBuffer());

const { data, info } = await sharp(cutoutBytes)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const count = info.width * info.height;
for (let i = 0; i < count; i++) {
  const o = i * 4;
  const a = data[o + 3];
  if (a === 0 || a === 255) continue;

  const r = data[o];
  const g = data[o + 1];
  const b = data[o + 2];
  const lum = (r + g + b) / 3;

  // Only kill chalky near-transparent fringe. Do not despill higher-alpha
  // glass — that eats clear bottles (Khamrah / Angels' Share).
  if (a < 36 && lum > 200) {
    data[o + 3] = 0;
    continue;
  }

  if (a < 96) {
    const t = a / 255;
    data[o] = Math.round(r * t);
    data[o + 1] = Math.round(g * t);
    data[o + 2] = Math.round(b * t);
  }
}

const out = await sharp(data, {
  raw: {
    width: info.width,
    height: info.height,
    channels: 4,
  },
})
  .webp({ quality: 92, alphaQuality: 100 })
  .toBuffer();

writeFileSync(outputPath, out);
