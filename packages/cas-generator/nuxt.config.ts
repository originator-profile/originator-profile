import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  modules: ["@nuxt/icon"],
  devServer: {
    port: 4000,
  },
  telemetry: false,
  vite: {
    plugins: [tailwindcss()],
  },
  css: ["~/assets/css/tailwind.css"],

  // サーバーサイドで環境変数を使用するための設定
  runtimeConfig: {
    // CAS連携用の環境変数
    WEBROOT_PATH: process.env.WEBROOT_PATH,
    VC_OUTPUT_PATH: process.env.VC_OUTPUT_PATH,
    CAS_OUTPUT_PATH: process.env.CAS_OUTPUT_PATH,
    // 認証サーバーに必要な環境変数
    OIDC_TOKEN: process.env.OIDC_TOKEN,
    CA_SERVER_URL:
      process.env.CA_SERVER_URL ?? "https://opca-api.facere.biz/ca",
    ISSUER: process.env.ISSUER,
  },

  // NOTE: unenv@2.0.0-rc.15 + cloudflare の組み合わせで問題あり
  // Cloudflare Workers でのビルドエラーを回避するために node-server プリセットを使用
  nitro: {
    preset: "node-server",
  },
});
