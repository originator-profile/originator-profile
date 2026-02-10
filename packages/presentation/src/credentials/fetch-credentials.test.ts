import { Window } from "happy-dom";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { CredentialsFetchFailed } from "./errors";
import { fetchOriginatorProfileSet } from "./fetch-credentials";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe("Originator Profile Set", () => {
  const opsUrl = "https://example.com/ops.json";
  const ops = [
    {
      core: "eyJ...",
      annotations: ["eyJ..."],
      media: ["eyJ..."],
    },
  ];

  test("有効な URL 指定時 Originator Profile Set が得られる", async () => {
    server.use(http.get(opsUrl, () => HttpResponse.json(ops)));

    const window = new Window();
    window.document.body.innerHTML = `
<script
  src="${opsUrl}"
  rel="alternate"
  type="application/ops+json"
/>`;
    const result = await fetchOriginatorProfileSet(
      window.document as unknown as Document,
    );
    expect(result).toStrictEqual(ops);
  });

  test("無効なエンドポイント指定時 Originator Profile Set の取得に失敗", async () => {
    const window = new Window();
    window.document.body.innerHTML = `
<script
  src=""
  rel="alternate"
  type="application/ops+json"
/>`;
    const result = await fetchOriginatorProfileSet(
      window.document as unknown as Document,
    );
    expect(result).toBeInstanceOf(CredentialsFetchFailed);
    // @ts-expect-error result is CredentialsFetchFailed
    expect(result.message).toBe(`Credentials fetch failed:\nInvalid URL`);
  });

  test("取得先に Originator Profile Set が存在しないとき取得に失敗", async () => {
    server.use(
      http.get(
        "https://example.com/ops.json",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    const window = new Window();
    window.document.body.innerHTML = `
<script
  src="${opsUrl}"
  rel="alternate"
  type="application/ops+json"
/>`;
    const result = await fetchOriginatorProfileSet(
      window.document as unknown as Document,
    );
    expect(result).toBeInstanceOf(CredentialsFetchFailed);
    // @ts-expect-error result is CredentialsFetchFailed
    expect(result.message).toBe(
      `Credentials fetch failed:\nHTTP status code 404`,
    );
  });
});

describe("<script> 要素が2つ以上存在するとき", () => {
  const ops1 = [
    {
      core: "eyJ...",
      annotations: ["eyJ..."],
      media: ["eyJ..."],
    },
  ];
  const ops2 = [
    {
      core: "eyJ...",
      annotations: ["eyJ..."],
      media: ["eyJ..."],
    },
  ];
  test("有効な Originator Profile Set が得られる", async () => {
    server.use(
      http.get("https://example.com/1/ops.json", () => HttpResponse.json(ops1)),
      http.get("https://example.com/2/ops.json", () => HttpResponse.json(ops2)),
    );

    const window = new Window();
    const profileEndpoints = [
      "https://example.com/1/ops.json",
      "https://example.com/2/ops.json",
    ];
    window.document.body.innerHTML = profileEndpoints
      .map(
        (endpoint) => `
<script
  src="${endpoint}"
  rel="alternate"
  type="application/ops+json"
/>
  `,
      )
      .join("");
    const result = await fetchOriginatorProfileSet(
      window.document as unknown as Document,
    );
    expect(result).not.toBeInstanceOf(CredentialsFetchFailed);
    expect(result).toMatchSnapshot();
  });
});

test("エンドポイントを指定しない時 空の配列が得られる", async () => {
  const window = new Window();
  const result = await fetchOriginatorProfileSet(
    window.document as unknown as Document,
  );
  expect(result).toBeInstanceOf(Array);
  expect(result).toHaveLength(0);
});

describe("<script>要素から Originator Profile Set を取得する", () => {
  const ops = [
    {
      core: "eyJ...",
      annotations: ["eyJ..."],
      media: ["eyJ..."],
    },
  ];

  beforeEach(() => {
    server.use(
      http.get("https://example.com/1/ops.json", () => HttpResponse.json(ops)),
    );
  });

  test("<script> から Originator Profile Set を取得できる", async () => {
    const window = new Window();
    window.document.body.innerHTML = `
<script type="application/ops+json">${JSON.stringify(ops)}</script>
`;

    const result = await fetchOriginatorProfileSet(
      window.document as unknown as Document,
    );
    expect(result).not.toBeInstanceOf(CredentialsFetchFailed);
    expect(result).toMatchSnapshot();
  });

  test("<script> が2つ以上存在する", async () => {
    const window = new Window();
    window.document.body.innerHTML = `
<script type="application/ops+json">${JSON.stringify(ops)}</script>
<script type="application/ops+json">${JSON.stringify(ops)}</script>
`;

    const result = await fetchOriginatorProfileSet(
      window.document as unknown as Document,
    );
    expect(result).not.toBeInstanceOf(CredentialsFetchFailed);
    expect(result).toMatchSnapshot();
  });

  test("埋め込み・参照両方から Originator Profile Set を取得できる", async () => {
    const window = new Window();
    const profileEndpoint = "https://example.com/1/ops.json";
    window.document.body.innerHTML = `
<script type="application/ops+json">${JSON.stringify(ops)}</script>
<script src="${profileEndpoint}" rel="alternate" type="application/ops+json" />
`;

    const result = await fetchOriginatorProfileSet(
      window.document as unknown as Document,
    );
    expect(result).not.toBeInstanceOf(CredentialsFetchFailed);
    expect(result).toMatchSnapshot();
  });
});
