# Zeabur Remote MCP Gateway

A starter stateless MCP-over-HTTP gateway that verifies Zeabur API access. It is read-only at this stage; project, deployment, and log tools should only be added after the live Zeabur GraphQL schema and permissions are verified.

## Environment variables

Configure these in the Zeabur service's **Variables** page. Never put real tokens in GitHub, Docker images, chat messages, or client configuration.

- `ZEABUR_TOKEN`: a Zeabur API token.
- `MCP_ACCESS_TOKEN`: a separate, high-entropy secret used by the MCP endpoint.
- `PORT`: optional; defaults to `8080`.

The two tokens have different purposes. Rotating either token should not require changing source code.

## Deploy on Zeabur

1. Create a Zeabur service from this repository.
2. Set `ZEABUR_TOKEN` and `MCP_ACCESS_TOKEN` in service variables.
3. Expose the service over HTTPS and use port `8080` (or the platform-provided `PORT`).
4. Check `https://YOUR-DOMAIN/health`. It reports whether variables are configured, never their values.
5. If your MCP client supports HTTP Bearer authentication, configure it to connect to `https://YOUR-DOMAIN/mcp`.

## Available MCP tool

- `zeabur_me`: makes a read-only GraphQL query to verify the token and account identity.

## Security notes

- Source code contains no credentials. Keep the repository private if you prefer not to publish the implementation.
- Use a unique, randomly generated `MCP_ACCESS_TOKEN`; do not reuse the Zeabur API token.
- The health endpoint intentionally does not test or disclose credentials.
- Do not add write-capable tools until their exact API operations have been verified and protected with least-privilege access.
- A working endpoint does not guarantee every ChatGPT plan supports custom remote MCP servers. Check the Apps/developer-mode options in your account.

## Local development

```sh
npm install
ZEABUR_TOKEN=... MCP_ACCESS_TOKEN=... npm start
```

This is a starter gateway, not an official Zeabur-hosted MCP server.
