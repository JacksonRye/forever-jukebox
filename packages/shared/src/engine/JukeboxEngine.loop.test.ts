import { describe, expect, it, vi } from "vitest";

vi.mock("../background/backgroundTimer", () => ({
  backgroundSetTimeout: (
    callback: (...args: unknown[]) => void,
    delay?: number,
    ...args: unknown[]
  ) => globalThis.setTimeout(callback, delay, ...args),
  backgroundClearTimeout: (id: number) => globalThis.clearTimeout(id),
}));

import { JukeboxEngine, type JukeboxPlayer } from "./JukeboxEngine";
import type { Edge, QuantumBase, TrackAnalysis } from "./types";

function makeBeat(which: number): QuantumBase {
  return {
    start: which * 0.5,
    duration: 0.5,
    which,
    prev: null,
    next: null,
    overlappingSegments: [],
    neighbors: [],
    allNeighbors: [],
  };
}

function linkBeats(beats: QuantumBase[]) {
  beats.forEach((beat, idx) => {
    beat.prev = idx > 0 ? beats[idx - 1] : null;
    beat.next = idx < beats.length - 1 ? beats[idx + 1] : null;
  });
}

function makeAnalysis(beats: QuantumBase[]): TrackAnalysis {
  return {
    sections: [
      { start: 0, duration: 2.5, confidence: 1 } as unknown as QuantumBase,
      { start: 2.5, duration: 2.5, confidence: 1 } as unknown as QuantumBase,
    ],
    bars: [],
    beats,
    tatums: [],
    segments: [],
    track: {},
  };
}

function makeMockPlayer(): JukeboxPlayer & {
  scheduledJumps: Array<{ targetTime: number; sourceBoundaryTime: number }>;
} {
  const scheduledJumps: Array<{
    targetTime: number;
    sourceBoundaryTime: number;
  }> = [];
  return {
    scheduledJumps,
    scheduleJump: vi.fn(
      (targetTime: number, sourceBoundaryTime: number) => {
        scheduledJumps.push({ targetTime, sourceBoundaryTime });
        return true;
      },
    ),
    seek: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    getAudioTime: vi.fn(() => 0),
    getPlaybackRate: vi.fn(() => 1),
    cancelScheduledJump: vi.fn(),
    isPlaying: vi.fn(() => false),
  };
}

function addEdge(
  src: QuantumBase,
  dest: QuantumBase,
  distance = 10,
  id = 1,
): Edge {
  const edge: Edge = {
    id,
    src,
    dest,
    distance,
    deleted: false,
  };
  src.neighbors.push(edge);
  src.allNeighbors.push(edge);
  return edge;
}

function setupEngine(
  beats: QuantumBase[],
  edges: Edge[] = [],
  options: any = {},
) {
  linkBeats(beats);
  const player = makeMockPlayer();
  const engine = new JukeboxEngine(player, options);
  const analysis = makeAnalysis(beats);
  const graph: any = {
    computedThreshold: 100,
    currentThreshold: 100,
    lastBranchPoint: 0,
    totalBeats: beats.length,
    longestReach: 0,
    allEdges: edges,
  };
  const engineAny = engine as any;
  engineAny.analysis = analysis;
  engineAny.graph = graph;
  engineAny.beats = beats;
  return { engine, player, engineAny };
}

describe("JukeboxEngine - Section Looping", () => {
  it("computes section spans with beat indices accurately", () => {
    const beats = Array.from({ length: 10 }, (_, i) => makeBeat(i));
    const { engine } = setupEngine(beats);

    const sections = engine.getSectionsWithBeats();
    expect(sections.length).toBe(2);
    expect(sections[0].startBeatIndex).toBe(0);
    expect(sections[0].endBeatIndex).toBe(4);
    expect(sections[0].beatCount).toBe(5);

    expect(sections[1].startBeatIndex).toBe(5);
    expect(sections[1].endBeatIndex).toBe(9);
    expect(sections[1].beatCount).toBe(5);
  });

  it("getLoopRange and setLoopRange properly update and clamp range", () => {
    const beats = Array.from({ length: 20 }, (_, i) => makeBeat(i));
    const { engine } = setupEngine(beats);

    expect(engine.getLoopRange()).toBeNull();

    engine.setLoopRange({ startBeatIndex: 4, endBeatIndex: 12 });
    expect(engine.getLoopRange()).toEqual({
      startBeatIndex: 4,
      endBeatIndex: 12,
    });

    // Out of bounds clamp
    engine.setLoopRange({ startBeatIndex: -5, endBeatIndex: 100 });
    expect(engine.getLoopRange()).toEqual({
      startBeatIndex: 0,
      endBeatIndex: 19,
    });

    // Clear
    engine.setLoopRange(null);
    expect(engine.getLoopRange()).toBeNull();
  });

  it("wraps around to startBeatIndex when reaching endBeatIndex", () => {
    const beats = Array.from({ length: 10 }, (_, i) => makeBeat(i));
    const { engine, engineAny } = setupEngine(beats, [], {
      branchProbability: 0,
      minRandomBranchChance: 0,
    });

    // Set loop range for beats 2 to 5
    engine.setLoopRange({ startBeatIndex: 2, endBeatIndex: 5 });

    // Set current beat index to 5 (the end of the loop)
    engineAny.currentBeatIndex = 5;

    // Plan advance from beat 5
    const advance = engineAny.createPendingAdvance(beats[5].start, true);
    expect(advance).not.toBeNull();
    // Should jump back to start of loop: beat 2
    expect(advance.chosenIndex).toBe(2);
    expect(advance.shouldJump).toBe(true);
    expect(advance.targetTime).toBe(beats[2].start);
  });

  it("confines branching within loop range and ignores branches leading outside", () => {
    const beats = Array.from({ length: 15 }, (_, i) => makeBeat(i));

    // Edge from beat 2 -> beat 12 (outside loop [2, 6])
    const outEdge = addEdge(beats[2], beats[12], 5, 101);
    // Edge from beat 2 -> beat 4 (inside loop [2, 6])
    const inEdge = addEdge(beats[2], beats[4], 8, 102);

    const { engine, engineAny } = setupEngine(beats, [outEdge, inEdge], {
      config: {
        minRandomBranchChance: 1,
        maxRandomBranchChance: 1,
      },
    });
    engineAny.curRandomBranchChance = 1;
    engineAny.branchState.curRandomBranchChance = 1;
    engine.setLoopRange({ startBeatIndex: 1, endBeatIndex: 6 });
    engineAny.currentBeatIndex = 1; // advancing to seed index 2
    engineAny.forceBranch = true;
    const advance = engineAny.createPendingAdvance(beats[1].start, true);
    expect(advance).not.toBeNull();
    expect(advance.chosenIndex).toBe(4);
    expect(advance.selectedBranch).toBe(true);
  });
});
