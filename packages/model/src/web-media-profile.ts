import { z } from "zod";
import { OpCipContext } from "./context/op-cip-context";
import { Description } from "./description";
import { Image } from "./image";
import { OpId } from "./op-id";

const subject = z.looseObject({
  id: OpId.describe("OP ID of the WMP holding organization"),
  type: z.literal("OnlineBusiness"),
  url: z.url().describe("Web media URL"),
  name: z.string().describe("Organization name"),
  logo: Image.optional(),
  email: z.email().optional().describe("Email address"),
  telephone: z.string().optional().describe("Phone number"),
  contactPoint: z
    .object({
      id: z.url().describe("Contact page URL"),
      name: z.string().describe("Contact page display name"),
    })
    .optional(),
  informationTransmissionPolicy: z
    .object({
      id: z.url().describe("Information transmission policy URL"),
      name: z.string().describe("Information transmission policy display name"),
    })
    .optional(),
  publishingPrinciple: z
    .object({
      id: z.url().describe("Editorial guidelines URL"),
      name: z.string().describe("Editorial guidelines display name"),
    })
    .optional(),
  privacyPolicy: z
    .object({
      id: z.url().describe("Privacy policy page URL"),
      name: z.string().describe("Privacy policy page display name"),
    })
    .optional(),
  description: z.union([Description, z.array(Description)]).optional(),
});

export const WebMediaProfile = z.looseObject({
  "@context": OpCipContext,
  type: z.tuple([
    z.literal("VerifiableCredential"),
    z.literal("WebMediaProfile"),
  ]),
  issuer: OpId,
  credentialSubject: subject,
});

export type WebMediaProfile = z.infer<typeof WebMediaProfile>;
