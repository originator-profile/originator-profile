import { z } from "zod";
import Dp from "./dp";
import Op from "./op";

/** @deprecated */
const Profile = z.union([Op, Dp]);

/** @deprecated */
type Profile = z.infer<typeof Profile>;

export default Profile;
