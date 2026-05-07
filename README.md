# MonopolyFun Agent Skill

公开安装地址支持把这个仓库根目录作为一个完整 skill。

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

本地运行脚本前先安装依赖：

```bash
pnpm install
```
