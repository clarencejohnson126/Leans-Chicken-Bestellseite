import { describe, expect, it } from "vitest";
import { parseSurvey, tallySurvey } from "@/lib/survey";

function form(entries: [string, string][]) {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe("Umfrage", () => {
  it("übernimmt nur bekannte Antworten und bei Einfachauswahl nur die erste", () => {
    const result = parseSurvey(
      form([
        ["days", "fr"],
        ["days", "fr"],
        ["days", "xx"],
        ["frequency", "weekly"],
        ["frequency", "rarely"],
        ["tip", "  Mehr Sauce!  "],
      ]),
    );
    expect(result).toEqual({ answers: { days: ["fr"], frequency: ["weekly"] }, tip: "Mehr Sauce!" });
  });

  it("speichert eine leere Umfrage nicht", () => {
    expect(parseSurvey(form([["tip", "   "]]))).toBeNull();
  });

  it("zählt die Antworten pro Frage", () => {
    const tally = tallySurvey([{ answers: { days: ["fr", "sa"] } }, { answers: { days: ["fr"] } }, { answers: {} }]);
    const days = tally.find((q) => q.id === "days")!;
    expect(days.answered).toBe(2);
    expect(days.counts.find((o) => o.id === "fr")?.count).toBe(2);
    expect(days.counts.find((o) => o.id === "sa")?.count).toBe(1);
  });
});
