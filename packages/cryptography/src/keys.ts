import {
  createLocalJWKSet as LocalKeys,
  createRemoteJWKSet as RemoteKeys,
} from "jose";

export type Keys = ReturnType<typeof RemoteKeys> | ReturnType<typeof LocalKeys>;

export { LocalKeys, RemoteKeys };
