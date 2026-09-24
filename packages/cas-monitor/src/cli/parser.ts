import fs from "node:fs/promises";

export async function parseInput(input: string) {
  const inputBuffer = await fs.readFile(input);
  const inputJson = JSON.parse(inputBuffer.toString());

  return { urls: inputJson.urls };
}
