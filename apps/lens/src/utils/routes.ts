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

export const paths = {
  base: "tab/:tabId",
  warning: "warning",
} as const;

export const routes = {
  base: route(`/${paths.base}`),
  warning: route(paths.warning),
} as const;
