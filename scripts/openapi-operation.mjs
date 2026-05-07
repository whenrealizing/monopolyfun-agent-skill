#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 中文注释：GitHub 安装后的 skill 优先连线上 OpenAPI，离线或本地开发再由环境变量覆盖。
const baseUrl = process.env.MONOPOLYFUN_BASE_URL ?? "https://monopolyfun.app";
const operationId = process.argv[2];
const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultSnapshot = resolve(skillDir, "references/openapi-snapshot.json");

if (!operationId) {
  console.error("usage: node scripts/openapi-operation.mjs submitProof");
  process.exit(1);
}

const { text, source } = await loadSpecText();
const result = extractOpenApiOperation(text, operationId);
console.log(JSON.stringify({ ...result, source }, null, 2));
process.exit(0);

console.error(`operationId not found: ${operationId}`);
process.exit(1);

async function loadSpecText() {
  const configuredSnapshot = process.env.MONOPOLYFUN_OPENAPI_FILE;
  if (configuredSnapshot) {
    return readSnapshotText(configuredSnapshot);
  }

  try {
    const response = await fetch(`${baseUrl}/v3/api-docs`);
    if (response.ok) {
      return {
        source: `${baseUrl}/v3/api-docs`,
        text: await response.text(),
      };
    }
    console.error(await response.text());
  } catch (error) {
    // 中文注释：本地 API 未启动时使用随 skill 保存的 OpenAPI 快照，保证离线 agent 也能查接口。
    console.error(`runtime OpenAPI unavailable, falling back to ${defaultSnapshot}`);
  }

  return readSnapshotText(defaultSnapshot);
}

async function readSnapshotText(path) {
  return {
    source: path,
    text: await readFile(path, "utf8"),
  };
}

function extractOpenApiOperation(rawDoc, targetOperationId) {
  const operationIndex = rawDoc.search(new RegExp(`"operationId"\\s*:\\s*"${escapeRegExp(targetOperationId)}"`));
  if (operationIndex < 0) {
    throw new Error(`operationId not found: ${targetOperationId}`);
  }
  const methodMatch = lastMatchBefore(rawDoc, /"(get|post|put|patch|delete)"\s*:\s*\{/g, operationIndex);
  const pathMatch = lastMatchBefore(rawDoc, /"(\/[^"]+)"\s*:\s*\{/g, methodMatch?.index ?? operationIndex);
  if (!methodMatch || !pathMatch) {
    throw new Error(`operation envelope not found: ${targetOperationId}`);
  }
  const operationStart = methodMatch.index + methodMatch[0].lastIndexOf("{");
  const operationEnd = findMatchingBrace(rawDoc, operationStart);
  if (operationEnd < operationIndex) {
    throw new Error(`operation envelope mismatch: ${targetOperationId}`);
  }
  // 中文注释：只解析命中的 operation 小窗口，避免让 agent 读取整份 OpenAPI。
  const operation = JSON.parse(rawDoc.slice(operationStart, operationEnd + 1));
  return {
    path: pathMatch[1],
    method: methodMatch[1].toUpperCase(),
    operation,
  };
}

function lastMatchBefore(text, pattern, beforeIndex) {
  let match;
  let last = null;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index >= beforeIndex) {
      break;
    }
    last = match;
  }
  return last;
}

function findMatchingBrace(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  throw new Error(`OpenAPI object brace not closed near index ${startIndex}`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
