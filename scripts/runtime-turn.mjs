#!/usr/bin/env node

import {
  DEFAULT_BASE_URL,
  apiJson,
  buildFailurePayload,
  formatHelp,
  parseArgs,
  printJson,
  readOption,
  resolveRuntimeAuth,
} from "./runtime-session.mjs";

const { args, flags } = parseArgs(process.argv.slice(2));

if (flags.has("help")) {
  process.stdout.write(formatHelp([
    "usage: node scripts/runtime-turn.mjs '{\"intent\":\"view\",\"scene\":\"home\"}'",
    "   or: node scripts/runtime-turn.mjs --input '{\"intent\":\"view\",\"scene\":\"home\"}'",
    "",
    "runtime auth priority:",
    "  1. MONOPOLYFUN_HANDLE + MONOPOLYFUN_PASSWORD",
    "  2. MONOPOLYFUN_COOKIE + optional MONOPOLYFUN_CSRF",
    "",
    "options:",
    "  --input       turn payload json string",
    "  --base-url    api base url, default https://monopolyfun.app",
    "  --handle      monopolyfun account handle",
    "  --password    monopolyfun account password",
    "  --handle-file file that stores monopolyfun account handle",
    "  --login-file  file that stores monopolyfun login secret",
    "  --cookie      cookie header",
    "  --csrf        csrf token",
  ]));
  process.exit(0);
}

try {
  const rawInput = readOption(flags, "input", {
    defaultValue: args[0],
  });
  if (!rawInput) {
    throw new Error("missing required turn input");
  }
  const input = JSON.parse(rawInput);
  const baseUrl = readOption(flags, "base-url", {
    envKeys: ["MONOPOLYFUN_BASE_URL"],
    defaultValue: DEFAULT_BASE_URL,
  });
  const handle = readOption(flags, "handle", {
    envKeys: ["MONOPOLYFUN_HANDLE"],
  });
  const handleFile = readOption(flags, "handle-file", {
    envKeys: ["MONOPOLYFUN_HANDLE_FILE"],
  });
  const password = readOption(flags, "password", {
    envKeys: ["MONOPOLYFUN_PASSWORD", "MONOPOLYFUN_LOGIN_SECRET", "MONOPOLYFUN_LOGIN_VALUE"],
  });
  const loginFile = readOption(flags, "login-file", {
    envKeys: ["MONOPOLYFUN_LOGIN_FILE"],
  });
  const cookieHeader = readOption(flags, "cookie", {
    envKeys: ["MONOPOLYFUN_COOKIE"],
  });
  const csrfToken = readOption(flags, "csrf", {
    envKeys: ["MONOPOLYFUN_CSRF"],
  });
  const runtime = await resolveRuntimeAuth({
    baseUrl,
    handle,
    handleFile,
    password,
    loginFile,
    cookieHeader,
    csrfToken,
  });
  const result = await apiJson(runtime.session, baseUrl, "POST", "/api/v1/agent/turn", input);
  printJson(result);
} catch (error) {
  printJson(buildFailurePayload(error, {
    status: "blocked",
    phase: "runtime_turn",
  }));
  process.exit(1);
}
