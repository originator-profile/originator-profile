/** Originator Profile Set のメディアタイプ */
export const OPS_MEDIA_TYPE = "application/op-set+json";
/** Content Attestation Set のメディアタイプ */
export const CAS_MEDIA_TYPE = "application/ca-set+json";

/**
 * 非推奨の Originator Profile Set のメディアタイプ
 * @deprecated 2027-11-01 以降はサポート外。代わりに {@link OPS_MEDIA_TYPE} を用いる
 */
export const DEPRECATED_OPS_MEDIA_TYPE = "application/ops+json";
/**
 * 非推奨の Content Attestation Set のメディアタイプ
 * @deprecated 2027-11-01 以降はサポート外。代わりに {@link CAS_MEDIA_TYPE} を用いる
 */
export const DEPRECATED_CAS_MEDIA_TYPE = "application/cas+json";

/** 検証者が Originator Profile Set として受理するメディアタイプ */
export const OPS_ACCEPTED_MEDIA_TYPES = [
  OPS_MEDIA_TYPE,
  DEPRECATED_OPS_MEDIA_TYPE,
] as const;
/** 検証者が Content Attestation Set として受理するメディアタイプ */
export const CAS_ACCEPTED_MEDIA_TYPES = [
  CAS_MEDIA_TYPE,
  DEPRECATED_CAS_MEDIA_TYPE,
] as const;
