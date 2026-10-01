export const clientConfig = {
  naverMapClientId:
    process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? "y8bb16v81a",
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://kt-plaza-wait-map.ha-gwangseok.chatgpt.site",
} as const;

