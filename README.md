# AI Image Pipeline

Generate multiple style variations of an image prompt in parallel, with automatic crash recovery.

Fan-out to 3 parallel generators simultaneously. If one fails, Resonate retries it automatically while the others complete. All results are collected durably.

## What This Demonstrates

- **Parallel fan-out**: 3 image generations start simultaneously via `ctx.beginRun()`
- **Fan-in**: results collected as each completes, not one-at-a-time
- **Crash recovery**: if one generator fails, Resonate retries it; others continue uninterrupted
- **Speed**: wall time is max(individual times), not sum -- 1200ms not 3000ms

## Prerequisites

- [Bun](https://bun.sh) v1.0+

No external services, no API keys, no GPU. Generators are simulated -- swap in your real provider.

## Setup

```bash
git clone https://github.com/resonatehq-examples/example-ai-image-pipeline-ts
cd example-ai-image-pipeline-ts
bun install
```

## Run It

**Happy path** -- 3 styles in parallel:
```bash
bun start
```

```
=== Resonate AI Image Pipeline ===
Mode: HAPPY PATH

Prompt: "A futuristic city skyline at sunset with flying cars"
Launching 3 style variations in parallel...

[photorealistic]   Generating image (attempt 1)...
[cartoon]   Generating image (attempt 1)...
[abstract]   Generating image (attempt 1)...
[cartoon]   Done: https://images.example.com/cartoon-QSBmdXR1.png
[abstract]   Done: https://images.example.com/abstract-QSBmdXR1.png
[photorealistic]   Done: https://images.example.com/photorealistic-QSBmdXR1.png

=== Results ===
  photorealistic  https://images.example.com/photorealistic-QSBmdXR1.png
  cartoon         https://images.example.com/cartoon-QSBmdXR1.png
  abstract        https://images.example.com/abstract-QSBmdXR1.png

Wall time:        1217ms  (parallel execution)
Sequential would: 3000ms
```

**Crash mode** -- one generator fails and retries while others continue:
```bash
bun start:crash
```

```
=== Resonate AI Image Pipeline ===
Mode: CRASH (abstract style will fail on first attempt)

Prompt: "A futuristic city skyline at sunset with flying cars"
Launching 3 style variations in parallel...

[photorealistic]   Generating image (attempt 1)...
[cartoon]   Generating image (attempt 1)...
[abstract]   Generating image (attempt 1)...
Runtime. Function 'generateImage' failed with 'Error: Image generation service timeout for style 'abstract'' (retrying in 2 secs)
[cartoon]   Done: https://images.example.com/cartoon-QSBmdXR1.png
[photorealistic]   Done: https://images.example.com/photorealistic-QSBmdXR1.png
[abstract]   Generating image (attempt 2)...
[abstract]   Done: https://images.example.com/abstract-QSBmdXR1.png

=== Results ===
  photorealistic  https://images.example.com/photorealistic-QSBmdXR1.png
  cartoon         https://images.example.com/cartoon-QSBmdXR1.png
  abstract        https://images.example.com/abstract-QSBmdXR1.png

Wall time:        3319ms  (parallel execution)
Sequential would: 3000ms
```

**Notice**: the `Runtime. Function ... failed (retrying in 2 secs)` line comes from Resonate. You wrote zero retry logic. Cartoon and photorealistic complete while abstract retries.

## What to Observe

1. **All three start at the same time**: the first three log lines appear together before any complete.
2. **No sequential waiting**: cartoon completes at 800ms while photorealistic is still at 1200ms.
3. **Failure isolation**: abstract's failure does not block or cancel the others.
4. **No code changes for retry**: the same `generateImage` function handles both happy path and retry.

## The Code

The entire pipeline is 20 lines in `src/workflow.ts`:

```typescript
export function* runImagePipeline(ctx: Context, prompt: string, crashMode: boolean) {
  // Fan-out: all three start simultaneously
  const futures = [];
  for (const style of ['photorealistic', 'cartoon', 'abstract']) {
    const future = yield* ctx.beginRun(generateImage, prompt, style, crashMode);
    futures.push(future);
  }

  // Fan-in: collect results as they complete
  const images = [];
  for (const future of futures) {
    const image = yield* future;  // waits for this one
    images.push(image);
  }

  return { prompt, images };
}
```

That's the entire fan-out/fan-in pattern. `beginRun` starts without blocking. `yield* future` waits.

## Using Real Providers

Replace the simulated `generateImage` in `src/providers.ts` with real API calls:

```typescript
export async function generateImage(_ctx: Context, prompt: string, style: string) {
  // Replace with: OpenAI DALL-E, Stability AI, Midjourney, Replicate, etc.
  const response = await openai.images.generate({
    prompt: `${prompt}, ${style} style`,
    n: 1,
    size: '1024x1024',
  });
  return { style, url: response.data[0].url };
}
```

The durability story is identical. Resonate retries the failed API call automatically.

## File Structure

```
example-ai-image-pipeline-ts/
|-  src/
|   |-  index.ts      Entry point -- pipeline invocation and results display
|   |-  workflow.ts   runImagePipeline -- fan-out/fan-in with beginRun()
|   |-  providers.ts  generateImage -- simulated AI generation (swap for real API)
|-  package.json
|-  tsconfig.json
```

**Lines of code**: ~120 total. The workflow itself is 20 lines.

## Why a generator handles fan-out/fan-in

Fan-out/fan-in often implies orchestration infrastructure: a workflow engine, per-service registrations, a scheduler that tracks which branch finished. This example skips all of that.

`ctx.beginRun()` starts a branch without blocking and returns a future. `yield* future` waits for one specific branch without blocking the others. Fan-in is a loop over the futures array. If one generator throws, Resonate retries it independently — the other branches keep running.

The orchestration primitive is the generator itself. The scheduler is the event loop. The state machine is whatever the function closure already carried. ~120 LOC of source, 20 lines of workflow logic, no external server for development.

Swap the simulated provider for a real one (DALL-E, Stability AI, Midjourney, Replicate) and the durability contract doesn't change — `ctx.run()` still retries the call, `ctx.beginRun()` still parallelizes, results are still durable.

## Learn More

- [Resonate documentation](https://docs.resonatehq.io)
- [Fan-out/fan-in example](https://github.com/resonatehq-examples/example-fan-out-fan-in-ts) -- the same primitive in its minimal shape
