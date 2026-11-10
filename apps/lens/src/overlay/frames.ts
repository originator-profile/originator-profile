import type {
  FrameLocation,
  FrameResponse,
  TabVerification,
} from "@originator-profile/extension-common";

/**
 * タブの文書のフレームとオリジンを得る
 *
 * オリジンは検証のときに記録したものを使う。about:srcdoc の iframe などは
 * URL からオリジンを求められないため。検証の通知を受けていない文書は含めない
 * @param verification タブが表示している文書群の検証の状態
 */
export const documentFramesOf = ({
  frames,
}: TabVerification): Array<FrameResponse & FrameLocation> =>
  frames.flatMap(({ entry }) =>
    entry
      ? [
          {
            frameId: entry.subject.frameId,
            parentFrameId: entry.subject.parentFrameId,
            origin: entry.subject.origin,
            url: entry.subject.url,
          },
        ]
      : [],
  );
