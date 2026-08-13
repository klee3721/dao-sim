export type LetterResult = {
  character: string;
  baseCharacter: string;
  baseValue: number;
  toneBonus: 0 | 1;
  value: number;
};

export type WordResult = {
  word: string;
  letters: LetterResult[];
  ignored: string[];
  total: number;
};

export type NameAnalysis = {
  words: WordResult[];
  letters: LetterResult[];
  ignored: string[];
  resultString: string;
  filteredSequence: string;
  pairs: string[];
};

export const NAME_NUMBER_GROUPS = [
  { value: 1, letters: "I, O, S, L, C, U, J" },
  { value: 2, letters: "B, Q, T, Ư, P, D, G, X, V, Ơ, Ô" },
  { value: 3, letters: "R, Y, A, Đ, H, K, N, Z" },
  { value: 4, letters: "E, M, Â, Ă, W" },
  { value: 5, letters: "Ê" },
] as const;

const CHARACTER_VALUES: Readonly<Record<string, number>> = {
  I: 1,
  O: 1,
  S: 1,
  L: 1,
  C: 1,
  U: 1,
  J: 1,
  B: 2,
  Q: 2,
  T: 2,
  Ư: 2,
  P: 2,
  D: 2,
  G: 2,
  X: 2,
  V: 2,
  Ơ: 2,
  Ô: 2,
  R: 3,
  Y: 3,
  A: 3,
  Đ: 3,
  H: 3,
  K: 3,
  N: 3,
  Z: 3,
  E: 4,
  M: 4,
  Â: 4,
  Ă: 4,
  W: 4,
  Ê: 5,
};

const TONE_MARKS = /[\u0300\u0301\u0303\u0309\u0323]/gu;

function splitCharacters(value: string): string[] {
  const normalized = value.normalize("NFC");

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("vi", { granularity: "grapheme" });
    return Array.from(segmenter.segment(normalized), ({ segment }) => segment);
  }

  return Array.from(normalized);
}

export function analyzeCharacter(character: string): LetterResult | null {
  const uppercase = character.toLocaleUpperCase("vi-VN");
  const decomposed = uppercase.normalize("NFD");
  const hasToneMark = TONE_MARKS.test(decomposed);
  TONE_MARKS.lastIndex = 0;
  const baseCharacter = decomposed.replace(TONE_MARKS, "").normalize("NFC");
  TONE_MARKS.lastIndex = 0;
  const baseValue = CHARACTER_VALUES[baseCharacter];

  if (baseValue === undefined) return null;

  const toneBonus: 0 | 1 = hasToneMark ? 1 : 0;
  return {
    character: uppercase.normalize("NFC"),
    baseCharacter,
    baseValue,
    toneBonus,
    value: baseValue + toneBonus,
  };
}

function analyzeWord(word: string): WordResult | null {
  const letters: LetterResult[] = [];
  const ignored: string[] = [];

  for (const character of splitCharacters(word)) {
    const result = analyzeCharacter(character);
    if (result) letters.push(result);
    else ignored.push(character);
  }

  if (letters.length === 0) return null;

  return {
    word,
    letters,
    ignored,
    total: letters.reduce((sum, item) => sum + item.value, 0),
  };
}

export function extractNameNumberPairs(resultString: string): {
  filteredSequence: string;
  pairs: string[];
} {
  const filteredSequence = resultString.replace(/[05]/gu, "");
  const pairs: string[] = [];

  for (let index = 0; index < filteredSequence.length - 1; index += 1) {
    pairs.push(filteredSequence.slice(index, index + 2));
  }

  return { filteredSequence, pairs };
}

export function analyzeName(name: string): NameAnalysis {
  const words: WordResult[] = [];
  const ignored: string[] = [];
  const rawWords = name.normalize("NFC").trim().split(/\s+/u).filter(Boolean);

  for (const rawWord of rawWords) {
    const word = analyzeWord(rawWord);
    if (word) {
      words.push(word);
      ignored.push(...word.ignored);
    } else {
      ignored.push(...splitCharacters(rawWord));
    }
  }

  const letters = words.flatMap((word) => word.letters);
  const resultString = words.map((word) => String(word.total)).join("");
  const { filteredSequence, pairs } = extractNameNumberPairs(resultString);

  return { words, letters, ignored, resultString, filteredSequence, pairs };
}
