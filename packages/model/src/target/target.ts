import { z } from "zod";
import { BasicTarget } from "./basic-target";
import { ExternalResourceTarget } from "./external-resource-target";

export const Target = z.union([BasicTarget, ExternalResourceTarget]);

export type Target = z.infer<typeof Target>;
