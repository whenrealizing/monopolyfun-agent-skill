#!/usr/bin/env node

// 中文注释：公开安装后的 skill 默认连接正式站点，首次运行即可直接指向 MonopolyFun 在线环境。
const baseUrl = process.env.MONOPOLYFUN_BASE_URL ?? "https://monopolyfun.app";
const raw = process.argv[2];
const cookie = process.env.MONOPOLYFUN_COOKIE ?? "";
const csrfFromCookie = cookie.match(/(?:^|;\s*)MONOPOLYFUN_CSRF=([^;]+)/)?.[1];
const csrfToken = process.env.MONOPOLYFUN_CSRF ?? csrfFromCookie;

if (!raw) {
  console.error("usage: node scripts/turn.mjs '{\"intent\":\"view\",\"scene\":\"home\"}'");
  process.exit(1);
}

const response = await fetch(`${baseUrl}/api/v1/agent/turn`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(cookie ? { cookie } : {}),
    ...(csrfToken ? { "X-CSRF-Token": decodeURIComponent(csrfToken) } : {}),
  },
  body: raw,
});

const text = await response.text();
if (!response.ok) {
  console.error(text);
  process.exit(1);
}

console.log(JSON.stringify(JSON.parse(text), null, 2));
