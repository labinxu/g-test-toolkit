# MCP Service (Fastify + TypeScript)

Local service that accepts a `spec.json` body and returns generated test code. Defaults to port `3003`.

## Scripts

- `npm run dev` – run with tsx in watch mode
- `npm run build` – compile TypeScript to `dist`
- `npm start` – run compiled server

## Endpoints

- `GET /health` – simple health check
- `POST /generate` – body: spec JSON; response: `{ ok, code }`

## Example

POST `/generate` with body:

```
{
  "suite": "APPLogin",
  "module": "LOGIN",
  "userDir": "users/labin",
  "tags": ["REQ-123"],
  "android": { "deviceName": "emulator-5554" },
  "cases": [
    {
      "title": "启动后展示登录页",
      "steps": [
        "用户user1使用密码password登陆",
        "发布帖子帖子内容'hello mcp'"
      ],
      "expects": [
        "检查最新帖子内容为'hello mcp'"
      ]
    }
  ]
}
```

Response includes `code` string containing a `describe(...)` block.

> Note: This project uses ESM and Fastify v5.

