import { z } from "zod";
import JwtDpPayload from "./jwt-dp-payload";
import JwtOpPayload from "./jwt-op-payload";

/** @deprecated */
const JwtProfilePayload = z.union([JwtOpPayload, JwtDpPayload]);

/** @deprecated */
type JwtProfilePayload = z.infer<typeof JwtProfilePayload>;

export default JwtProfilePayload;
