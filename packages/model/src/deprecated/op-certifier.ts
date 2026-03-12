import { z } from "zod";
import Logo from "./logo";

/** @deprecated */
const OpCertifier = z
  .object({
    type: z.literal("certifier"),
    domainName: z.string().describe("Domain name"),
    url: z.string().describe("Website URL"),
    name: z.string().describe("Corporate name"),
    description: z
      .string()
      .optional()
      .describe(
        "Description of the web media, the corporation that operates it, certification bodies, industry associations, etc.",
      ),
    corporateNumber: z.string().optional().describe("Corporate number"),
    businessCategory: z.array(z.string()).optional(),
    email: z.string().optional().describe("Email address"),
    phoneNumber: z.string().optional().describe("Phone number"),
    postalCode: z.string().describe("Postal code"),
    addressCountry: z.string().describe("Country"),
    addressRegion: z.string().describe("Prefecture / State"),
    addressLocality: z.string().describe("City / Municipality"),
    streetAddress: z.string().describe("Street address"),
    contactTitle: z.string().optional().describe("Contact display name"),
    contactUrl: z.string().optional().describe("Contact URL"),
    privacyPolicyTitle: z
      .string()
      .optional()
      .describe("Privacy policy display name"),
    privacyPolicyUrl: z.string().optional().describe("Privacy policy URL"),
    publishingPrincipleTitle: z
      .string()
      .optional()
      .describe("Editorial guidelines display name"),
    publishingPrincipleUrl: z
      .string()
      .optional()
      .describe("Editorial guidelines URL"),
    logos: Logo.optional(),
  })
  .describe("Certification body that issues credentials");

/** @deprecated */
type OpCertifier = z.infer<typeof OpCertifier>;

export default OpCertifier;
