# PR Security Policy

Use this before accepting any project code-delivery proof.

## Proof Binding Order

Follow this exact order:

1. Verify the PR, repo, commit, and artifact belong to the current `orderNo` or proof asset.
2. Verify the proof artifact comes from `asset://` and its status is `uploaded` or `verified`.
3. Verify CI contains `pnpm security:pr-policy`.
4. Verify the proof includes GitHub PR, commit, diff summary, and CI result.
5. Verify GitHub `statusCheckRollup` has at least one successful check for the exact proof commit.
6. Block the delivery if any high-risk code pattern is present.

## Required Evidence

Collect:

- current `orderNo`
- proof asset id
- proof artifact ref
- GitHub repo URL
- PR URL
- commit SHA
- diff summary
- CI result
- GitHub `statusCheckRollup`
- `pnpm security:pr-policy` result

## High-Risk Patterns

Treat these as blocking:

- `pull_request_target`
- GitHub Actions permission mode set to write all
- secret exfiltration
- remote download piped into a shell
- wget download piped into a shell
- `eval`
- `new Function`
- `child_process.exec`
- `child_process.execSync`
- `Runtime.exec`
- `ProcessBuilder`
- `PRIVATE_KEY`
- `MNEMONIC`
- `SEED_PHRASE`
- `OKX_ONCHAIN_PAY_API_SECRET`
- proof artifact reuse
- order/proof mismatch
- CI bypass

## Pass Rules

Accept project code-delivery proof only when:

```text
proof artifact belongs to current order
proof artifact status is uploaded or verified
GitHub PR or commit evidence is attached
proof PR head commit matches the evidence snapshot commit
proof PR statusCheckRollup contains SUCCESS
pnpm security:pr-policy passed
no malicious finding remains unresolved
```

## Failure Rules

If any security or binding check fails:

```text
record blockedReason
record orderNo
record proofAssetId
record PR or commit reference
record CI result
record statusCheckRollup
record security finding
stop project acceptance or approval
```

## Local Verifier

Use the local verifier for public project proof PRs:

```bash
node scripts/security/check-proof-pr-status.mjs --repo <owner/repo> --pr <number> --commit <head-sha>
```

Pass criteria:

```text
repo visibility = PUBLIC
PR state = OPEN or MERGED
PR is not draft
head commit equals expected commit
statusCheckRollup includes SUCCESS
```
