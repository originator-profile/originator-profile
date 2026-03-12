import { IntegrityMetadataSet, supportedHashAlgorithms } from "websri";
import { z } from "zod";

export const SubresourceIntegrity = z
  .stringFormat(
    "sri",
    (val) => {
      try {
        const integrity = new IntegrityMetadataSet(val);
        return (
          integrity.size > 0 &&
          [...integrity].every((m) => m.alg in supportedHashAlgorithms)
        );
      } catch {
        return false;
      }
    },
    {
      error:
        "Must be in the format sha256-<base64>, sha384-<base64>, or sha512-<base64>.",
    },
  )
  .describe("Subresource Integrity (SRI) string");

export type SubresourceIntegrity = z.infer<typeof SubresourceIntegrity>;
