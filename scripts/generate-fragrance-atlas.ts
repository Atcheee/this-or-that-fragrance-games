import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fragranceSimilarityVector } from "../src/lib/fragrance-similarity";

type SourceFragrance = {
  id: string;
  name: string;
  house: string;
  year: number;
  rating: number;
  votes?: number;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  accords: string[];
};

type Card = {
  id: string;
  slug: string;
};

const ROOT = process.cwd();
function dot(a: number[], b: number[]): number {
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result += a[index]! * b[index]!;
  return result;
}

function principalComponent(matrix: number[][], blocked?: number[]): number[] {
  const dimensions = matrix[0]!.length;
  let axis = Array.from({ length: dimensions }, (_, index) =>
    Math.sin((index + 1) * 1.618),
  );

  for (let iteration = 0; iteration < 80; iteration += 1) {
    const next = Array(dimensions).fill(0) as number[];
    for (const row of matrix) {
      const projection = dot(row, axis);
      for (let index = 0; index < dimensions; index += 1) {
        next[index] += row[index]! * projection;
      }
    }
    if (blocked) {
      const overlap = dot(next, blocked);
      for (let index = 0; index < dimensions; index += 1) {
        next[index] -= overlap * blocked[index]!;
      }
    }
    const length = Math.sqrt(dot(next, next)) || 1;
    axis = next.map((value) => value / length);
  }
  return axis;
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)] ?? 0;
}

async function main() {
  const [raw, cardsRaw] = await Promise.all([
    readFile(path.join(ROOT, "src/data/fragrances.json"), "utf8"),
    readFile(path.join(ROOT, "src/data/generated/fragrance-cards.json"), "utf8"),
  ]);
  const fragrances = JSON.parse(raw) as SourceFragrance[];
  const cards = JSON.parse(cardsRaw) as Card[];
  const slugs = new Map(cards.map((card) => [card.id, card.slug]));
  const matrix = fragrances.map(fragranceSimilarityVector);
  const dimensions = matrix[0]!.length;
  const means = Array(dimensions).fill(0) as number[];
  const deviations = Array(dimensions).fill(0) as number[];

  for (const row of matrix) {
    for (let index = 0; index < dimensions; index += 1) means[index] += row[index]!;
  }
  for (let index = 0; index < dimensions; index += 1) means[index] /= matrix.length;
  for (const row of matrix) {
    for (let index = 0; index < dimensions; index += 1) {
      deviations[index] += (row[index]! - means[index]!) ** 2;
    }
  }
  for (let index = 0; index < dimensions; index += 1) {
    deviations[index] = Math.sqrt(deviations[index]! / matrix.length) || 1;
  }
  for (const row of matrix) {
    for (let index = 0; index < dimensions; index += 1) {
      row[index] = (row[index]! - means[index]!) / deviations[index]!;
    }
  }

  const xAxis = principalComponent(matrix);
  const yAxis = principalComponent(matrix, xAxis);
  const rawX = matrix.map((row) => dot(row, xAxis));
  const rawY = matrix.map((row) => dot(row, yAxis));
  const xLow = percentile(rawX, 0.01);
  const xHigh = percentile(rawX, 0.99);
  const yLow = percentile(rawY, 0.01);
  const yHigh = percentile(rawY, 0.99);
  const scale = (value: number, low: number, high: number) =>
    Math.max(-1.08, Math.min(1.08, ((value - low) / (high - low)) * 2 - 1));

  const points = fragrances.map((fragrance, index) => ({
    i: fragrance.id,
    n: fragrance.name,
    h: fragrance.house,
    s: slugs.get(fragrance.id) ?? fragrance.id,
    x: Number(scale(rawX[index]!, xLow, xHigh).toFixed(4)),
    y: Number(scale(rawY[index]!, yLow, yHigh).toFixed(4)),
    yr: fragrance.year,
    rt: fragrance.rating,
    v: fragrance.votes ?? 0,
    a: fragrance.accords.slice(0, 8),
    nt: [...new Set([
      ...fragrance.topNotes,
      ...fragrance.heartNotes,
      ...fragrance.baseNotes,
    ])].slice(0, 18),
  }));

  const output = path.join(ROOT, "public/data/fragrance-atlas.json");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ version: 1, points }));
  console.log(`Generated atlas coordinates for ${points.length.toLocaleString()} fragrances.`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
