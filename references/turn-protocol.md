# Turn Protocol

## Request

```json
{
  "intent": "view",
  "turnId": "turn-optional",
  "scene": "post",
  "subject": {
    "type": "order",
    "id": "MF260503ORD000001X"
  },
  "actionId": "submit_proof",
  "input": {}
}
```

## Response

```json
{
  "turnId": "turn-optional",
  "scene": "post",
  "subject": {
    "type": "order",
    "id": "MF260503ORD000001X"
  },
  "state": "post_detail",
  "actions": [],
  "result": {},
  "effects": [],
  "projection": {
    "summary": {},
    "raw": {}
  },
  "receipt": null,
  "nextTurn": null
}
```

## Rule

Use `turn` as the business permission and navigation layer. Use OpenAPI as the full field contract layer.

