# openwork

[![npm][npm-badge]][npm-url] [![License: MIT][license-badge]][license-url]

[npm-badge]: https://img.shields.io/npm/v/openwork.svg
[npm-url]: https://www.npmjs.com/package/openwork
[license-badge]: https://img.shields.io/badge/License-MIT-yellow.svg
[license-url]: https://opensource.org/licenses/MIT

A desktop interface for [deepagentsjs](https://github.com/langchain-ai/deepagentsjs) — an opinionated harness for building deep agents with filesystem capabilities planning, and subagent delegation.

![openwork screenshot](docs/screenshot.png)

> [!NOTE]
> This is a customized version of Openwork with **Ollama Cloud** integration, enabling you to use Ollama's cloud-hosted models alongside local models.

> [!CAUTION]
> openwork gives AI agents direct access to your filesystem and the ability to execute shell commands. Always review tool calls before approving them, and only run in workspaces you trust.

## Get Started

```bash
# Run directly with npx
npx openwork

# Or install globally
npm install -g openwork
openwork
```

Requires Node.js 18+.

### From Source

```bash
git clone https://github.com/langchain-ai/openwork.git
cd openwork
npm install
npm run dev
```

## Configuration

### API Keys

Configure API keys for cloud providers in-app via the settings panel, or by setting environment variables:

```bash
# Ollama Cloud
OLLAMA_API_KEY=your-ollama-cloud-api-key

# Other providers (optional)
ANTHROPIC_API_KEY=your-anthropic-api-key
OPENAI_API_KEY=your-openai-api-key
GOOGLE_API_KEY=your-google-api-key
```

API keys are securely stored in a `.env` file in the application directory.

## Supported Models

| Provider  | Models                                                            |
| --------- | ----------------------------------------------------------------- |
| **Ollama Cloud** | All Ollama Cloud models (Llama 3.3, Qwen, Deepseek, etc.) |
| Anthropic | Claude Opus 4.5, Claude Sonnet 4.5, Claude Haiku 4.5, Claude Opus 4.1, Claude Sonnet 4 |
| OpenAI    | GPT-5.2, GPT-5.1, o3, o3 Mini, o4 Mini, o1, GPT-4.1, GPT-4o       |
| Google    | Gemini 3 Pro Preview, Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash Lite |

### Ollama Cloud Integration

This version includes native support for [Ollama Cloud](https://ollama.com/cloud), allowing you to:

- Use Ollama's cloud-hosted models without running a local Ollama instance
- Access models like Llama 3.3 70B, Qwen 2.5, Deepseek Coder, and more
- Seamlessly switch between local and cloud models
- Enjoy the same HITL (Human-in-the-Loop) approval workflow for all models

To use Ollama Cloud models:
1. Sign up for an [Ollama Cloud account](https://ollama.com/cloud)
2. Get your API key from the Ollama Cloud dashboard
3. Configure it in the settings panel or via the `OLLAMA_API_KEY` environment variable
4. Select any Ollama Cloud model from the model dropdown

## Testing

This project includes a comprehensive test suite covering all aspects of the Ollama Cloud integration. See the [Test Documentation](tests/README.md) for details on:

- Running tests (`pnpm test`)
- Test coverage and structure
- Writing new tests
- CI/CD integration

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Report bugs via [GitHub Issues](https://github.com/langchain-ai/openwork/issues).

## License

MIT — see [LICENSE](LICENSE) for details.
