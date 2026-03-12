import { z } from "zod";
import OpCertifier from "./op-certifier";
import OpCredential from "./op-credential";
import OpHolder from "./op-holder";
import OpVerifier from "./op-verifier";

/** @deprecated */
const OpItem = z.union([OpHolder, OpCredential, OpCertifier, OpVerifier]);

/** @deprecated */
type OpItem = z.infer<typeof OpItem>;

export default OpItem;
