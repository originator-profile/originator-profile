import { GetDataType } from "@webext-core/messaging";

/** window & targetOrigin 指定可能な defineWindowMessaging() */
export function defineWindowMessaging<T extends Record<string, unknown>>() {
  function sendMessage<TType extends keyof T>(
    type: TType,
    data: GetDataType<T[TType]>,
    window?: Window | null,
    targetOrigin?: URL["origin"],
  ): void {
    if (targetOrigin) {
      window?.postMessage({ type, data }, targetOrigin);
    } else {
      window?.postMessage({ type, data });
    }
  }
  function onMessage<TType extends keyof T>(
    type: TType,
    handler: (event: MessageEvent<GetDataType<T[TType]>>) => void,
  ): () => void {
    function listener(
      event: MessageEvent<{
        type: keyof T;
        data: GetDataType<T[TType]>;
      }>,
    ) {
      if (!event.isTrusted || event.data.type !== type) return;
      handler(
        new MessageEvent("message", {
          data: event.data.data,
          origin: event.origin,
          lastEventId: event.lastEventId,
          source: event.source,
          ports: [...event.ports],
        }),
      );
    }
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }
  return {
    sendMessage,
    onMessage,
  };
}
