import { describe, expect, it } from "vitest";
import { renderSwingChannels } from "./swingRenderer";
import type { TimeStretchAdapter } from "./timeStretch";

class FakeStretchAdapter implements TimeStretchAdapter {
  calls: Array<{ inputFrames: number; targetFrameCount: number }> = [];

  async stretchSegment(
    channels: Float32Array[],
    _sampleRate: number,
    targetFrameCount: number,
  ): Promise<Float32Array[]> {
    this.calls.push({
      inputFrames: channels[0]?.length ?? 0,
      targetFrameCount,
    });
    return channels.map((channel) => {
      const stretched = new Float32Array(targetFrameCount);
      for (let index = 0; index < targetFrameCount; index += 1) {
        stretched[index] = channel[Math.min(index, channel.length - 1)] ?? 0;
      }
      return stretched;
    });
  }
}

describe("renderSwingChannels", () => {
  it("copies audio outside beats and preserves total frame count", async () => {
    const adapter = new FakeStretchAdapter();
    const source = Float32Array.from({ length: 10 }, (_, index) => index);

    const [rendered] = await renderSwingChannels(
      [source],
      10,
      [{ start: 0.2, duration: 0.4 }],
      { adapter },
    );

    expect(rendered).toHaveLength(source.length);
    expect(rendered?.[0]).toBe(0);
    expect(rendered?.[1]).toBe(1);
    expect(rendered?.[6]).toBe(6);
    expect(rendered?.[9]).toBe(9);
  });

  it("splits each beat into fixed swing target frame counts", async () => {
    const adapter = new FakeStretchAdapter();
    const source = Float32Array.from({ length: 100 }, (_, index) => index);

    await renderSwingChannels(
      [source],
      100,
      [{ start: 0, duration: 1 }],
      { adapter },
    );

    expect(adapter.calls).toEqual([
      { inputFrames: 50, targetFrameCount: 67 },
      { inputFrames: 50, targetFrameCount: 33 },
    ]);
  });

  it("renders all channels with the same output geometry", async () => {
    const adapter = new FakeStretchAdapter();
    const left = Float32Array.from({ length: 20 }, (_, index) => index);
    const right = Float32Array.from({ length: 20 }, (_, index) => index + 100);

    const rendered = await renderSwingChannels(
      [left, right],
      20,
      [{ start: 0, duration: 1 }],
      { adapter },
    );

    expect(rendered).toHaveLength(2);
    expect(rendered[0]).toHaveLength(20);
    expect(rendered[1]).toHaveLength(20);
    expect(adapter.calls).toEqual([
      { inputFrames: 10, targetFrameCount: 13 },
      { inputFrames: 10, targetFrameCount: 7 },
    ]);
  });

  it("reports progress as beat segments complete", async () => {
    const adapter = new FakeStretchAdapter();
    const progress: number[] = [];
    const source = Float32Array.from({ length: 20 }, (_, index) => index);

    await renderSwingChannels(
      [source],
      10,
      [
        { start: 0, duration: 1 },
        { start: 1, duration: 1 },
      ],
      {
        adapter,
        onProgress: (value) => progress.push(value),
      },
    );

    expect(progress).toEqual([0, 0.25, 0.5, 0.75, 1, 1]);
  });

  it("applies a tiny equal-power envelope around rendered joins", async () => {
    const adapter = new FakeStretchAdapter();
    const source = Float32Array.from({ length: 100 }, () => 1);

    const [rendered] = await renderSwingChannels(
      [source],
      1000,
      [{ start: 0, duration: 0.1 }],
      { adapter },
    );

    expect(rendered?.[62]).toBe(1);
    expect(rendered?.[66]).toBeLessThan(1);
    expect(rendered?.[67]).toBeLessThan(1);
    expect(rendered?.[71]).toBe(1);
  });

  it("gracefully falls back to linear resampling if adapter stretch fails on a segment", async () => {
    const failingAdapter: TimeStretchAdapter = {
      stretchSegment: () => {
        throw new Error("Simulated Rubber Band worker crash on problematic beat");
      },
    };
    const source = Float32Array.from({ length: 100 }, (_, index) => index);

    // Must not throw, and should return a complete rendered buffer
    const [rendered] = await renderSwingChannels(
      [source],
      100,
      [{ start: 0, duration: 1 }],
      { adapter: failingAdapter },
    );

    expect(rendered).toHaveLength(100);
    // Linear resample should have filled values
    expect(Number.isFinite(rendered?.[0])).toBe(true);
    expect(Number.isFinite(rendered?.[50])).toBe(true);
    expect(Number.isFinite(rendered?.[99])).toBe(true);
  });

  it("gracefully handles invalid, NaN, or non-finite beats without failing", async () => {
    const adapter = new FakeStretchAdapter();
    const source = Float32Array.from({ length: 100 }, (_, index) => index);

    const [rendered] = await renderSwingChannels(
      [source],
      100,
      [
        { start: NaN, duration: NaN },
        { start: 0, duration: -5 },
        { start: 0, duration: 0 },
        { start: 0.2, duration: 0.4 },
      ],
      { adapter },
    );

    expect(rendered).toHaveLength(100);
    // Only the valid beat should have been passed to the adapter
    expect(adapter.calls).toHaveLength(2);
  });

  it("clamps beats that extend slightly past source buffer length", async () => {
    const adapter = new FakeStretchAdapter();
    const source = Float32Array.from({ length: 100 }, (_, index) => index);

    // Audio is 1.0s (100 frames at 100Hz), beat ends at 1.1s (110 frames)
    const [rendered] = await renderSwingChannels(
      [source],
      100,
      [{ start: 0.8, duration: 0.3 }],
      { adapter },
    );

    expect(rendered).toHaveLength(100);
    // The beat starts at 80 and ends clamped at 100 (20 frames total)
    expect(adapter.calls).toEqual([
      { inputFrames: 10, targetFrameCount: 13 },
      { inputFrames: 10, targetFrameCount: 7 },
    ]);
  });
});
