import type { Jwk } from "@originator-profile/model";

export interface OriginatorProfileOptions {
  /** Mapping of OP ID to signing key (JWK object or JSON string). */
  issuers: Record<string, string | Jwk>;
  /** Duration until signed credentials expire. Defaults to "1y". */
  expiresIn?: string;
  wsp?: {
    /** Path to unsigned Site Profile, relative to project root. Defaults to "./sp.json". */
    input?: string;
  };
}
