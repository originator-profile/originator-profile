import { Jwk, OpId } from "@originator-profile/model";
import ms from "ms";
import { z } from "zod";

const ExpiresIn = z.string().refine(
  (v) => {
    try {
      return (
        typeof (ms(v as Parameters<typeof ms>[0]) as number | undefined) ===
        "number"
      );
    } catch {
      return false;
    }
  },
  {
    message:
      'Invalid duration. See https://github.com/vercel/ms for accepted formats (e.g., "1y", "30d", "12h").',
  },
);

const SigningKey = z.union([z.string(), Jwk]);

export const OriginatorProfileOptionsSchema = z.object({
  issuers: z.record(OpId, SigningKey).refine((v) => Object.keys(v).length > 0, {
    message: "At least one issuer is required",
  }),
  expiresIn: ExpiresIn.optional(),
  wsp: z
    .object({
      input: z.string().optional(),
    })
    .optional(),
});

export type OriginatorProfileOptions = z.infer<
  typeof OriginatorProfileOptionsSchema
>;

export interface SigningContext {
  issuers: Record<string, z.infer<typeof Jwk>>;
  issuedAt: Date;
  expiredAt: Date;
}
