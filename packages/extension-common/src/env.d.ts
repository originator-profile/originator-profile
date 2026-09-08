interface ImportMeta {
  env: {
    /** ビルドモード。アプリのビルド時に注入される */
    MODE: "development" | "production" | "testing";
    /** レジストリ API の Basic 認証を使うか */
    BASIC_AUTH: boolean;
    /** Basic 認証の認証情報 */
    BASIC_AUTH_CREDENTIALS: {
      domain: string;
      username: string;
      password: string;
    }[];
  };
}
