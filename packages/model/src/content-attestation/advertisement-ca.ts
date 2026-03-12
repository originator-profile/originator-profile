import { z } from "zod";
import { AllowedOrigin } from "../allowed-origin";
import { AllowedUrl } from "../allowed-url";
import { OpCipContext } from "../context/op-cip-context";
import { Image } from "../image";
import { Page } from "../page";
import { ContentAttestation } from "./content-attestation";

const subject = z
  .looseObject({
    id: z.url().describe("CA ID"),
    type: z.literal("OnlineAd"),
    name: z.string().optional().describe("Title of the ad."),
    description: z.string().optional().describe("Ad description (plain text)."),
    image: Image.optional(),
    genre: z.string().optional().describe("Genre"),
    landingPageUrl: z.url().optional().describe("Landing page URL"),
    adReportContact: Page.optional(),
    adReviewGuidelines: Page.optional(),
    targetingPolicy: Page.optional(),
    adDataHandlingPolicy: Page.optional(),
    adDisplayRationale: z
      .object({
        page: Page.optional(),
        description: z.string().optional(),
      })
      .refine(
        (obj) => obj.page !== undefined || obj.description !== undefined,
        { error: "Either page or description must be provided" },
      )
      .optional()
      .describe("The reason this ad is being displayed"),
  })
  .refine(
    (obj) =>
      obj.name !== undefined ||
      obj.description !== undefined ||
      obj.image !== undefined,
    { error: "At least one of name, description, or image must be provided" },
  );

const withAllowedUrl = z.object({
  allowedUrl: AllowedUrl,
  allowedOrigin: z.never().optional(),
});

const withAllowedOrigin = z.object({
  allowedUrl: z.never().optional(),
  allowedOrigin: AllowedOrigin,
});

export const AdvertisementCA = ContentAttestation.extend({
  "@context": OpCipContext,
  credentialSubject: subject,
}).and(z.union([withAllowedUrl, withAllowedOrigin]));

export type AdvertisementCA = z.infer<typeof AdvertisementCA>;
export type AdvertisementSubject = z.infer<typeof subject>;
