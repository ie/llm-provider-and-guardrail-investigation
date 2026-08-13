# README.md

## Context

A proof of concept vite app that tests Azure/AWS Bedrock/Vercel APIs to implement a Lexus-help chat bot

The current working prototype is the @api/providers/vercel.js file. The only vercel about it is the vercel ai gate way baseurl.

- User access the @App, which sends the user input to @api/chat.js
- Retrieval returns knowledge chunks — @api/retrieval/azureSearch.js for the Azure AI search index,
  @api/retrieval/bedrockKb.js for the Bedrock knowledge base
- Wraps the knowledge (if applicable) + user message history in a prompt shield (powered by Azure)
- Model may return an answer or request a tool
  - Tool handler @api/tools/index.js will call the appropriate tool until model stops

Bedrock is Amazon Bedrock version of this pattern.
The azure/bedrock-mantle files are agent "equivalent" version code. They require additional role permission on the portal and therefore not functioning.

## Quickstart

```bash
yarn dev
```

## Creating guardrails

### AWS Bedrock

1. Create a guardrail, save the ID and version

### Azure Foundry | Guardrail

1. Create a guardrail and the model to apply to. Make sure `jailbreak` detection checkbox is ticked.

### gpt-oss-safeguard (Vercel AI Gateway)

No portal setup. The policy is `api/guardrails/policy.js` — a versioned text file the model
classifies against at inference time. Select `safeguard` in the guardrail dropdown, or set
`GUARDRAIL=safeguard`. Override the model with `SAFEGUARD_MODEL` (default
`openai/gpt-oss-safeguard-20b`; only the 20b variant is on the gateway).

Measured 0.5-1.7s per check on default reasoning effort, so two checks add roughly 1-3.5s per
turn against a 30s `CHAT_TIMEOUT_MS`.

Warning: the gateway free tier rate-limits this model after a handful of calls. Paid credits are
required to run the prompt suite or a demo.

TODO:

- Decide production behaviour for an unparseable verdict. `safeguard()` currently throws, which
  surfaces as a 500. Production must choose fail open or fail closed.
- Confirm whether the gateway forwards `reasoningEffort` to the upstream host. Rate limits blocked
  that check. Note `safeguard()` does not send it at all yet.

## Selecting guardrails

`GUARDRAIL` is required — there is no default, so a deploy that omits it fails with a 500 rather
than silently picking one. Set `GUARDRAIL=none` to run without a guardrail.

gpt-oss-safeguard is a classifier only — no PII masking, no grounding score, no audit trail — so
it is usually layered with `bedrock`. Pass a comma-separated list to layer them:

```bash
GUARDRAIL=bedrock,safeguard
```

Guardrails run in the order given and stop at the first block, so put the cheapest check first.
The request body accepts the same as either a string or an array of strings.

Layering in the `bedrock-inline` provider is separate: its guardrail runs inside the Converse
call, and the `GUARDRAIL` chain still applies on top.

## Testing

The first version of this repo uses the json files in scripts/ to automate feeding prompts to a list of model, and record if they fail the jailbreak prompts. It's a quick and dirty check for refusal words on the jailbreak prompts.
It is not guaranteed the test is working after numerous commits.

```bash
yarn test:prompts
```
