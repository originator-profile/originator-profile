import { expect, test } from "vitest";
import { generateKey } from "./generate-key";
import { createThumbprint } from "./thumbprint";

test("generateKey() は鍵指紋と一致する `kid` を含む JWK 形式の鍵を返す", async () => {
  const { publicKey, privateKey } = await generateKey();
  expect(publicKey.kid).toBe(privateKey.kid);
  expect(publicKey.kid).toBe(await createThumbprint(privateKey));
});
