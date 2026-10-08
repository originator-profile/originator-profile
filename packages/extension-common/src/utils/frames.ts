type FrameDetails = {
  parentFrameId: number;
  frameType?: chrome.extensionTypes.FrameType;
  documentLifecycle?: chrome.extensionTypes.DocumentLifecycle;
};

/**
 * webNavigation が返すフレームの frameType と documentLifecycle を補う
 *
 * NOTE: Firefox は frameType と documentLifecycle を返さない。Firefox には
 * fenced frame とプリレンダリングがないため、親フレームの有無から frameType を
 * 補い、documentLifecycle は active とみなす
 */
export const withFrameType = <T extends FrameDetails>(
  frame: T,
): T & Required<Pick<FrameDetails, "frameType" | "documentLifecycle">> => ({
  ...frame,
  frameType:
    frame.frameType ??
    (frame.parentFrameId === -1 ? "outermost_frame" : "sub_frame"),
  documentLifecycle: frame.documentLifecycle ?? "active",
});

/** タブのフレームを、frameType と documentLifecycle を補って得る */
export async function getAllFrames(tabId: number) {
  const frames = (await chrome.webNavigation.getAllFrames({ tabId })) ?? [];
  return frames.map(withFrameType);
}

/** フレームを、frameType と documentLifecycle を補って得る */
export async function getFrame(details: chrome.webNavigation.GetFrameDetails) {
  const frame = await chrome.webNavigation.getFrame(details);
  return frame && withFrameType(frame);
}
