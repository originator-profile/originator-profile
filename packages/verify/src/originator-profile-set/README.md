# Originator Profile Set

Originator Profile Set の検証

- [types.ts](./types.ts)
- [errors.ts](./errors.ts)

## decodeOps

Originator Profile Set の復号

```ts
const ops = [{ core: "eyJ...", annotations: ["eyJ..."], media: "eyJ..." }];
const decoded = decodeOps(ops); // OpsDecodingResult
if (decoded instanceof Error) {
  decoded; // OpsInvalid
  process.exit(1);
}
decoded; // DecodedOps
```

## OpsVerifier

Originator Profile Set の検証

```ts
import { generateKey, LocalKeys } from "@originator-profile/cryptography";

const ops = [{ core: "eyJ...", annotations: ["eyJ..."], media: "eyJ..." }];
const { privateKey, publicKey } = await generateKey();
const keys = LocalKeys({ keys: [publicKey] });
const issuer = "dns:cp-issuer.example.org"; // OP ID
const verify = OpsVerifier(ops, {
  core: { issuer, keys },
  profileAnnotationIssuerRegistration: { issuer },
});
const verified = await verify(); // OpsVerificationResult;
if (verified instanceof Error) {
  verified; // OpsInvalid | OpsVerifyFailed
  process.exit(1);
}
verified; // VerifiedOps
```
