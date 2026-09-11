declare module "*.css";

interface ImportMeta {
  env: {
    MODE: "development" | "production" | "testing";
    BASIC_AUTH: boolean;
    BASIC_AUTH_CREDENTIALS: {
      domain: string;
      username: string;
      password: string;
    }[];
  };
}
