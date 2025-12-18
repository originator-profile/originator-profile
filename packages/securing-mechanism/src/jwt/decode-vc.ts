import { OpVc } from "@originator-profile/model";
import {
  decodeJwt,
  decodeProtectedHeader,
  JWTPayload,
  ProtectedHeaderParameters,
} from "jose";
import { JWTInvalid } from "jose/errors";
import { VcDecodeFailed } from "../errors";
import { toUnverifiedJwtVc } from "./map-vc";
import { JwtVcDecodingFailure, JwtVcDecodingResult } from "./types";

/**
 * データモデルの復号器の生成
 * @return 復号器
 */
export function JwtVcDecoder<T extends OpVc>() {
  /**
   * データモデルの複号
   * @param jwt JWT
   * @return 複号結果
   */
  function decode(jwt: string): JwtVcDecodingResult<T> {
    let payload: JWTPayload;
    let protectedHeader: ProtectedHeaderParameters;
    try {
      payload = decodeJwt(jwt);
      protectedHeader = decodeProtectedHeader(jwt);
    } catch (e) {
      const error = e as JWTInvalid | TypeError;
      return new VcDecodeFailed<JwtVcDecodingFailure>(
        "JWT VC Decoding Failure",
        {
          source: jwt,
          error,
        },
      );
    }
    return toUnverifiedJwtVc<T>(payload, protectedHeader, jwt);
  }

  return decode;
}

export type JwtVcDecoder<T extends OpVc> = ReturnType<typeof JwtVcDecoder<T>>;
