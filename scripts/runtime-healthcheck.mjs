#!/usr/bin/env node

import {
  ApiSession,
  DEFAULT_BASE_URL,
  buildFailurePayload,
  formatHelp,
  parseArgs,
  printJson,
  readOption,
  runTurnHealthcheck,
} from "./runtime-session.mjs";

const { flags } = parseArgs(process.argv.slice(2));

if (flags.has("help")) {
  process.stdout.write(formatHelp([
    "usage: node scripts/runtime-healthcheck.mjs [--base-url <url>] [--cookie <header>] [--csrf <token>]",
    "",
    "options:",
    "  --base-url    api base url, default https://monopolyfun.app",
    "  --cookie      cookie header, fallback MONOPOLYFUN_COOKIE",
    "  --csrf        csrf token, fallback MONOPOLYFUN_CSRF or csrf cookie",
    "",
    "env fallback:",
    "  MONOPOLYFUN_BASE_URL",
    "  MONOPOLYFUN_COOKIE",
    "  MONOPOLYFUN_CSRF",
  ]));
  process.exit(0);
}

try {
  const baseUrl = readOption(flags, "base-url", {
    envKeys: ["MONOPOLYFUN_BASE_URL"],
    defaultValue: DEFAULT_BASE_URL,
  });
  const cookieHeader = readOption(flags, "cookie", {
    envKeys: ["MONOPOLYFUN_COOKIE"],
    required: true,
  });
  const session = new ApiSession({ cookieHeader });
  const explicitCsrf = readOption(flags, "csrf", {
    envKeys: ["MONOPOLYFUN_CSRF"],
  });
  if (explicitCsrf) {
    // 中文注释：外部运行时有时把 CSRF 单独作为 secret 注入，这里同步回 session 视图，保证请求头稳定。
    session.cookies.set("MONOPOLYFUN_CSRF", encodeURIComponent(explicitCsrf));
  }
  const healthcheck = await runTurnHealthcheck({ baseUrl, session });
  printJson({
    status: "ok",
    runtime: {
      cookiePresent: session.sessionCookiePresent(),
      csrfPresent: session.csrfCookiePresent(),
    },
    checks: {
      homeTurnOk: healthcheck.homeTurnOk,
      workbenchTurnOk: healthcheck.workbenchTurnOk,
    },
  });
} catch (error) {
  printJson(buildFailurePayload(error, {
    status: "blocked",
    phase: "runtime_healthcheck",
  }));
  process.exit(1);
}
