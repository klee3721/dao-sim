import { describe, expect, it } from "vitest";
import { analyzeCharacter, analyzeName } from "./name-number";
import {
  analyze,
  ENERGY_ORDER,
  getEnergyNameWithStrength,
  getEnergyPairs,
  getHungConversionGuidance,
  normalizeInput,
  PAIR_RULES,
  type EnergyId,
  type StrengthLevel,
} from "./numerology";

describe("Huyền Số numerology contract", () => {
  it("contains exactly 64 standard pairs, eight for every energy", () => {
    expect(Object.keys(PAIR_RULES)).toHaveLength(64);

    for (const energyId of ENERGY_ORDER) {
      expect(getEnergyPairs(energyId)).toHaveLength(8);
    }
  });

  it.each<[string, EnergyId, StrengthLevel]>([
    ["37", "TM", 4],
    ["96", "TM", 2],
    ["13", "TY", 1],
    ["14", "SK", 1],
    ["19", "DN", 1],
  ])("classifies documented pair %s as %s level %i", (pair, energyId, strength) => {
    expect(PAIR_RULES[pair]).toMatchObject({ pair, energyId, strength });
  });

  it("exposes strength labels and the documented hung conversion map", () => {
    expect(getEnergyNameWithStrength("TY", 1)).toBe("Thiên Y ①");
    expect(getHungConversionGuidance("HH")?.targetLabel).toBe("Sinh Khí");
    expect(getHungConversionGuidance("LS")?.targetLabel).toBe("Diên Niên");
    expect(getHungConversionGuidance("TM")?.targetLabel).toBe("Thiên Y");
    expect(getHungConversionGuidance("NQ")?.targetLabel).toBe(
      "Sinh Khí → Thiên Y → Diên Niên",
    );
    expect(getHungConversionGuidance("TY")).toBeUndefined();
  });

  it("preserves strengths in transitions, ending pairs, and CCCD fortune cycles", () => {
    const number = analyze("1349", "number").result;
    expect(number?.endingStrength).toBe(PAIR_RULES["49"].strength);
    expect(number?.transitions[0]).toMatchObject({
      fromStrength: PAIR_RULES["13"].strength,
      toStrength: PAIR_RULES["34"].strength,
    });

    const cccd = analyze("001234567890", "cccd").result;
    expect(cccd?.fortuneCycles?.[2].strength).toBe(1);
  });

  it("normalizes 10-digit and +84 phones to the same analyzed sequence", () => {
    expect(normalizeInput("0912 345 678", "phone")).toEqual({
      digits: "0912345678",
    });
    expect(normalizeInput("+84 912 345 678", "phone")).toEqual({
      digits: "0912345678",
    });

    const local = analyze("0912 345 678", "phone").result;
    const international = analyze("+84 912 345 678", "phone").result;
    expect(local?.analyzedDigits).toBe("912345678");
    expect(international).toEqual(local);
  });

  it("preserves zero-bridge and five-special source behavior", () => {
    const zeroResult = analyze("103", "number").result;
    expect(zeroResult?.pairs).toEqual([
      expect.objectContaining({
        pair: "13",
        segment: "103",
        energyId: "TY",
        source: "zero-bridge",
        hiddenByZero: true,
      }),
    ]);

    const fiveResult = analyze("153", "number").result;
    expect(fiveResult?.pairs.some((pair) => pair.pair === "13")).toBe(false);
    expect(fiveResult?.pairs.every((pair) => pair.source === "five-special")).toBe(true);
  });

  it("keeps the Vietnamese name-number mapping from the source project", () => {
    expect(analyzeCharacter("Á")?.value).toBe(4);
    expect(analyzeCharacter("Ê")?.value).toBe(5);
    expect(analyzeCharacter("Ế")?.value).toBe(6);

    const name = analyzeName("Ánh Minh");
    expect(name.words.map(({ word, total }) => [word, total])).toEqual([
      ["Ánh", 10],
      ["Minh", 11],
    ]);
    expect(name.resultString).toBe("1011");
    expect(name.filteredSequence).toBe("111");
    expect(name.pairs).toEqual(["11", "11"]);
  });
});
