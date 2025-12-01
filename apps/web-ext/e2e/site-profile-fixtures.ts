import {
  Certificate,
  CoreProfile,
  Jwk,
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
import { generateKey } from "@originator-profile/cryptography";

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

export const test = base.extend<TestFixtures>({
  validSiteProfile: async ({ page }: { page: Page }, use) => {
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
        const webMediaProfile: WebMediaProfile =
          generateWebMediaProfileData(issuer);
        const websiteProfile: WebsiteProfile =
          generateWebsiteProfileData(issuer);

        const signedCoreProfile = await signJwtVc(coreProfile, privateKey, {
          issuedAt,
          expiredAt,
        });
        const annotations = await signJwtVc(certificate, privateKey, {
          issuedAt,
          expiredAt,
        });
        const signedMediaProfile = await signJwtVc(
          webMediaProfile,
          privateKey,
          {
            issuedAt,
            expiredAt,
          },
        );

        const op = {
          core: signedCoreProfile,
          annotations: [annotations],
          media: signedMediaProfile,
        };

        const signedWebsiteProfile = await signJwtVc(
          websiteProfile,
          privateKey,
          {
            issuedAt,
            expiredAt,
          },
        );

        const sp: SiteProfile = {
          originators: [op],
          credential: signedWebsiteProfile,
        };

        await page.route(
          "http://localhost:8080/.well-known/sp.json",
          async (route) =>
            route.fulfill({
              body: JSON.stringify(sp),
              contentType: "application/json",
            }),
        );
      },
    );

    await page.unroute("http://localhost:8080/.well-known/sp.json");
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
    await page.route(
      "http://localhost:8080/.well-known/sp.json",
      async (route) =>
        route.fulfill({
          body: JSON.stringify(sp),
          contentType: "application/json",
        }),
    );
    await use(undefined);

    await page.unroute("http://localhost:8080/.well-known/sp.json");
  },
  missingSiteProfile: async ({ page }: { page: Page }, use) => {
    await page.route(
      "http://localhost:8080/.well-known/sp.json",
      async (route) =>
        route.fulfill({
          status: 404,
        }),
    );
    await use(undefined);
    await page.unroute("http://localhost:8080/.well-known/sp.json");
  },
  evilSiteProfile: async ({ page }: { page: Page }, use) => {
    await use(async (key: { publicKey: Jwk }, issuer: string) => {
      const { publicKey } = key;
      const { privateKey } = await generateKey();

      const issuedAt: Date = new Date(Date.now());
      const expiredAt: Date = addYears(new Date(), 1);

      const coreProfile: CoreProfile = generateCoreProfileData(
        publicKey,
        issuer,
      );
      const certificate: Certificate = generateCertificateData(issuer);
      const webMediaProfile: WebMediaProfile =
        generateWebMediaProfileData(issuer);
      const websiteProfile: WebsiteProfile = generateWebsiteProfileData(issuer);

      const signedCoreProfile = await signJwtVc(coreProfile, privateKey, {
        issuedAt,
        expiredAt,
      });
      const annotations = await signJwtVc(certificate, privateKey, {
        issuedAt,
        expiredAt,
      });
      const signedMediaProfile = await signJwtVc(webMediaProfile, privateKey, {
        issuedAt,
        expiredAt,
      });

      const op = {
        core: signedCoreProfile,
        annotations: [annotations],
        media: signedMediaProfile,
      };

      const evilWebsiteProfile = await signJwtVc(websiteProfile, privateKey, {
        issuedAt,
        expiredAt,
      });

      const sp: SiteProfile = {
        originators: [op],
        credential: evilWebsiteProfile,
      };

      await page.route(
        "http://localhost:8080/.well-known/sp.json",
        async (route) =>
          route.fulfill({
            body: JSON.stringify(sp),
            contentType: "application/json",
          }),
      );
    });

    await page.unroute("http://localhost:8080/.well-known/sp.json");
  },
  missingMediaSiteProfile: async ({ page }: { page: Page }, use) => {
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
        const websiteProfile: WebsiteProfile =
          generateWebsiteProfileData(issuer);

        const signedCoreProfile = await signJwtVc(coreProfile, privateKey, {
          issuedAt,
          expiredAt,
        });
        const annotations = await signJwtVc(certificate, privateKey, {
          issuedAt,
          expiredAt,
        });

        const op = {
          core: signedCoreProfile,
          annotations: [annotations],
        };

        const signedWebsiteProfile = await signJwtVc(
          websiteProfile,
          privateKey,
          {
            issuedAt,
            expiredAt,
          },
        );

        const sp: SiteProfile = {
          originators: [op],
          credential: signedWebsiteProfile,
        };

        await page.route(
          "http://localhost:8080/.well-known/sp.json",
          async (route) =>
            route.fulfill({
              body: JSON.stringify(sp),
              contentType: "application/json",
            }),
        );
      },
    );

    await page.unroute("http://localhost:8080/.well-known/sp.json");
  },
});
