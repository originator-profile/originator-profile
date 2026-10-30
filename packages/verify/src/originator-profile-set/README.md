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

### Profile Annotation Issuer の認可確認

`OpsVerifier` は検証成功後、各 Profile Annotation の発行者が OP レジストリによって認可された Profile Annotation Issuer であるかどうかを、発行者が保有する [Profile Annotation Issuer 認定証 PA](https://docs.originator-profile.org/opb/pa-model/profile-annotation-issuer-registration/) を用いて確認します。
認定証 PA の `credentialSubject.type` は `ProfileAnnotationIssuerAccreditation` です。
後方互換性のため、旧名称「登録証」の type `ProfileAnnotationIssuerRegistration` も認定証 PA として扱います。
確認は次の手順で行います。

1. 認定証 PA の `issuer` が、`OpsVerifier` に渡した OP ID（トラストアンカーとなる OP レジストリ）と一致することを確認します
2. 検証対象の PA が準拠する認証制度の ID が、その認定証 PA の `credentialSubject.annotationScheme` に含まれることを確認します

- 認可は発行者ごとに、その発行者自身の認定証 PA で付与された `annotationScheme` の範囲に限定されます。発行者間で横断せず、同じ発行者に複数の認定証 PA がある場合は和集合をとります。
- OP レジストリ自身が発行する認定証 PA も、例外なく本チェックの対象です。OP レジストリが自身に対して認定証 PA を発行し、その `annotationScheme` に認定証 PA 自体が準拠する認証制度の ID を含めることで、基底ケースを構成します。
- 認可は連鎖しません。OP レジストリが certifier に付与した認可は certifier 自身が発行する認定証 PA を有効にしますが、certifier が発行する通常の PA には継承されません。
- 認定証 PA 自体の署名検証が一意の結果を返すのに対し、この認可確認の結果は一意ではなく検証者ごとに異なることがあります。そのため認可を確認できない場合も検証エラーとはせず、`console.info` で通知するにとどめます（[Logger](../logger.ts) 参照）。認可を確認できた場合は何も通知しません。

```ts
import { verifyAnnotationIssuerAccreditation } from "@originator-profile/verify";

verifyAnnotationIssuerAccreditation(verifiedOps, issuer);
```
