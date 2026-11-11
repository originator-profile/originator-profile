import { createInterface } from "node:readline/promises";
import type { Ask } from "../operations/init";

export const withTerminalAsk = async <T>(
  run: (ask: Ask) => Promise<T>,
): Promise<T> => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await run(async (question, fallback) => {
      const answer = (
        await rl.question(`${question}${fallback ? ` [${fallback}]` : ""}: `)
      ).trim();
      return answer || fallback || "";
    });
  } finally {
    rl.close();
  }
};
