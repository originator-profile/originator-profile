declare module "*.css";

interface ImportMeta {
  env: {
    MODE: "development" | "production" | "testing";
  };
}
