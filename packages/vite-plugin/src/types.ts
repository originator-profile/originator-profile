import { OpId } from "@originator-profile/model";
import { z } from "zod";

const ExpiresIn = z
  .string()
  .regex(/^\d+[ymd]$/, 'Must be a duration like "1y", "6m", or "30d"');

const SigningKey = z.union([z.string(), z.looseObject({})]);

export const OriginatorProfileOptionsSchema = z.object({
  issuers: z
    .record(OpId, SigningKey)
    .refine((v) => Object.keys(v).length > 0, {
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
