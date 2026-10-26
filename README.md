# OpenCode ChatGPT Quota

An OpenCode plugin that displays ChatGPT subscription quotas in the right-hand sidebar:

- the **5-hour** usage window;
- the **weekly** usage window;
- remaining percentage, a progress bar, and time until reset.

Quota data refreshes every 60 seconds. These are ChatGPT subscription quotas, not OpenAI API rate limits.

## Requirements

- OpenCode with V2 plugin support;
- Git installed;
- an OpenAI account connected to OpenCode using an OAuth Codex login accepted by ChatGPT's usage endpoint.

## Install with an AI coding assistant

This repository is public, so GitHub authentication is not required to read or install it.

### Prompt for your assistant

Copy and paste this request into your coding agent:

> Install the public OpenCode plugin `martinf08/opencode-chatgpt-quota`. Use `opencode plugin add github:martinf08/opencode-chatgpt-quota`, then verify with `opencode plugin list` and reload OpenCode. Inspect the global configuration before changing it: if a local copy of this same plugin is already enabled, replace that entry rather than loading a duplicate. Preserve all other plugins and settings. Never ask the user to paste a GitHub or OpenAI token into chat, a file, or a log. Finish by explaining how to connect the OpenAI account and open the sidebar.

### Manual installation

Run these commands in a terminal:

```sh
opencode plugin add github:martinf08/opencode-chatgpt-quota
opencode plugin list
opencode reload
```

OpenCode supports GitHub Git specifications for plugins. See the [OpenCode plugin documentation](https://opencode.ai/v2/docs/plugins).

## Connect ChatGPT

In OpenCode, run `/connect`, select OpenAI, and sign in using a compatible Codex OAuth method (legacy browser/device-code login). The `chatgpt-token-sharing` login is not accepted by ChatGPT's usage endpoint.

If you have multiple OpenAI credentials, ensure the compatible one is active:

```sh
opencode auth list
opencode auth switch openai
```

Then open the right-hand sidebar in the TUI. If the panel does not appear after installation or an update, restart OpenCode.

## How it works and privacy

- The plugin requests `https://chatgpt.com/backend-api/wham/usage`, the endpoint used by ChatGPT's usage page for account quotas.
- It reuses the OpenAI OAuth credential already stored by OpenCode. It does not request or store an API key.
- The OAuth token is sent only to `chatgpt.com` for the usage request; this plugin does not write it to logs.
- The latest snapshot (percentages and reset times) is kept in OpenCode's local plugin storage to synchronize the TUI. No token is stored there.
- This endpoint is internal and is not documented by OpenAI as a public API. Its format or access rules may change; if that happens, the panel reports that usage is unavailable rather than making up values.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `Connect OpenAI with /connect` | Connect OpenAI in OpenCode. |
| Login rejected / `needs-codex-login` | Use the legacy Codex browser/device-code OAuth method, not `chatgpt-token-sharing`. |
| No usage windows returned | Check that the [ChatGPT Usage page](https://chatgpt.com/settings/usage?tab=overview) shows quota windows, then wait for the next refresh (up to 60 seconds). |
| Sidebar panel is missing | Check `opencode plugin list`, reload or restart OpenCode, and open the right-hand sidebar. |
| Plugin cannot be downloaded | Check the repository URL, Git installation, and network access. |

## Development

Entry points are `index.ts` (server), `tui.tsx` (interface), and `rpc.ts` (shared RPC contract). The plugin has no bundled npm dependencies: OpenCode resolves its plugin API at runtime.

For local testing, add the plugin directory to the `plugins` list in the OpenCode configuration, reload OpenCode, and check both usage windows in the sidebar. Never copy credentials into this repository.
