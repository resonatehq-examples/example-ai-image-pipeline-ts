import type { Context } from "@resonatehq/sdk";
import { generateImage } from "./providers.js";
import type { GeneratedImage } from "./providers.js";

// ---------------------------------------------------------------------------
// AI Image Pipeline — Fan-Out / Fan-In
// ---------------------------------------------------------------------------
// Given a text prompt, generates multiple style variations in PARALLEL.
// Each generation is a durable checkpoint: if one fails, Resonate retries it
// automatically. The others continue uninterrupted.
//
// This is the fan-out/fan-in pattern:
//   beginRun() starts work without blocking — all three start simultaneously
//   yield* future waits for each result — fan-in collects them all
//
// The alternative (sequential) would be 3x slower:
//   yield* ctx.run(generateImage, prompt, "photorealistic") // wait...
//   yield* ctx.run(generateImage, prompt, "cartoon")        // wait...
//   yield* ctx.run(generateImage, prompt, "abstract")       // wait...
//
// With fan-out, total time ≈ max(individual times), not sum.

const STYLES = ["photorealistic", "cartoon", "abstract"] as const;

export interface PipelineResult {
  prompt: string;
  images: GeneratedImage[];
  totalMs: number;
}

export function* runImagePipeline(
  ctx: Context,
  prompt: string,
  crashMode: boolean,
): Generator<any, PipelineResult, any> {
  // Note: code outside ctx.run() re-executes on each replay step.
  // Log messages live in generateImage() (inside ctx.run) so they print once.

  // Fan-out: start all generations simultaneously
  // beginRun() returns a handle immediately — doesn't wait for completion
  const futures = [];
  for (const style of STYLES) {
    const future = yield* ctx.beginRun(generateImage, prompt, style, crashMode);
    futures.push({ style, future });
  }

  // Fan-in: wait for each result
  // If any generation fails, Resonate retries it. The others continue.
  const images: GeneratedImage[] = [];
  for (const { future } of futures) {
    const image = yield* future;
    images.push(image);
  }

  return { prompt, images, totalMs: images.reduce((s, i) => s + i.durationMs, 0) };
}
