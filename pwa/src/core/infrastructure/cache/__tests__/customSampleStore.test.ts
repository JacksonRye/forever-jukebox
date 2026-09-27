import { describe, it, expect, beforeEach } from "vitest";
import {
  clearAllStoredCustomSamples,
  deleteStoredCustomSample,
  getStoredCustomSamples,
  saveStoredCustomSample,
  type StoredCustomSample,
} from "../customSampleStore";

describe("customSampleStore", () => {
  beforeEach(async () => {
    await clearAllStoredCustomSamples();
  });

  it("saves, retrieves, and deletes custom samples", async () => {
    const sample1: StoredCustomSample = {
      id: "sample-1",
      name: "airhorn",
      data: new Uint8Array([1, 2, 3, 4]).buffer,
      createdAt: 1000,
      duration: 1.2,
    };
    const sample2: StoredCustomSample = {
      id: "sample-2",
      name: "laser_blast",
      data: new Uint8Array([5, 6, 7, 8]).buffer,
      createdAt: 2000,
      duration: 0.8,
    };

    await saveStoredCustomSample(sample1);
    await saveStoredCustomSample(sample2);

    const stored = await getStoredCustomSamples();
    expect(stored).toHaveLength(2);
    expect(stored[0]?.id).toBe("sample-1");
    expect(stored[1]?.id).toBe("sample-2");

    await deleteStoredCustomSample("sample-1");
    const remaining = await getStoredCustomSamples();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe("sample-2");

    await clearAllStoredCustomSamples();
    const empty = await getStoredCustomSamples();
    expect(empty).toHaveLength(0);
  });
});
