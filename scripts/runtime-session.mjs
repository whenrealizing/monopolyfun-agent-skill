#!/usr/bin/env node

import { readFile } from "node:fs/promises";

export const DEFAULT_BASE_URL = "https://monopolyfun.app";
const DEFAULT_SESSION_COOKIE_NAME = "MONOPOLYFUN_SESSION";
const DEFAULT_CSRF_COOKIE_NAME = "MONOPOLYFUN_CSRF";

export class HttpError extends Error {
  constructor(message, input) {
    super(message);
    this.name = "HttpError";
    this.status = input.status;
    this.body = input.body;
  }
}

export class ApiSession {
  constructor(input = {}) {
    this.cookieName = input.cookieName ?? DEFAULT_SESSION_COOKIE_NAME;
    this.csrfCookieName = input.csrfCookieName ?? DEFAULT_CSRF_COOKIE_NAME;
    this.cookies = new Map();
    if (input.cookieHeader) {
      this.captureCookieHeader(input.cookieHeader);
    }
  }

  capture(response) {
    const setCookies = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : splitSetCookie(response.headers.get("set-cookie"));
    for (const cookie of setCookies) {
      const [pair] = cookie.split(";");
      const index = pair.indexOf("=");
      if (index <= 0) {
        continue;
      }
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
  }

  captureCookieHeader(cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }
      const index = trimmed.indexOf("=");
      if (index <= 0) {
        continue;
      }
      this.cookies.set(trimmed.slice(0, index), trimmed.slice(index + 1));
    }
  }

  headerValue() {
    return [...this.cookies.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  csrfToken() {
    const csrf = this.cookies.get(this.csrfCookieName);
    return csrf ? decodeURIComponent(csrf) : "";
  }

  headers(hasBody = false) {
    const headers = { Accept: "application/json" };
    if (hasBody) {
      headers["Content-Type"] = "application/json";
    }
    const cookieHeader = this.headerValue();
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }
    const csrfToken = this.csrfToken();
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
    return headers;
  }

  sessionCookiePresent() {
    return this.cookies.has(this.cookieName);
  }

  csrfCookiePresent() {
    return this.cookies.has(this.csrfCookieName);
  }
}

export function parseArgs(argv) {
  const args = [];
  const flags = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      args.push(value);
      continue;
    }
    const body = value.slice(2);
    const equalsIndex = body.indexOf("=");
    if (equalsIndex >= 0) {
      flags.set(body.slice(0, equalsIndex), body.slice(equalsIndex + 1));
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      flags.set(body, next);
      index += 1;
      continue;
    }
    flags.set(body, "true");
  }
  return { args, flags };
}

export function readOption(flags, name, input = {}) {
  const value = flags.get(name)
    ?? firstDefined(input.envKeys?.map((key) => process.env[key]))
    ?? input.defaultValue;
  if (input.required && (value === undefined || value === null || String(value).trim() === "")) {
    throw new Error(`missing required option: ${name}`);
  }
  return typeof value === "string" ? value.trim() : value;
}

export async function apiJson(session, baseUrl, method, path, body = undefined) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: session.headers(body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  session.capture(response);
  const text = await response.text();
  const json = parseJsonLike(text);
  if (!response.ok) {
    throw new HttpError(`${method} ${path} failed`, {
      status: response.status,
      body: json ?? text,
    });
  }
  return json ?? {};
}

export async function registerOrLogin(input) {
  const session = new ApiSession();
  try {
    const registerResponse = await apiJson(session, input.baseUrl, "POST", "/api/v1/auth/register", {
      handle: input.handle,
      password: input.password,
    });
    return {
      mode: "registered",
      session,
      account: normalizeAccount(registerResponse.account, input.handle),
    };
  } catch (error) {
    // 中文注释：账号已存在时直接切到登录路径，保证运行时首次接入和重复接入都走同一脚本。
    if (!isHandleTakenError(error)) {
      throw error;
    }
  }

  const loginResponse = await apiJson(session, input.baseUrl, "POST", "/api/v1/auth/login", {
    handle: input.handle,
    password: input.password,
  });
  return {
    mode: "logged_in",
    session,
    account: normalizeAccount(loginResponse.account, input.handle),
  };
}

export async function loginOrRegister(input) {
  const session = new ApiSession();
  try {
    const loginResponse = await apiJson(session, input.baseUrl, "POST", "/api/v1/auth/login", {
      handle: input.handle,
      password: input.password,
    });
    return {
      mode: "logged_in",
      session,
      account: normalizeAccount(loginResponse.account, input.handle),
    };
  } catch (error) {
    // 中文注释：现网运行时通常是重复登录同一账号，先走登录可以避开注册频控；只有确实不存在时才补注册。
    if (!isInvalidLoginError(error)) {
      throw error;
    }
  }
  const registerResponse = await apiJson(session, input.baseUrl, "POST", "/api/v1/auth/register", {
    handle: input.handle,
    password: input.password,
  });
  return {
    mode: "registered",
    session,
    account: normalizeAccount(registerResponse.account, input.handle),
  };
}

export async function resolveRuntimeAuth(input = {}) {
  const baseUrl = input.baseUrl ?? DEFAULT_BASE_URL;
  const handle = await resolveCredentialValue(input.handle, input.handleFile);
  const password = await resolveCredentialValue(input.password, input.loginFile);
  const cookieHeader = input.cookieHeader?.trim?.() ?? "";
  const csrfToken = input.csrfToken?.trim?.() ?? "";
  if (handle && password) {
    // 中文注释：运行时优先使用 handle/password 现登现取 session，避免长期缓存 cookie 失效后整个 skill 直接瘫痪。
    const auth = await loginOrRegister({ baseUrl, handle, password });
    return {
      baseUrl,
      authMode: auth.mode,
      account: auth.account,
      session: auth.session,
    };
  }
  if (!cookieHeader) {
    throw new Error("missing runtime credentials: provide handle/password or cookie");
  }
  const session = new ApiSession({ cookieHeader });
  if (csrfToken) {
    session.cookies.set(DEFAULT_CSRF_COOKIE_NAME, encodeURIComponent(csrfToken));
  }
  return {
    baseUrl,
    authMode: "cookie",
    account: null,
    session,
  };
}

async function resolveCredentialValue(value, filePath) {
  const direct = value?.trim?.() ?? "";
  if (direct) {
    return direct;
  }
  const path = filePath?.trim?.() ?? "";
  if (!path) {
    return "";
  }
  // 中文注释：OpenClaw 当前版本对 skill env 只支持字符串，敏感值通过文件路径传入时在这里延迟读取，避免把明文凭据留在 openclaw.json。
  return (await readFile(path, "utf8")).trim();
}

export async function runTurnHealthcheck(input) {
  const home = await apiJson(input.session, input.baseUrl, "POST", "/api/v1/agent/turn", {
    intent: "view",
    scene: "home",
  });
  const workbench = await apiJson(input.session, input.baseUrl, "POST", "/api/v1/agent/turn", {
    intent: "view",
    scene: "workbench",
  });
  return {
    home,
    workbench,
    homeTurnOk: true,
    workbenchTurnOk: true,
  };
}

export function buildFailurePayload(error, input = {}) {
  return {
    status: input.status ?? "blocked",
    phase: input.phase ?? "runtime_bootstrap",
    error: {
      name: error?.name ?? "Error",
      message: error instanceof Error ? error.message : String(error),
      status: error?.status,
      body: error?.body,
    },
  };
}

export function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

export function printJsonError(error) {
  if (error === null || error === undefined) {
    return;
  }
  if (typeof error === "string") {
    console.error(error);
    return;
  }
  if (typeof error === "object") {
    console.error(JSON.stringify(error, null, 2));
    return;
  }
  console.error(String(error));
}

export function formatHelp(lines) {
  return `${lines.join("\n")}\n`;
}

function isHandleTakenError(error) {
  return error instanceof HttpError
    && error.status === 409
    && (
      normalizeErrorCode(error.body) === "auth.handle.taken"
      || normalizeErrorMessage(error.body).includes("handle already exists")
    );
}

function isInvalidLoginError(error) {
  return error instanceof HttpError
    && error.status === 401
    && normalizeErrorMessage(error.body).includes("invalid handle or password");
}

function normalizeErrorCode(body) {
  if (!body || typeof body !== "object") {
    return "";
  }
  return String(body.code ?? body.errorCode ?? body.error?.code ?? "").trim();
}

function normalizeErrorMessage(body) {
  if (!body || typeof body !== "object") {
    return "";
  }
  return String(body.message ?? body.error?.message ?? "").trim().toLowerCase();
}

function normalizeAccount(account, fallbackHandle) {
  const value = account && typeof account === "object" ? account : {};
  const displayHandle = String(value.handle ?? fallbackHandle ?? "").replace(/^@+/, "");
  const id = String(value.id ?? "");
  if (!id) {
    throw new Error("auth response missing account.id");
  }
  return {
    id,
    handle: displayHandle,
    displayName: String(value.displayName ?? value.display_name ?? displayHandle),
  };
}

function splitSetCookie(value) {
  if (!value) {
    return [];
  }
  return value.split(/,(?=[^;,]+=)/g);
}

function parseJsonLike(text) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function firstDefined(values = []) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}
