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
const verify = OpsVerifier(ops, keys, issuer);
const verified = await verify(); // OpsVerificationResult;
if (verified instanceof Error) {
  verified; // OpsInvalid | OpsVerifyFailed
  process.exit(1);
}
verified; // VerifiedOps
```

### Profile Annotation Issuer の認可

`OpsVerifier` は検証成功後に、各 Profile Annotation の発行者が
[Profile Annotation Issuer 登録証 PA](https://docs.originator-profile.org/ja/opb/pa-model/profile-annotation-issuer-registration/)
によってその PA の認証制度（Profile Annotation Policy）の発行を認可されているかを確認します。

- 登録証 PA は、トラストアンカーとなる OP レジストリ（= `issuer`）が発行したもののみを認可の根拠とします。配布経路は Core Profile と同様に `REGISTRY_OPS` から配布されます。
- 認可は発行者ごとに、その発行者自身の登録証 PA で付与された `annotationScheme` の範囲に限定され、複数の発行者間で横断しません（発行者ごとの和集合）。
- OP レジストリ発行の登録証 PA 自身は認可確認の対象外で、トラストアンカー由来の基底ケースとして扱われます。
- 後方互換性のため、認可を確認できない場合も検証は失敗させず `console.error` で警告するに留めます。

```ts
import { verifyAnnotationIssuerRegistration } from "@originator-profile/verify";

verifyAnnotationIssuerRegistration(verifiedOps, issuer);
```
