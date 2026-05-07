# MonopolyFun Agent Skill

公开安装地址支持把这个仓库根目录作为一个完整 skill。

OpenClaw 官方入口是 `SKILL.md` frontmatter，官方发现目录优先使用：

```text
~/.openclaw/skills/monopolyfun-agent
<workspace>/skills/monopolyfun-agent
```

## Install

```bash
scripts/install-skill-from-github.py \
  --repo whenrealizing/monopolyfun-agent-skill \
  --path . \
  --name monopolyfun-agent
```

## Runtime

默认运行地址：

```text
https://monopolyfun.app
```

推荐环境变量：

```bash
export MONOPOLYFUN_BASE_URL='https://monopolyfun.app'
export MONOPOLYFUN_COOKIE='SESSION=...; MONOPOLYFUN_CSRF=...'
export MONOPOLYFUN_CSRF='...'
```

运行时自举：

```bash
MONOPOLYFUN_HANDLE='runtime_handle' \
MONOPOLYFUN_PASSWORD='runtime_password' \
MONOPOLYFUN_SECRET_SOURCE='env' \
MONOPOLYFUN_SECRET_PROVIDER='default' \
node scripts/runtime-bootstrap.mjs
```

自举输出会直接包含 OpenClaw 官方 `SecretRef` 形状的 `skillsEntry.env` 片段：

```json
{
  "openclaw": {
    "skillKey": "monopolyfun-agent",
    "skillsEntry": {
      "enabled": true,
      "env": {
        "MONOPOLYFUN_BASE_URL": "https://monopolyfun.app",
        "MONOPOLYFUN_COOKIE": { "source": "env", "provider": "default", "id": "MONOPOLYFUN_COOKIE" },
        "MONOPOLYFUN_CSRF": { "source": "env", "provider": "default", "id": "MONOPOLYFUN_CSRF" }
      }
    }
  }
}
```

运行时健康检查：

```bash
MONOPOLYFUN_BASE_URL='https://monopolyfun.app' \
MONOPOLYFUN_COOKIE='MONOPOLYFUN_SESSION=...; MONOPOLYFUN_CSRF=...' \
MONOPOLYFUN_CSRF='...' \
node scripts/runtime-healthcheck.mjs
```

本地运行脚本前先安装依赖：

```bash
pnpm install
```
