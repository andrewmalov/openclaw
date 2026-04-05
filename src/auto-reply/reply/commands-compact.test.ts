import { describe, expect, it } from "vitest";
import {
  appendCompactionCancelledDiagnosisIfNeeded,
  COMPACTION_CANCELLED_HINT,
} from "./commands-compact.js";

describe("appendCompactionCancelledDiagnosisIfNeeded", () => {
  it("appends the hint when Pi reports Compaction cancelled", () => {
    const headline = "Compaction failed: Compaction cancelled • Context ?/200k";
    const out = appendCompactionCancelledDiagnosisIfNeeded("Compaction cancelled", headline);
    expect(out.startsWith(headline)).toBe(true);
    expect(out).toContain(COMPACTION_CANCELLED_HINT);
    expect(out).toContain("agents.defaults.compaction");
    expect(out).toContain("Compaction safeguard");
  });

  it("is case-insensitive on the reason token", () => {
    const headline = "Compaction failed: x • y";
    const out = appendCompactionCancelledDiagnosisIfNeeded("COMPACTION CANCELLED", headline);
    expect(out).toContain(COMPACTION_CANCELLED_HINT);
  });

  it("leaves unrelated failures unchanged", () => {
    const headline = "Compaction failed: No API key • Context 1k/128k";
    expect(appendCompactionCancelledDiagnosisIfNeeded("No API key", headline)).toBe(headline);
  });
});
