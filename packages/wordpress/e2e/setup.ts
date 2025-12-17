import type { FullConfig } from "@playwright/test";
import child_process from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import util from "node:util";

const exec = util.promisify(child_process.exec);

async function globalSetup(config: FullConfig) {
  process.env.WORDPRESS_ADMIN_USER = `profile-tester-${crypto.randomInt(
    65535,
  )}`;
  process.env.WORDPRESS_ADMIN_PASSWORD = crypto
    .randomBytes(32)
    .toString("base64url");
  await exec(path.resolve(__dirname, "docker-setup.sh"));

  // @wordpress/e2e-test-utils-playwright requestUtils.setupRest() で WP_BASE_URL がハードコードされており、RequestUtils.setup() で baseURL を与えても機能しないため指定
  // https://github.com/WordPress/gutenberg/blob/6d77fd28f50adb39040d27cb797b9fc3a1393ef7/packages/e2e-test-utils-playwright/src/request-utils/rest.ts#L11-L39
  // https://github.com/WordPress/gutenberg/issues/53277
  process.env.WP_BASE_URL = config.projects[0].use.baseURL;

  const { RequestUtils } = await import("@wordpress/e2e-test-utils-playwright");
  const requestUtils = await RequestUtils.setup({
    user: {
      username: process.env.WORDPRESS_ADMIN_USER,
      password: process.env.WORDPRESS_ADMIN_PASSWORD,
    },
    baseURL: config.projects[0].use.baseURL,
    storageStatePath: config.projects[0].use.storageState?.toString(),
  });

  // 認証後、storageStateを保存
  await requestUtils.setupRest();
}

export default globalSetup;
