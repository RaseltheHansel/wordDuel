// WHY: Curated list of common 5-letter words
// In a real app this would be much larger (2000+ words)
const WORDS = [
  "CRANE", "SLATE", "AUDIO", "RAISE", "AROSE",
  "LATER", "ALERT", "ALTER", "IRATE", "STARE",
  "SNARE", "SPARE", "SHARE", "SHORE", "STORE",
  "SCORE", "SCARE", "SCALE", "SHALE", "STALE",
  "TRACE", "GRACE", "BRACE", "PLACE", "PLANE",
  "PLANT", "BLAST", "CLAST", "CLASP", "CLASS",
  "FLAME", "FRAME", "FLARE", "GLARE", "BLARE",
  "BRAVE", "CRAVE", "GRAVE", "SHAVE", "SLAVE",
  "BRAKE", "DRAKE", "FLAKE", "SHAKE", "SNAKE",
  "STAMP", "CLAMP", "CRAMP", "TRAMP", "SWAMP",
  // Add more words here!
];

export const getRandomWord = (): string => {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
};

export const isValidWord = (word: string): boolean => {
  return WORDS.includes(word.toUpperCase());
};

// WHY: evaluateGuess returns color for each letter
// This is the core Wordle algorithm!
export interface TileResult {
  letter: string;
  color:  "green" | "yellow" | "gray";
}

export const evaluateGuess = (
  guess: string,
  answer: string
): TileResult[] => {
    
  const g = guess.toUpperCase().split("");
  const a = answer.toUpperCase().split("");
  const result: TileResult[] = Array(5).fill(null).map((_, i) => ({
    letter: g[i],
    color:  "gray" as const,
  }));

  // prevents marking same letter green AND yellow
  const answerUsed = Array(5).fill(false);
  const guessUsed  = Array(5).fill(false);

  // Pass 1: Find green tiles (correct position)
  for (let i = 0; i < 5; i++) {
    if (g[i] === a[i]) {
      result[i].color = "green";
      answerUsed[i]   = true;
      guessUsed[i]    = true;
    }
  }

  // Pass 2: Find yellow tiles (wrong position)
  for (let i = 0; i < 5; i++) {
    if (guessUsed[i]) continue; // already green
    for (let j = 0; j < 5; j++) {
      if (answerUsed[j]) continue;
      if (g[i] === a[j]) {
        result[i].color = "yellow";
        answerUsed[j]   = true;
        break;
      }
    }
  }

  return result;
};
