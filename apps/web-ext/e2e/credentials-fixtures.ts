import {
  ContentAttestationSet,
  Jwk,
  UnsignedContentAttestation,
} from "@originator-profile/model";
import { signJwtVc } from "@originator-profile/securing-mechanism";
import { test as base, Page } from "@playwright/test";
import { addYears } from "date-fns";
import {
  generateCoreProfileData,
  generateUnsignedContentAttestation,
  generateCertificateData,
  generateWebMediaProfileData,
} from "./data";
import { signCa } from "../../../packages/sign/src/sign-ca";
import { Window } from "happy-dom";
import { generateKey } from "@originator-profile/cryptography";

type TestFixtures = {
  validCredentials: (
    key: { publicKey: Jwk; privateKey: Jwk },
    contents: string,
    issuer: string,
  ) => Promise<void>;
  missingCredentials: void;
  validCas: (
    key: { privateKey: Jwk },
    contents: string,
    issuer: string,
    attestationType?: "Article" | "Advertorial" | "OnlineAd",
  ) => Promise<void>;
  validOps: (
    key: { publicKey: Jwk; privateKey: Jwk },
    issuer: string,
  ) => Promise<void>;
  invalidCas: void;
  missingCas: void;
  evilCas: (contents: string, issuer: string) => Promise<void>;
  missingOps: void;
  evilOps: (key: { publicKey: Jwk }, issuer: string) => Promise<void>;
};

const casEndpoint: string = "http://localhost:8080/examples/cas.json";
const opsEndpoint: string = "http://localhost:8080/examples/ops.json";

export const test = base.extend<TestFixtures>({
  validCredentials: async ({ page }: { page: Page }, use) => {
    await use(
      async (
        key: { publicKey: Jwk; privateKey: Jwk },
        contents: string,
        issuer: string,
      ) => {
        const { publicKey, privateKey } = key;
        const issuedAt: Date = new Date(Date.now());
        const expiredAt: Date = addYears(new Date(), 1);
        const unsignedContentAttestation: UnsignedContentAttestation =
          generateUnsignedContentAttestation(contents, issuer);
        const contentAttestation = await signCa(
          unsignedContentAttestation,
          privateKey,
          {
            issuedAt,
            expiredAt,
            documentProvider: async () => {
              const window = new Window();
              window.document.write(contents);
              return window.document as unknown as Document;
            },
          },
        );

        const signedCoreProfile = await signJwtVc(
          generateCoreProfileData(publicKey, issuer),
          privateKey,
          {
            issuedAt,
            expiredAt,
          },
        );
        const annotations = await signJwtVc(
          generateCertificateData(issuer),
          privateKey,
          {
            issuedAt,
            expiredAt,
          },
        );
        const signedMediaProfile = await signJwtVc(
          generateWebMediaProfileData(issuer),
          privateKey,
          {
            issuedAt,
            expiredAt,
          },
        );

        await page.route(casEndpoint, async (route) =>
          route.fulfill({
            body: JSON.stringify([
              {
                attestation: contentAttestation,
                main: true,
              },
            ]),
            contentType: "application/json",
          }),
        );

        await page.route(opsEndpoint, async (route) =>
          route.fulfill({
            body: JSON.stringify({
              core: signedCoreProfile,
              annotations: [annotations],
              media: signedMediaProfile,
            }),
            contentType: "application/json",
          }),
        );
      },
    );

    await page.unroute(casEndpoint);
    await page.unroute(opsEndpoint);
  },
  missingCredentials: async ({ page }: { page: Page }, use) => {
    await page.route(casEndpoint, async (route) =>
      route.fulfill({
        status: 404,
      }),
    );
    await page.route(opsEndpoint, async (route) =>
      route.fulfill({
        status: 404,
      }),
    );

    await use(undefined);

    await page.unroute(casEndpoint);
    await page.unroute(opsEndpoint);
  },
  validCas: async ({ page }: { page: Page }, use) => {
    await use(
      async (
        key: { privateKey: Jwk },
        contents: string,
        issuer: string,
        attestationType: "Article" | "Advertorial" | "OnlineAd" = "Article",
      ) => {
        const { privateKey } = key;
        const issuedAt: Date = new Date(Date.now());
        const expiredAt: Date = addYears(new Date(), 1);
        const unsignedContentAttestation: UnsignedContentAttestation =
          generateUnsignedContentAttestation(contents, issuer, attestationType);
        const contentAttestation = await signCa(
          unsignedContentAttestation,
          privateKey,
          {
            issuedAt,
            expiredAt,
            documentProvider: async () => {
              const window = new Window();
              window.document.write(contents);
              return window.document as unknown as Document;
            },
          },
        );

        await page.route(casEndpoint, async (route) =>
          route.fulfill({
            body: JSON.stringify([
              {
                attestation: contentAttestation,
                main: true,
              },
            ]),
            contentType: "application/json",
          }),
        );
      },
    );

    await page.unroute(casEndpoint);
  },
  validOps: async ({ page }: { page: Page }, use) => {
    await use(
      async (key: { publicKey: Jwk; privateKey: Jwk }, issuer: string) => {
        const { publicKey, privateKey } = key;
        const issuedAt: Date = new Date(Date.now());
        const expiredAt: Date = addYears(new Date(), 1);
        const signedCoreProfile = await signJwtVc(
          generateCoreProfileData(publicKey, issuer),
          privateKey,
          {
            issuedAt,
            expiredAt,
          },
        );
        const annotations = await signJwtVc(
          generateCertificateData(issuer),
          privateKey,
          {
            issuedAt,
            expiredAt,
          },
        );
        const signedMediaProfile = await signJwtVc(
          generateWebMediaProfileData(issuer),
          privateKey,
          {
            issuedAt,
            expiredAt,
          },
        );

        await page.route(opsEndpoint, async (route) =>
          route.fulfill({
            body: JSON.stringify({
              core: signedCoreProfile,
              annotations: [annotations],
              media: signedMediaProfile,
            }),
            contentType: "application/json",
          }),
        );

        await page.unroute(opsEndpoint);
      },
    );
  },
  invalidCas: async ({ page }: { page: Page }, use) => {
    const cas: ContentAttestationSet = [
      {
        attestation: "",
        main: true,
      },
    ];
    await page.route(casEndpoint, async (route) =>
      route.fulfill({
        body: JSON.stringify(cas),
        contentType: "application/json",
      }),
    );

    await use(undefined);

    await page.unroute(casEndpoint);
  },
  missingCas: async ({ page }: { page: Page }, use) => {
    await page.route(casEndpoint, async (route) =>
      route.fulfill({
        status: 404,
      }),
    );

    await use(undefined);

    await page.unroute(casEndpoint);
  },
  evilCas: async ({ page }: { page: Page }, use) => {
    await use(async (contents: string, issuer: string) => {
      const { privateKey } = await generateKey();
      const issuedAt: Date = new Date(Date.now());
      const expiredAt: Date = addYears(new Date(), 1);
      const unsignedContentAttestation: UnsignedContentAttestation =
        generateUnsignedContentAttestation(contents, issuer);
      const contentAttestation = await signCa(
        unsignedContentAttestation,
        privateKey,
        {
          issuedAt,
          expiredAt,
          documentProvider: async () => {
            const window = new Window();
            window.document.write(contents);
            return window.document as unknown as Document;
          },
        },
      );

      await page.route(casEndpoint, async (route) =>
        route.fulfill({
          body: JSON.stringify([
            {
              attestation: contentAttestation,
              main: true,
            },
          ]),
          contentType: "application/json",
        }),
      );
    });

    await page.unroute(casEndpoint);
  },
  missingOps: async ({ page }: { page: Page }, use) => {
    await page.route(opsEndpoint, async (route) =>
      route.fulfill({
        status: 404,
      }),
    );

    await use(undefined);

    await page.unroute(opsEndpoint);
  },
  evilOps: async ({ page }: { page: Page }, use) => {
    await use(async (key: { publicKey: Jwk }, issuer: string) => {
      const { publicKey } = key;
      const { privateKey } = await generateKey();
      const issuedAt: Date = new Date(Date.now());
      const expiredAt: Date = addYears(new Date(), 1);
      const signedCoreProfile = await signJwtVc(
        generateCoreProfileData(publicKey, issuer),
        privateKey,
        {
          issuedAt,
          expiredAt,
        },
      );
      const annotations = await signJwtVc(
        generateCertificateData(issuer),
        privateKey,
        {
          issuedAt,
          expiredAt,
        },
      );
      const signedMediaProfile = await signJwtVc(
        generateWebMediaProfileData(issuer),
        privateKey,
        {
          issuedAt,
          expiredAt,
        },
      );

      await page.route(opsEndpoint, async (route) =>
        route.fulfill({
          body: JSON.stringify({
            core: signedCoreProfile,
            annotations: [annotations],
            media: signedMediaProfile,
          }),
          contentType: "application/json",
        }),
      );

      //await page.unroute(opsEndpoint);
    });
  },
});
