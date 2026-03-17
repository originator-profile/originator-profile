import { ContentAttestation, CoreProfile } from "@originator-profile/model";
import { generatePath } from "react-router";
import { ParseUrlParams } from "typed-url-params";

export function route<Path extends string>(path: Path) {
  return {
    path,
    build(params: ParseUrlParams<Path>) {
      // @ts-expect-error ParserError
      return generatePath(path, params);
    },
  };
}

function urlParamsRoute<Path extends string, T>(
  path: Path,
  getParams: (params: T) => ParseUrlParams<Path>,
) {
  const baseRoute = route(path);
  return {
    ...baseRoute,
    getParams,
  };
}

function getOrgParams({
  contentType,
  cp,
}: {
  contentType: string;
  cp: CoreProfile;
}) {
  return {
    contentType,
    orgIssuer: cp.issuer,
    orgSubject: cp.credentialSubject.id,
  };
}

function getPublParams(ca: ContentAttestation) {
  return { issuer: ca.issuer, subject: ca.credentialSubject.id };
}

export const paths = {
  base: "tab/:tabId",
  org: "org/:contentType/:orgIssuer/:orgSubject",
  publ: "publ/:issuer/:subject",
  site: "site",
  prohibition: "prohibition",
  warning: "warning",
  detail: "detail",
} as const;

export const routes = {
  base: route(`/${paths.base}`),
  org: urlParamsRoute(paths.org, getOrgParams),
  publ: urlParamsRoute(paths.publ, getPublParams),
  site: route(paths.site),
  prohibition: route(paths.prohibition),
  warning: route(paths.warning),
  detail: route(paths.detail),
} as const;

export function buildPublUrl(
  tabId: number | string | undefined,
  ca?: ContentAttestation,
) {
  return [
    routes.base.build({ tabId: String(tabId) }),
    ca ? routes.publ.build(routes.publ.getParams(ca)) : routes.site.build({}),
  ].join("/");
}

export function buildDetailUrl(tabId: number | string | undefined) {
  return [
    routes.base.build({ tabId: String(tabId) }),
    routes.detail.build({}),
  ].join("/");
}
