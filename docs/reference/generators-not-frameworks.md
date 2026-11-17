# Generators, not frameworks: the case for a plain-code Stellar starter

Nov 12, 2026 · @Wlademyr Mendes

The recommended way to start building on Stellar should be a generator that writes a plain Next.js app and then steps aside, not a framework that stays in the project. This article makes the case for that choice.

The argument has three parts. Stellar's current starting point asks newcomers to accept a lot before they write a line of code. Other ecosystems have already moved toward thin generators and code the developer owns. And most developers now build with AI agents, which work best on ordinary, visible code and documented commands.

The proposal, described in the v0 documentation under the working name `create-stellar-next`, is one `npx` command that produces a standard Next.js app, a Rust contracts workspace, and typed contract clients. Wallets, a local network, the contract registry and declarative environments are each one flag away, and none is on by default.

## Where Stellar is today

Stellar's recommended starting point, [Scaffold Stellar](https://developers.stellar.org/docs/tools/scaffold-stellar), is a capable toolkit that bundles four things: CLI plugins, contract templates, an on-chain contract registry, and a frontend. It deserves credit for giving the ecosystem a single front door.

The bundle is also the problem. To begin, a developer installs two Rust CLIs with cargo, adopts a Vite and React frontend, and learns an `environments.toml` file that controls networks, accounts and contracts. In the [documented example configuration](https://docs.rs/crate/stellar-scaffold-cli/0.0.3/source/README.md), the development environment runs a network locally. Each of these is a reasonable choice. Together they are a framework a newcomer has to accept whole.

The alternatives in the official docs do not fill the gap. The dapp guides use an [Astro template](https://developers.stellar.org/docs/build/guides/dapps/soroban-contract-init-template) and a SvelteKit passkeys template. There is no official Next.js starting point, although Next.js is the frontend in the recommended starters on Ethereum and Solana.

Meanwhile the pieces under these tools have changed, and the changes favour a thinner layer:

- **Client generation moved into the JavaScript SDK.** The docs now recommend `npx @stellar/stellar-sdk generate` and mark [`stellar contract bindings typescript` as deprecated](https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world-frontend#generate-an-npm-package-for-the-hello-world-contract).
- **The Stellar CLI covers the whole contract loop.** Init, build, deploy with aliases, identities with testnet funding, and a local network container are all stock commands.
- **The CLI already speaks to agents.** It has an [agent guide](https://developers.stellar.org/docs/tools/cli/agent-cli), a `stellar skill` command, and `stellar contract init` writes an `AGENTS.md`.

When the base tools do this much, a starter no longer needs its own build system. It needs to arrange the stock tools well.

## What other ecosystems learned

The starters that other ecosystems recommend have converged on the same shape: one Node command, Next.js, a generated contract client, and files the developer owns.

| Ecosystem | Starter | How it starts | What it generates | Agent support |
| --- | --- | --- | --- | --- |
| Ethereum | [Scaffold-ETH 2](https://docs.scaffoldeth.io/) | `npx create-eth@latest` | Next.js app plus Hardhat or Foundry, the developer's choice | Ships `AGENTS.md` and skills, publishes `llms.txt` |
| Solana | [create-solana-dapp](https://solana.com/developers/templates/nextjs-anchor) | `npx create-solana-dapp@latest -t <template>` | Next.js app, Anchor program, Codama-generated client | `llms.txt` and skills on solana.com |
| Web | [create-next-app](https://nextjs.org/docs/app/guides/ai-agents) | `npx create-next-app` | Plain Next.js app | Writes `AGENTS.md` and `CLAUDE.md` by default, docs bundled in the package |
| Web | [shadcn/ui](https://ui.shadcn.com/docs) | `npx shadcn@latest add <item>` | Component source copied into the project | Open code, described by its authors as AI-ready |

Four lessons carry over.

**Start with one command that needs only Node.** None of these asks the developer to compile a CLI before seeing a running app.

**Let the developer choose the tools.** Scaffold-ETH 2 describes itself as a combination of other tools, not a product, and asks whether you want Hardhat or Foundry. Solana offers a gallery of templates behind a single command.

**Work against a public test network first.** Solana's Next.js and Anchor template ships with its example program already deployed to devnet. A local validator is a documented option, not a prerequisite.

**Hand over code, not a dependency.** The Solana template puts its wallet layer in ordinary files under `app/lib/wallet/`. shadcn/ui built its whole model on copying source into your project so you can edit it directly.

None of these ecosystems is a perfect model. Scaffold-ETH 2 still ships its own hooks and components layer and its quickstart begins with a local chain. The proposal takes its modularity and leaves that runtime layer behind.

## How AI-assisted development changes the job of a dev tool

A starter is now often read and operated by an AI agent, not only by a person, and that changes what a good one looks like.

The [2026 Stack Overflow Developer Survey](https://stackoverflow.blog/2026/10/06/the-results-of-the-2026-developer-survey-are-here/), with more than 30,000 respondents, puts numbers on it:

- 66% of AI users work in coding agents, and 73% of those who use coding assistants or agents use them daily.
- 70% ask an AI agent when they need an answer, second only to web search at 83%.
- 93% say trusting AI output requires source attribution. The most trusted context is project goals and requirements (85%), then code and docs (73%).

The tooling world has reorganised around this. OpenAI [donated `AGENTS.md`](https://openai.com/index/agentic-ai-foundation/) to the Linux Foundation's Agentic AI Foundation in December 2025, making a plain Markdown file at the repository root the shared way to brief an agent. Next.js then made it a default. Its team noted that agents [rely on outdated training data](https://app.semanticdiff.com/gh/vercel/next.js/commit/b9ec2e4f8d6e87ab28b5a7ec9d1bb5cb87913d9c) and invent or misuse APIs, so `create-next-app` now writes `AGENTS.md` and the `next` package carries docs that match the installed version. Vercel reported a [100% pass rate](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals) on its Next.js agent evals with that setup.

Four consequences follow for anyone designing a starter.

**Agents reason from files.** Behaviour hidden inside a framework's runtime, a plugin or a config interpreter is behaviour the agent has to guess. Ordinary source code and stock commands are things it can read and run.

**Training data goes stale.** Stellar is a live example: an agent working from older training data is likely to reach for `stellar contract bindings typescript`, which the docs now mark as deprecated. A starter has to state the current way in the project itself.

**Trust comes from verification.** Developers trust what they can check. One command that typechecks, lints, tests the contracts and builds the app gives both the person and the agent a clear definition of done.

**Agents cannot answer a prompt they cannot see.** Every choice needs a flag, output needs a machine-readable form, and repeating a command must be safe.

## Why this approach

The proposal rests on five design choices. Each one answers a specific problem described above.

| Choice | What it means | Problem it answers |
| --- | --- | --- |
| Generator, not framework | The output is a normal Next.js app with no runtime dependency on the tool | Lock-in, and behaviour that agents and newcomers cannot see |
| Stock tools | Scripts wrap the Stellar CLI and the SDK generator, and print what they run | A second build system to learn, maintain and keep in sync with upstream |
| Testnet first | No Docker and no local node until the developer asks for one | A heavy first hour before any code is written |
| Everything optional | Wallet, local network, registry and declarative environments are each a flag | One bundle that fits some projects and burdens the rest |
| Agent first | `AGENTS.md`, flags for every prompt, JSON output, one check command, key and mainnet rules | Agents working from stale memory and guessing at hidden behaviour |

**The surface to maintain shrinks.** A framework has to track every change in the SDK, the CLI and the frontend stack, and ship a release before users can move. A generator that calls stock commands inherits upstream improvements the day they land.

**Nothing is taken away.** Teams that value Scaffold Stellar's registry or its declarative environments can turn both on with a flag. The difference is the default: a newcomer meets a small project and adds what they need, in place of a large one they must learn before they can remove anything.

**Fixed conventions, open stack.** Lightly opinionated does not mean shapeless. File locations and script names are the same in every project, because that is what lets documentation, examples and agents carry over from one project to the next. What goes inside those files is the developer's call.

**It meets developers where they are.** JavaScript remains the most used language in the 2026 survey at 62%, and Next.js is the frontend in the recommended starters on both Ethereum and Solana. A developer arriving from either finds a project they already know how to read.

## Objections and trade-offs

The approach has real costs, and the strongest objections deserve a direct answer.

**"Generated code drifts. A framework can ship fixes to everyone."** This is the main cost. Once code is copied into a project, the tool cannot patch it. The mitigations are a small generated surface, idempotent `add` commands that can reapply a module, and keeping the hard logic in upstream packages that update normally. Projects that want central upgrades are better served by a framework.

**"Opinionated tools are easier for beginners."** Often true. A beginner benefits from one obvious path. The proposal keeps one obvious path through fixed conventions and a default that works with `--yes`. It removes the bundled extras, not the guidance.

**"Testnet is slower and less reliable than a local network."** Also true. Testnet resets, rate limits and faucet outages are real, and a local network gives instant feedback. That is why the local network stays one flag away. The question is only which should be required on day one.

**"This fragments the ecosystem."** Two recommended starters are harder to explain than one. The answer is compatibility: the registry scripts call the same registry CLI, and whether to accept `environments.toml` unchanged is an open decision that could make migration in either direction a one-command step.

**"Agent-first is a bet on a moving target."** The specific tools will change. The practices chosen here are the durable ones: plain files, documented commands, machine-readable output and a single check. They also happen to be good practice for human developers.

**"Why Next.js only?"** Choosing one frontend is an opinion, and the Stellar docs already serve Astro and SvelteKit users. The contract workflow and scripts do not depend on Next.js, so other frontends could follow if v0 proves the model.

What is given up in v0: Scaffold Stellar's contract metadata injection at build time, its OpenZeppelin Wizard starting point, and the weight of an established project with documentation, videos and users.

## Conclusion

The best starting point for a modern ecosystem is the smallest one that works, written in code its users and their agents can read. Stellar's base tools are now strong enough to make that possible, other ecosystems have shown the shape, and the way developers work has made it necessary.

The proposal is to build that starting point, measure it with real agent tasks before each release, and recommend it as the default while keeping Scaffold Stellar's best ideas available as options. The test of success is simple: a developer, or their agent, goes from one command to a contract call on testnet in minutes, and can explain every file in the project.

## Sources

- [Scaffold Stellar, Stellar docs](https://developers.stellar.org/docs/tools/scaffold-stellar)
- [stellar-scaffold-cli README](https://docs.rs/crate/stellar-scaffold-cli/0.0.21/source/README.md)
- [Hello World frontend, Stellar docs](https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world-frontend#generate-an-npm-package-for-the-hello-world-contract)
- [Stellar CLI for Agents](https://developers.stellar.org/docs/tools/cli/agent-cli)
- [Scaffold-ETH 2 docs](https://docs.scaffoldeth.io/)
- [Solana nextjs-anchor template](https://solana.com/developers/templates/nextjs-anchor)
- [shadcn/ui introduction](https://ui.shadcn.com/docs)
- [Next.js guide for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents)
- [Next.js commit adding bundled docs and AGENTS.md](https://app.semanticdiff.com/gh/vercel/next.js/commit/b9ec2e4f8d6e87ab28b5a7ec9d1bb5cb87913d9c)
- [Vercel: AGENTS.md in agent evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)
- [OpenAI: Agentic AI Foundation and AGENTS.md](https://openai.com/index/agentic-ai-foundation/)
- [Stack Overflow: results of the 2026 Developer Survey](https://stackoverflow.blog/2026/10/06/the-results-of-the-2026-developer-survey-are-here/)
