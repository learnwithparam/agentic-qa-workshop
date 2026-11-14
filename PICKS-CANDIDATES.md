# Watch and read candidates

For the page pass. Cut each part to 4 to 6 picks (at least 2 videos), then delete this file.

I wrote this offline, from what I know, with no live link check. The page pass must confirm every URL,
the year and the talk length before keeping a pick. Each line says who made it and why it passes the bar in
STANDARD-v2 section 5: made by the person or team that runs the method, about the idea not a launch, no
listicle or paywall.

## Part 1: Write tests with agents

| Pick | Type | Author, year | Why it passes |
| --- | --- | --- | --- |
| Playwright docs, "Test agents" (planner, generator, healer) | read | Playwright team at Microsoft, 2025 | The tool's own docs for the three agents the step uses. |
| Playwright docs, "Authentication" (`storageState`) | read | Playwright team, kept current | The official way to save a sign-in once. It backs the saved sign-in step. |
| Anthropic, "Best practices for Claude Code" | read | Anthropic, 2025 | The makers say how to ask for a plan first and give the agent a way to check itself. |
| Anthropic, "Building effective agents" | read | Anthropic, 2024 | The idea behind agent loops with a check at the end. Evergreen. |
| Mike Wacker, "Just Say No to More End-to-End Tests" | read | Google Testing Blog, 2015 | A Google engineer on how many UI tests a suite should hold. |
| Ham Vocke, "The Practical Test Pyramid" | read | martinfowler.com, 2018 | On the site of a long-trusted engineering author. Explains where a UI seed test sits. |
| Elisabeth Hendrickson, "Test Heuristics Cheat Sheet" | read | Hendrickson, 2008 | By the author of "Explore It!". Free. Gives prompts for good scenarios. |
| Playwright YouTube channel, a demo of the test agents | video | Playwright team, 2025 | Made by the team. Confirm the exact video and that it shows the agents running. |
| John Hughes, "Don't Write Tests" | video | GOTO Conference, 2016 | The creator of QuickCheck on letting a tool generate cases, then reading them with care. |
| Kent C. Dodds, "Write tests. Not too many. Mostly integration." | read | Dodds, 2019 | Made by the author of Testing Library. Short. Good for "what to ask the agent to write". |

## Part 2: Prove the tests catch bugs

| Pick | Type | Author, year | Why it passes |
| --- | --- | --- | --- |
| Stryker docs, "Mutation testing" | read | Stryker Mutator team, kept current | The team that makes the tool used in the step. |
| Petrovic, Ivankovic, Fraser, Just, "Practical Mutation Testing at Scale" | read | Google, 2021 | A paper by the people who run mutation testing at Google. |
| Foster et al., "Mutation-Guided LLM-based Test Generation at Meta" | read | Meta, 2025 | A paper by the team that runs it in production, on agents plus mutants. |
| Google Testing Blog, "Code Coverage Best Practices" | read | Marko Ivankovic, 2020 | Why a covered line is not a checked line. |
| Playwright docs, "Assertions" | read | Playwright team, kept current | The expect rules the guard step enforces. |
| Anthropic, "Claude Code hooks guide" | read | Anthropic, kept current | The makers show how to block an edit by rule. Backs the guard step. |
| Hamel Husain, "Your AI product needs evals" | read | Husain, 2024 | A practitioner who ran many evals. Explains why you test the checker. |
| Martin Fowler, "Test Coverage" | read | martinfowler.com, 2012 | Short and old, and still right. |
| Google Testing Blog, "Test Certified" or a GTAC talk on test quality | video | Google, various | Confirm a specific talk exists before using. |
| Stryker Mutator talk at a major conference | video | Stryker maintainers, various | Confirm the exact talk. Keep only if made by a maintainer. |

## Part 3: Keep the suite healthy

| Pick | Type | Author, year | Why it passes |
| --- | --- | --- | --- |
| Playwright docs, "Trace viewer" | read | Playwright team, kept current | The tool's own guide to the trace step. |
| Playwright docs, "Retries" and "Flaky tests" | read | Playwright team, kept current | Says what a retry hides and how to find the cause. |
| John Micco, "Flaky Tests at Google and How We Mitigate Them" | read | Google Testing Blog, 2016 | The team that ran the biggest suite, with real flake rates. |
| Martin Fowler, "Eradicating Non-Determinism in Tests" | read | martinfowler.com, 2011 | Names the causes the step teaches: shared data, time, races. |
| Spotify Engineering, "Test Flakiness: Methods for identifying and dealing with flaky tests" | read | Spotify, 2019 | A company that runs the method in production. |
| Atlassian Engineering, a post on flaky test detection | read | Atlassian, 2025 | Confirm the title. Runs the method in production at scale. |
| Playwright docs, "Visual comparisons" | read | Playwright team, kept current | The official page for screenshot tests. |
| Playwright docs, "Accessibility testing" | read | Playwright team, kept current | Official guide, uses axe-core. |
| Deque, axe-core docs | read | Deque, kept current | The makers of the rules engine the step runs. |
| Playwright YouTube channel, a trace viewer or debugging demo | video | Playwright team | Confirm the exact video. |

## Part 4: Test beyond the UI

| Pick | Type | Author, year | Why it passes |
| --- | --- | --- | --- |
| Playwright docs, "API testing" | read | Playwright team, kept current | The `request` fixture the step uses. |
| Playwright docs, "Mock APIs" | read | Playwright team, kept current | The `page.route` guide behind the mocked test. |
| OpenAPI Initiative, "What is OpenAPI?" | read | OpenAPI Initiative, kept current | The group that owns the contract format. |
| Schemathesis docs | read | Dmitry Dygalo, kept current | The maker of the tool, on testing from a schema. |
| Model Context Protocol docs, "Introduction" | read | Anthropic, kept current | The makers of the protocol. Backs the explore step. |
| Elisabeth Hendrickson, "Explore It!" ideas, or her "Test Heuristics Cheat Sheet" | read | Hendrickson | Free tool for exploratory sessions. |
| James Bach, "Exploratory Testing Explained" | read | Bach, 2003 | By the person who named the practice. Free. |
| Anthropic, "Writing effective tools for agents" | read | Anthropic, 2025 | Why a tool's shape decides what an agent finds. |
| John Hughes, "Testing the hard stuff and staying sane" | video | Hughes, 2014 | By the QuickCheck author on testing APIs with generated input. |
| Playwright YouTube channel, a Playwright MCP demo | video | Playwright team | Confirm the exact video. |

## Part 5: Run it as a team

| Pick | Type | Author, year | Why it passes |
| --- | --- | --- | --- |
| Playwright docs, "Sharding" and "Continuous integration" | read | Playwright team, kept current | The official way to split a suite across machines. |
| GitHub Docs, "Using a matrix for your jobs" | read | GitHub, kept current | The platform's own docs for the shard job. |
| GitHub Docs, "Store and share data with workflow artifacts" | read | GitHub, kept current | The way CI keeps a trace of a red run. |
| Anthropic, "Claude Code GitHub Actions" | read | Anthropic, kept current | The makers show how to run an agent in CI. |
| Anthropic, "Manage costs effectively" (Claude Code docs) | read | Anthropic, kept current | The source for what an agent run costs and how to cap it. |
| Anthropic, "How we built our multi-agent research system" | read | Anthropic, 2025 | A team that runs agents in production, with honest numbers on cost. |
| Winters, Manshreck, Wright, "Software Engineering at Google", chapters on testing and CI | read | Google, 2020 | Free online. The team that runs the practice. |
| Model Context Protocol docs, "Code execution with MCP" | read | Anthropic, 2025 | Compares MCP with plain command line tools. |
| Google Testing Blog, "Test flakiness: one of the main challenges of automated testing" | read | Google, 2020 | Backs the quarantine policy. Confirm the title. |
| A GitHub Universe or Google GTAC talk on flaky tests and merge gates | video | Confirm the exact talk | Keep only if the speaker runs the system. |

## Part 6: Redo a flow with Playwright Test Agents (and your own app)

| Pick | Type | Author, year | Why it passes |
| --- | --- | --- | --- |
| Playwright docs, "Test agents" | read | Playwright team, 2025 | The tool's own docs. |
| Playwright release notes that added the agents | read | Playwright team, 2025 | Primary source. Confirm the release. |
| Playwright docs, "Best practices" | read | Playwright team, kept current | Locators and web-first assertions the healer relies on. |
| Anthropic, "Best practices for Claude Code" | read | Anthropic, 2025 | Keep a person in the loop and give the agent a check. |
| Anthropic, "Building effective agents" | read | Anthropic, 2024 | When to use a loop, and when to keep it simple. |
| Anthropic docs, "Subagents" (Claude Code) | read | Anthropic, kept current | The agent files that `init-agents` writes are subagents. |
| Playwright YouTube channel, a Test Agents demo | video | Playwright team, 2025 | Confirm the exact video. |
| Hamel Husain, "A field guide to rapidly improving AI products" | read | Husain, 2025 | A practitioner on reading real outputs, which is the habit this step builds. |
| Martin Fowler, "Humans and Agents in Software Engineering Loops" | read | martinfowler.com, 2026 | Confirm that it exists. If so, it fits "a person stays in charge". |
| A conference talk from the Playwright team on AI and testing | video | Confirm the exact talk | Keep only if a maintainer gives it. |
