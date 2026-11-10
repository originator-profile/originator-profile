import { describe, expect, test } from "vitest";
import type { TabView } from "../view";
import { contentsOf } from "../view/contents";
import { organizationOf } from "../view/organization";
import {
  ca,
  existencePa,
  originator,
  subFrame,
  topFrame,
} from "../view/test-fixtures";
import { highlightOf } from "./highlight";

const operator = "dns:operator.example";
const publisher = "dns:publisher.example";
const originators = [
  originator(operator, {
    name: "operator",
    annotations: [existencePa(operator, "JP")],
  }),
  originator(publisher, { name: "publisher" }),
];
const contents = contentsOf([
  {
    frame: subFrame,
    cas: [{ main: false, attestation: ca(publisher, "urn:uuid:ad") as never }],
  },
]);
const organization = (id: string) => {
  const found = organizationOf(id, originators);
  if (!found) throw new Error(`${id} not found`);
  return found;
};
const view = (
  site: Extract<TabView, { state: "ready" }>["site"],
): Extract<TabView, { state: "ready" }> => ({
  state: "ready",
  tabId: 1,
  frames: [topFrame, subFrame],
  site,
  contents,
  issuers: new Map([[publisher, organization(publisher)]]),
});

describe("highlightOf", () => {
  test("運営者を開いていればページ全体を強調する", () => {
    const operatorOrganization = organization(operator);
    expect(
      highlightOf(
        view({
          state: "present",
          name: "site",
          operator: operatorOrganization,
        }),
        "site",
      ),
    ).toEqual({
      kind: "page",
      label: {
        name: "operator",
        logo: "https://operator.example/logo.png",
        country: "JP",
      },
    });
  });

  test("コンテンツを開いていれば、そのフレームと範囲を強調する", () => {
    const [content] = contents;
    expect(highlightOf(view({ state: "absent" }), content?.key)).toMatchObject({
      kind: "content",
      key: content?.key,
      frame: subFrame,
      targets: [
        { type: "TextTargetIntegrity", cssSelector: '[data-ca="urn:uuid:ad"]' },
      ],
      label: { name: "publisher" },
    });
  });

  test("何も開いていなければ強調しない", () => {
    expect(highlightOf(view({ state: "absent" }), undefined)).toBe(undefined);
  });
});
