import type { Context } from "@resonatehq/sdk";

export interface GeneratedImage {
  style: string;
  url: string;
  durationMs: number;
}

// Track generation attempts per (prompt+style) key — same pattern as food-delivery crash demo
const generateAttempts: Record<string, number> = {};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Simulated image generation providers
// ---------------------------------------------------------------------------
// In production, these would call DALL-E, Stable Diffusion, Midjourney, etc.
// They're simulated here so the example runs without API keys or GPU access.
// The durability story is identical regardless — each is a durable checkpoint.

export async function generateImage(
  _ctx: Context,
  prompt: string,
  style: string,
  crashOnFirstAttempt: boolean,
): Promise<GeneratedImage> {
  const key = `${style}:${prompt}`;
  generateAttempts[key] = (generateAttempts[key] ?? 0) + 1;
  const attempt = generateAttempts[key]!;

  const styleDurations: Record<string, number> = {
    photorealistic: 1200,
    cartoon: 800,
    abstract: 1000,
  };

  const ms = styleDurations[style] ?? 1000;
  console.log(`[${style}]   Generating image (attempt ${attempt})...`);

  // In crash demo, the "abstract" style fails on first attempt
  if (crashOnFirstAttempt && style === "abstract" && attempt === 1) {
    await sleep(300);
    throw new Error(`Image generation service timeout for style '${style}'`);
  }

  // Simulate generation time
  await sleep(ms);

  // Return a deterministic fake URL (stable for same prompt+style)
  const hash = Buffer.from(`${prompt}:${style}`).toString("base64").slice(0, 8);
  const url = `https://images.example.com/${style}-${hash}.png`;

  console.log(`[${style}]   Done: ${url}`);
  return { style, url, durationMs: ms };
}
