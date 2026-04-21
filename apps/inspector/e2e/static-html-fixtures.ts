import { test as base, Page } from "@playwright/test";

type TestFixtures = {
  credentialsMissingPage: {
    contents: string;
    endpoint: string;
    issuer: string;
  };
  credentialsPage: { contents: string; endpoint: string; issuer: string };
  onlineAdPage: { contents: string; endpoint: string; issuer: string };
};

export const test = base.extend<TestFixtures>({
  // ops/casが未設置のhtml
  credentialsMissingPage: async ({ page }: { page: Page }, use) => {
    const credentialsMissingHtml = `
<!doctype html>
<html lang="ja" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width" />
  <title>OPSとCASが未設置のテストページ</title>
</head>
<body>
  <p id="text-target-integrity">OPSとCASが未設置のテストページ</p>
</body>
</html>`;

    const endpoint = "http://localhost:8080/examples/credentials-missing.html";
    await page.route(endpoint, async (route) =>
      route.fulfill({
        body: credentialsMissingHtml,
        contentType: "text/html",
      }),
    );

    await use({
      contents: credentialsMissingHtml,
      endpoint,
      issuer: "dns:localhost",
    });

    await page.unroute(endpoint);
  },
  credentialsPage: async ({ page }: { page: Page }, use) => {
    const endpoint = "http://localhost:8080/examples/credentials.html";
    const validCredentialsHtml = `
<!doctype html>
<html lang="ja" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width" />
  <title>正常なCAS/OPSが設置されているテストページ</title>
</head>
<body>
  <script
    src="http://localhost:8080/examples/ops.json"
    type="application/ops+json"
  ></script>
  <script
    src="http://localhost:8080/examples/cas.json"
    type="application/cas+json"
  ></script>
  <p id="text-target-integrity">正常なCAS/OPSが設置されているテストページ</p>
</body>
</html>`;
    await page.route(endpoint, async (route) =>
      route.fulfill({
        body: validCredentialsHtml,
        contentType: "text/html",
      }),
    );

    await use({
      contents: validCredentialsHtml,
      endpoint,
      issuer: "dns:localhost",
    });

    await page.unroute(endpoint);
  },
  onlineAdPage: async ({ page }: { page: Page }, use) => {
    const endpoint = "http://localhost:8080/examples/online-ad.html";
    const onlineAdHtml = `
<!doctype html>
<html lang="ja" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width" />
  <title>OnlineAd Contentテストページ</title>
</head>
<body>
  <script
    src="http://localhost:8080/examples/ops.json"
    type="application/ops+json"
  ></script>
  <script
    src="http://localhost:8080/examples/cas.json"
    type="application/cas+json"
  ></script>
  <div id="text-target-integrity">
    <div class="ad-container">
      <h3>テスト広告</h3>
      <p>これはOnlineAd Content Attestationのテスト広告です</p>
      <a href="https://example.com">詳細を見る</a>
    </div>
  </div>
</body>
</html>`;
    await page.route(endpoint, async (route) =>
      route.fulfill({
        body: onlineAdHtml,
        contentType: "text/html",
      }),
    );

    await use({ contents: onlineAdHtml, endpoint, issuer: "dns:localhost" });

    await page.unroute(endpoint);
  },
});
