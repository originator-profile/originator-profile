import { generateKey } from "@originator-profile/cryptography";
import {
  Certificate,
  CoreProfile,
  Jwk,
  OriginatorProfileSetItem,
  SiteProfile,
  WebMediaProfile,
  WebsiteProfile,
} from "@originator-profile/model";
import { signJwtVc } from "@originator-profile/securing-mechanism";
import { test as base, Page } from "@playwright/test";
import { addYears } from "date-fns";
import {
  generateCertificateData,
  generateCoreProfileData,
  generateWebMediaProfileData,
  generateWebsiteProfileData,
} from "./data";

type TestFixtures = {
  validSiteProfile: (
    key: { publicKey: Jwk; privateKey: Jwk },
    issuer: string,
  ) => Promise<void>;
  invalidSiteProfile: void;
  missingSiteProfile: void;
  evilSiteProfile: (key: { publicKey: Jwk }, issuer: string) => Promise<void>;
  missingMediaSiteProfile: (
    key: { publicKey: Jwk; privateKey: Jwk },
    issuer: string,
  ) => Promise<void>;
};

type KeyPair = { publicKey: Jwk; privateKey: Jwk };

const WELL_KKNOWN_SP_URL = "http://localhost:8080/.well-known/sp.json";

async function createSiteProfile(
  key: KeyPair,
  issuer: string,
  includeMedia: boolean = true,
): Promise<SiteProfile> {
  const { publicKey, privateKey } = key;
  const issuedAt: Date = new Date(Date.now());
  const expiredAt: Date = addYears(new Date(), 1);

  const coreProfile: CoreProfile = generateCoreProfileData(publicKey, issuer);
  const certificate: Certificate = generateCertificateData(issuer);
  const websiteProfile: WebsiteProfile = generateWebsiteProfileData(issuer);
  const signedCoreProfile = await signJwtVc(coreProfile, privateKey, {
    issuedAt,
    expiredAt,
  });
  const annotations = await signJwtVc(certificate, privateKey, {
    issuedAt,
    expiredAt,
  });
  const op: OriginatorProfileSetItem = {
    core: signedCoreProfile,
    annotations: [annotations],
  };

  if (includeMedia) {
    const webMediaProfile: WebMediaProfile =
      generateWebMediaProfileData(issuer);
    const signedMediaProfile = await signJwtVc(webMediaProfile, privateKey, {
      issuedAt,
      expiredAt,
    });
    op.media = signedMediaProfile;
  }
  const signedWebsiteProfile = await signJwtVc(websiteProfile, privateKey, {
    issuedAt,
    expiredAt,
  });

  const sp: SiteProfile = {
    originators: [op],
    credential: signedWebsiteProfile,
  };

  return sp;
}

async function setupRoute(
  page: Page,
  sp: SiteProfile | null,
  status: number = 200,
) {
  await page.route(WELL_KKNOWN_SP_URL, async (route) =>
    route.fulfill({
      ...(status === 200 && {
        body: JSON.stringify(sp),
        contentType: "application/json",
      }),
      status,
    }),
  );
}

async function cleanupRoute(page: Page) {
  await page.unroute(WELL_KKNOWN_SP_URL);
}

export const test = base.extend<TestFixtures>({
  validSiteProfile: async ({ page }: { page: Page }, use) => {
    await use(
      async (key: { publicKey: Jwk; privateKey: Jwk }, issuer: string) => {
        const sp: SiteProfile = await createSiteProfile(key, issuer);
        await setupRoute(page, sp, 200);
      },
    );

    await cleanupRoute(page);
  },
  invalidSiteProfile: async ({ page }: { page: Page }, use) => {
    /* Verify失敗するSiteProfile */
    const sp: SiteProfile = {
      originators: [
        {
          core: "eyJhb",
          annotations: ["eyJhb"],
          media: "eyJhb",
        },
      ],
      credential: " eyJhb",
    };
    await setupRoute(page, sp, 200);
    await use(undefined);

    await cleanupRoute(page);
  },
  missingSiteProfile: async ({ page }: { page: Page }, use) => {
    await setupRoute(page, null, 404);
    await use(undefined);
    await cleanupRoute(page);
  },
  evilSiteProfile: async ({ page }: { page: Page }, use) => {
    await use(async (key: { publicKey: Jwk }, issuer: string) => {
      const { publicKey } = key;
      const { privateKey } = await generateKey();
      const sp: SiteProfile = await createSiteProfile(
        { publicKey, privateKey },
        issuer,
      );

      await setupRoute(page, sp, 200);
    });

    await cleanupRoute(page);
  },
  missingMediaSiteProfile: async ({ page }: { page: Page }, use) => {
    await use(
      async (key: { publicKey: Jwk; privateKey: Jwk }, issuer: string) => {
        const sp: SiteProfile = await createSiteProfile(key, issuer, false);

        await setupRoute(page, sp, 200);
      },
    );

    await cleanupRoute(page);
  },
});
