import { generateKey } from "@originator-profile/cryptography";
import {
  Certificate,
  CoreProfile,
  Jwk,
  OriginatorProfile,
  SiteProfile,
  WebMediaProfile,
  WebsiteProfile,
} from "@originator-profile/model";
import { signJwtVc } from "@originator-profile/securing-mechanism";
import { test as base, Page } from "@playwright/test";
import { addDays, addYears } from "date-fns";
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
  expiringSoonSiteProfile: (
    key: { publicKey: Jwk; privateKey: Jwk },
    issuer: string,
  ) => Promise<void>;
  multiLocaleSiteProfile: (
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
  expiredAt: Date = addYears(new Date(), 1),
): Promise<SiteProfile> {
  const { publicKey, privateKey } = key;
  const issuedAt: Date = new Date(Date.now());

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
  const op: OriginatorProfile = {
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
    op.media = [signedMediaProfile];
  }
  const signedWebsiteProfile = await signJwtVc(websiteProfile, privateKey, {
    issuedAt,
    expiredAt,
  });

  const sp: SiteProfile = {
    originators: [op],
    sites: [signedWebsiteProfile],
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
          media: ["eyJhb"],
        },
      ],
      sites: [" eyJhb"],
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
  expiringSoonSiteProfile: async ({ page }: { page: Page }, use) => {
    await use(
      async (key: { publicKey: Jwk; privateKey: Jwk }, issuer: string) => {
        const sp: SiteProfile = await createSiteProfile(
          key,
          issuer,
          true,
          addDays(new Date(), 1),
        );

        await setupRoute(page, sp, 200);
      },
    );

    await cleanupRoute(page);
  },
  multiLocaleSiteProfile: async ({ page }: { page: Page }, use) => {
    await use(
      async (key: { publicKey: Jwk; privateKey: Jwk }, issuer: string) => {
        const { publicKey, privateKey } = key;
        const issuedAt: Date = new Date(Date.now());
        const expiredAt: Date = addYears(new Date(), 1);

        const coreProfile: CoreProfile = generateCoreProfileData(
          publicKey,
          issuer,
        );
        const certificate: Certificate = generateCertificateData(issuer);
        const signedCoreProfile = await signJwtVc(coreProfile, privateKey, {
          issuedAt,
          expiredAt,
        });
        const annotations = await signJwtVc(certificate, privateKey, {
          issuedAt,
          expiredAt,
        });

        // 複数言語のWebMediaProfileを作成
        const webMediaProfileJa: WebMediaProfile =
          generateWebMediaProfileData(issuer);
        const webMediaProfileEn: WebMediaProfile = {
          ...webMediaProfileJa,
          "@context": [
            "https://www.w3.org/ns/credentials/v2",
            "https://originator-profile.org/ns/credentials/v1",
            "https://originator-profile.org/ns/cip/v1",
            {
              "@language": "en",
            },
          ],
          credentialSubject: {
            ...webMediaProfileJa.credentialSubject,
            name: "Originator Profile Technology Research Association (Development)",
          },
        };

        const signedMediaProfileJa = await signJwtVc(
          webMediaProfileJa,
          privateKey,
          {
            issuedAt,
            expiredAt,
          },
        );
        const signedMediaProfileEn = await signJwtVc(
          webMediaProfileEn,
          privateKey,
          {
            issuedAt,
            expiredAt,
          },
        );

        const op: OriginatorProfile = {
          core: signedCoreProfile,
          annotations: [annotations],
          media: [signedMediaProfileJa, signedMediaProfileEn],
        };

        // 複数言語のWebsiteProfileを作成
        const websiteProfileJa: WebsiteProfile =
          generateWebsiteProfileData(issuer);
        const websiteProfileEn: WebsiteProfile = {
          ...websiteProfileJa,
          "@context": [
            "https://www.w3.org/ns/credentials/v2",
            "https://originator-profile.org/ns/credentials/v1",
            "https://originator-profile.org/ns/cip/v1",
            {
              "@language": "en",
            },
          ],
          credentialSubject: {
            ...websiteProfileJa.credentialSubject,
            name: "Site Profile Verification",
            description: "<Website Description>",
          },
        };

        const signedWebsiteProfileJa = await signJwtVc(
          websiteProfileJa,
          privateKey,
          {
            issuedAt,
            expiredAt,
          },
        );
        const signedWebsiteProfileEn = await signJwtVc(
          websiteProfileEn,
          privateKey,
          {
            issuedAt,
            expiredAt,
          },
        );

        const sp: SiteProfile = {
          originators: [op],
          sites: [signedWebsiteProfileJa, signedWebsiteProfileEn],
        };

        await setupRoute(page, sp, 200);
      },
    );

    await cleanupRoute(page);
  },
});
