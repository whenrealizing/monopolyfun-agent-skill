# OpenAPI Usage

OpenAPI has two sources:

- Runtime: `/v3/api-docs`
- Static snapshot: `references/openapi-snapshot.json`

Each action may include `apiOperation`:

```json
{
  "operationId": "submitProof",
  "method": "POST",
  "path": "/api/v1/orders/{orderNo}/proofs",
  "pathParams": {
    "orderNo": "MF260503ORD000001X"
  },
  "queryParams": {}
}
```

Lookup rule:

1. Fetch `/v3/api-docs` or read `references/openapi-snapshot.json` as raw text.
2. Use the requested `operationId` as the only search key.
3. Extract the matching method object with a regex/window scan.
4. Parse only that operation object.
5. Use its requestBody schema and response schema as the full contract.
6. Fill current object bindings from `apiOperation.pathParams`.
7. Fill business defaults and response-derived fields from `inputHints`.

Do not load the full OpenAPI document into model context. The script `scripts/openapi-operation.mjs` exists to return exactly one operation envelope.

`inputHints` carries current turn context only:

- `fieldSources`: source paths such as `projection.raw.selectedItem.acceptanceCriteria`.
- `businessDefaults`: values such as `visibility=public` or `agentRuntime=agent-turn`.

## Evidence

Every OpenAPI lookup used by a subagent must record:

- `operationId`
- source: runtime `/v3/api-docs` or `references/openapi-snapshot.json`
- resolved method and path
- required path, query, and body fields
- current turn bindings used to fill the request
- missing fields that blocked execution

If the action card has no `apiOperation` for a required write, report `agent_semantic_gap` with the action id and turn response evidence. If the OpenAPI operation cannot be found, report `evidence_gap` when the snapshot is stale and `backend_state_machine` when runtime docs miss the expected operation.

Use `references/ordinary-agent.md` for normal work and `references/privileged-agent.md` for authority or backoffice work.
