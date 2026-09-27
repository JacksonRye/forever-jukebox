import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { CustomSampleModal } from "./CustomSampleModal";
import type { CowbellOverlayService } from "@forever-jukebox/shared/audio/CowbellOverlayService";
import * as sampleStore from "@/core/infrastructure/cache/customSampleStore";

vi.mock("@/core/infrastructure/cache/customSampleStore", () => ({
  getStoredCustomSamples: vi.fn(),
  saveStoredCustomSample: vi.fn(),
  deleteStoredCustomSample: vi.fn(),
  clearAllStoredCustomSamples: vi.fn(),
}));

describe("CustomSampleModal", () => {
  afterEach(() => {
    cleanup();
  });
  const mockContext = {
    currentTime: 0,
    decodeAudioData: vi.fn(async () => ({ duration: 1.5 } as AudioBuffer)),
  } as unknown as AudioContext;

  const mockOverlay = {
    addCustomSample: vi.fn(),
    removeCustomSample: vi.fn(),
    getCustomSamples: vi.fn(() => []),
    previewSample: vi.fn(),
    triggerVoiceSample: vi.fn(() => true),
  } as unknown as CowbellOverlayService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sampleStore.getStoredCustomSamples).mockResolvedValue([
      {
        id: "sample-existing",
        name: "test_drop",
        data: new ArrayBuffer(8),
        createdAt: 1000,
        duration: 1.5,
      },
    ]);
  });

  it("renders when open and displays existing samples", async () => {
    render(
      <CustomSampleModal
        isOpen={true}
        onClose={vi.fn()}
        audioContext={mockContext}
        cowbellOverlay={mockOverlay}
      />,
    );

    expect(
      screen.getByText(/CUSTOM VOICE & REMIX SAMPLES/i),
    ).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("test_drop")).toBeTruthy();
    });
  });

  it("does not render when closed", () => {
    const { container } = render(
      <CustomSampleModal
        isOpen={false}
        onClose={vi.fn()}
        audioContext={mockContext}
        cowbellOverlay={mockOverlay}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("previews a sample on preview click", async () => {
    render(
      <CustomSampleModal
        isOpen={true}
        onClose={vi.fn()}
        audioContext={mockContext}
        cowbellOverlay={mockOverlay}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("test_drop")).toBeTruthy();
    });

    const previewBtn = screen.getByTitle("Audition sample");
    fireEvent.click(previewBtn);

    expect(mockOverlay.previewSample).toHaveBeenCalledWith("sample-existing");
  });

  it("triggers a sample into the live mix", async () => {
    render(
      <CustomSampleModal
        isOpen={true}
        onClose={vi.fn()}
        audioContext={mockContext}
        cowbellOverlay={mockOverlay}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("test_drop")).toBeTruthy();
    });

    const triggerBtn = screen.getByText("TEST SAMPLE IN MIX");
    fireEvent.click(triggerBtn);

    expect(mockOverlay.triggerVoiceSample).toHaveBeenCalled();
  });

  it("removes a sample in real time and updates storage", async () => {
    render(
      <CustomSampleModal
        isOpen={true}
        onClose={vi.fn()}
        audioContext={mockContext}
        cowbellOverlay={mockOverlay}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("test_drop")).toBeTruthy();
    });

    const deleteBtn = screen.getByTitle("Delete sample");
    fireEvent.click(deleteBtn);

    expect(mockOverlay.removeCustomSample).toHaveBeenCalledWith("sample-existing");
    expect(sampleStore.deleteStoredCustomSample).toHaveBeenCalledWith("sample-existing");
  });
});
