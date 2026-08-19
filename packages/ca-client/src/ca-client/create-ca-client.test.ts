import { expect, test } from "vitest";
import { createCaClient } from "./create-ca-client";

const ccspConfig = Buffer.from(
  JSON.stringify({
    authType: "client_secret_post",
    clientId: "id",
    clientSec: "sec",
    tokenUrl: "https://auth.example/token",
  }),
).toString("base64");

test("createCaClient: returns config, sign, and reSign (tokenManager is not public)", () => {
  const client = createCaClient({
    endpoint: "https://ca.example.com",
    issuer: "dns:issuer.example",
    ccspConfig,
  });

  expect(client.config.issuer).toBe("dns:issuer.example");
  expect(typeof client.sign).toBe("function");
  expect(typeof client.reSign).toBe("function");
  expect("tokenManager" in client).toBe(false);
});
