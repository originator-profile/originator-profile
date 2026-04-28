if (import.meta.env.BASIC_AUTH) {
  const __fetch = globalThis.fetch;

  globalThis.fetch = async function fetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = new URL(input instanceof Request ? input.url : input);
    const auth = import.meta.env.BASIC_AUTH_CREDENTIALS.find(
      ({ domain }) => domain === url.hostname,
    );

    return await __fetch(
      input,
      auth
        ? {
            ...init,
            headers: {
              authorization: `Basic ${btoa(`${auth.username}:${auth.password}`)}`,
              ...init?.headers,
            },
            credentials: "include",
          }
        : init,
    );
  };
}
