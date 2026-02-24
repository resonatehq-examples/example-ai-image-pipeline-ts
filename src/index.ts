import { Resonate } from "@resonatehq/sdk";
import { runImagePipeline } from "./workflow.js";

// ---------------------------------------------------------------------------
// Resonate setup — two lines
// ---------------------------------------------------------------------------

const resonate = new Resonate();
resonate.register(runImagePipeline);

// ---------------------------------------------------------------------------
// Run the pipeline
// ---------------------------------------------------------------------------

const crashMode = process.argv.includes("--crash");
const prompt =
  process.argv.find((a) => a.startsWith("--prompt="))?.slice(9) ??
  "A futuristic city skyline at sunset with flying cars";

console.log("=== Resonate AI Image Pipeline ===");
console.log(
  `Mode: ${crashMode ? "CRASH (abstract style will fail on first attempt)" : "HAPPY PATH"}`,
);
console.log();

const pipelineId = `pipeline-${Date.now()}`;
const wallStart = Date.now();

console.log(`Prompt: "${prompt}"`);
console.log(`Launching 3 style variations in parallel...\n`);

const result = await resonate.run(pipelineId, runImagePipeline, prompt, crashMode);

const wallMs = Date.now() - wallStart;

console.log("\n=== Results ===");
for (const image of result.images) {
  console.log(`  ${image.style.padEnd(15)} ${image.url}`);
}
console.log(`\nWall time:        ${wallMs}ms  (parallel execution)`);
console.log(`Sequential would: ${result.images.reduce((s, i) => s + i.durationMs, 0)}ms`);

resonate.stop();
