import { exec } from "child_process";
import fs from "fs";
import { createEventStream } from "h3";
import postHTMLFiles from "../utils/postHTMLFiles";
import { opcipName, ogpImageURL } from "#shared/constants";
import { OpSiteInfo } from "../domain/originatorProfileSite";
import { ContentAttestationModel } from "../domain/contentAttestation";

/**
 * 指定したファイルに対して、createOrUpdateCaを実行する
 * @param path
 * @returns Promise<string[]>
 */
const createOrUpdateCa = async (
  accessToken: string,
  caInfo: ContentAttestationModel,
  endpoint: string,
): Promise<string[]> => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(caInfo),
  });

  if (!response.ok) {
    throw new Error(`CA API error: ${response.status} ${response.statusText}`);
  }

  const caJWT = (await response.json()) as unknown as string[];
  return caJWT;
};

/**
 * 指定したファイルを削除する
 * @param casPath
 * @param htmlFiles
 * @returns Promise<string>
 */
const deleteSpecificFiles = (
  casPath: string,
  htmlFiles: OpSiteInfo[],
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const filesToDelete = htmlFiles.map(
      (item) => `${casPath}${item.cas}.cas.json`,
    );
    const deleteCommands = filesToDelete
      .map((file) => `rm -f "${file}"`)
      .join(" && ");

    if (filesToDelete.length === 0) {
      resolve("");
      return;
    }

    exec(deleteCommands, { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      }
      resolve(stdout);
    });
  });
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const WEBROOT_PATH = config.WEBROOT_PATH;
  const VC_OUTPUT_PATH = config.VC_OUTPUT_PATH;
  const CAS_OUTPUT_PATH = config.CAS_OUTPUT_PATH;
  const CA_SERVER_URL = config.CA_SERVER_URL;
  const ISSUER = config.ISSUER;

  if (
    !WEBROOT_PATH ||
    !VC_OUTPUT_PATH ||
    !CAS_OUTPUT_PATH ||
    !CA_SERVER_URL ||
    !ISSUER
  ) {
    throw createError({
      statusCode: 500,
      message: "必要な環境変数が設定されていません",
    });
  }

  const { htmlFiles, allowedURLOrigins } = await readBody(event);
  const eventStream = createEventStream(event);
  const vcSourcesPath = VC_OUTPUT_PATH;
  const casPath = CAS_OUTPUT_PATH;

  const accessToken = getCookie(event, "access_token");
  if (!accessToken) {
    throw createError({
      statusCode: 401,
      message: "アクセストークンが見つかりません。ログインしてください。",
    });
  }

  // see https://nitro.build/guide/websocket#server-sent-events-sse
  await deleteSpecificFiles(casPath, htmlFiles);

  const processedFiles = await postHTMLFiles({
    htmlFiles,
    docsPath: WEBROOT_PATH,
    vcSourcesPath: vcSourcesPath,
    allowedURLOrigins: allowedURLOrigins,
    opcipName: opcipName,
    ogpImageURL: ogpImageURL,
    issuer: ISSUER,
  });

  (async () => {
    for (let i = 0; i < processedFiles.length; i++) {
      const item = processedFiles[i];

      try {
        const caJWT = await createOrUpdateCa(
          accessToken,
          item.casInfo,
          CA_SERVER_URL,
        );
        fs.writeFileSync(
          `${casPath}${item.cas}.cas.json`,
          JSON.stringify(caJWT, null, 2),
        );
        const outputCasData = JSON.stringify({
          ...item,
          // @ts-expect-error vcを削除すると、クライアント側の進行状況が表示されない
          vc: item.vc,
        });
        await eventStream.push(outputCasData);
      } catch (error) {
        console.log(error);
        await eventStream.push(JSON.stringify({ ...item, error }));
      }
    }
  })();
  eventStream.onClosed(async () => {
    console.log("closing SSE...");
    await eventStream.close();
  });

  return eventStream.send();
});
