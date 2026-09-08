interface ImportMeta {
  env: {
    /** ビルドモード。アプリのビルド時に注入される */
    MODE: "development" | "production" | "testing";
  };
}
