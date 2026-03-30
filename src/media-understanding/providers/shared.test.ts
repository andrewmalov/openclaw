import { describe, expect, it } from "vitest";
import { mapTranscriptionFailureToUserMessage } from "./shared.js";

describe("mapTranscriptionFailureToUserMessage", () => {
  it("maps timeout/abort errors", () => {
    expect(mapTranscriptionFailureToUserMessage(new Error("The user aborted a request."))).toMatch(
      /timed out/i,
    );
  });

  it("maps HTTP 4xx from assertOkOrThrowHttpError", () => {
    expect(
      mapTranscriptionFailureToUserMessage(new Error("Audio transcription failed (HTTP 415): x")),
    ).toMatch(/could not process this audio/i);
  });

  it("maps HTTP 5xx", () => {
    expect(
      mapTranscriptionFailureToUserMessage(new Error("Audio transcription failed (HTTP 503): x")),
    ).toMatch(/temporarily unavailable/i);
  });
});
