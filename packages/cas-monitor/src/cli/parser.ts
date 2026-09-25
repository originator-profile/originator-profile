import fs from "node:fs/promises";

export async function parseInput(input: string) {
  const inputBuffer = await fs.readFile(input);
  const inputJson = JSON.parse(inputBuffer.toString());

  if (!Array.isArray(inputJson.urls)) {
    throw new Error("入力ファイルには urls 配列を指定してください");
  }

  return { urls: inputJson.urls };
}
