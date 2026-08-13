# README.md

## Context

A proof of concept vite app that tests Azure/AWS Bedrock/Vercel APIs to implement a Lexus-help chat bot.

User will have 3 settings to choose from:

- Provider
  - vercel (ai-gateway)
  - Azure
  - bedrock
  - bedrock-inline
- Models (dependant on the selected provider)
- Safety
  - `none`
  - `prompt-shield` — Azure Content Safety
  - `bedrock-guardrail` — Bedrock Guardrail
  - `oss-safeguard` — gpt-oss-safeguard (hosted on vercel)

### Hard-coded configs

- Azure's models already has guardrails attached, and Bedrock-Inline uses inline Guardrails. You can still set a separate Guardrail on top, but this duplicates the usage. The benefit of the two providers is 1 less latency.
- All variations will do a knowledge retrieval if the applicable. However for ease of config, Azure/Vercel use Azure Search and Bedrock uses AWS Knowledge Base.
- All variations can request tools. Right now, only the location retrieval is available that returns 'Sydney 2000'

## Regarding Safety Options

### Azure's Content Safety API

Content filter on the major categories. This does not have guardrail features.
Cons: Useful for inputs only. Will need another setting for Grounding and outputs.

### Bedrock Guardrail

Content filter, retrieval, input/output guardrails (prompt injection, document injection). For Bedrock, this is possible to do within a single call.
Cons: 1-2 extra calls if we want to run this on user input and/or output.

### gpt-oss-safeguard

Technically a manual version of policy. Better fine-tuning opportunity from Azure/Bedrock's low->high sliders. Is still vulnerable to jailbreak/injections.
Cons: Fairly large judging model, therefore hight latency per call.

## Quickstart

```bash
yarn dev
```

## Setup

### AWS Bedrock

1. Create a guardrail, save the ID and version

Two mechanisms point at the same guardrail:

- `safety=bedrock-guardrail` — standalone `ApplyGuardrail` calls, one on input, one on output
- `provider=bedrock-inline` — `guardrailConfig` inside `Converse`

Both send the contextual grounding triplet (`grounding_source` + `query` + `guard_content`), so
their verdicts are comparable. Grounding sources are the retrieved chunks plus any tool output —
without the tool output a dealer-lookup answer scores 0.12 and blocks; with it, 0.90.

Contextual grounding threshold is 0.7 (console config, unchanged). Relevance is not configured.
Scores are logged per turn as `[safety] ... details=[{"grounding":{...}}]`.

Warning: scores swing run to run because the model rewords the answer each time. Two runs of the
same question have landed either side of the threshold. Do not rank the two mechanisms off a
single pass.

### Azure Foundry | Guardrail

1. Create a guardrail and the model to apply to. Make sure `jailbreak` detection checkbox is ticked.

### gpt-oss-safeguard (Vercel AI Gateway)

No portal setup. The policy is `lib/safety/policy.js` — a versioned text file the model
classifies against at inference time. Select `oss-safeguard` in the safety dropdown, or set
`SAFETY=oss-safeguard`. Override the model with `SAFEGUARD_MODEL` (default
`openai/gpt-oss-safeguard-20b`; only the 20b variant is on the gateway).

Measured 0.5-1.7s per check on default reasoning effort, so two checks add roughly 1-3.5s per
turn against a 30s `CHAT_TIMEOUT_MS`.

Warning: the gateway free tier rate-limits this model after a handful of calls. Paid credits are
required to run the prompt suite or a demo.

TODO:

- Decide production behaviour for an unparsable verdict. `ossSafeguard()` currently throws, which
  surfaces as a 500. Production must choose fail open or fail closed.
- Confirm whether the gateway forwards `reasoningEffort` to the upstream host. Rate limits blocked
  that check. Note `ossSafeguard()` does not send it at all yet.

## Selecting safety checks

`SAFETY` defaults to `none`, mirroring `scripts/safety.json`. Only direct API callers reach
that default — the UI always sends an explicit value.

gpt-oss-safeguard is a classifier only — no PII masking, no grounding score, no audit trail — so
it is usually layered with `bedrock-guardrail`. Pass a comma-separated list to layer them:

```bash
SAFETY=bedrock-guardrail,oss-safeguard
```

Checks run in the order given and stop at the first block, so put the cheapest check first.
The request body accepts the same as either a string or an array of strings.

The select is single-value, so `SAFETY` is also how you demo layering in the browser:

```bash
SAFETY=bedrock-guardrail,oss-safeguard yarn dev
```

Layering in the `bedrock-inline` provider is separate: its guardrail runs inside the Converse
call, and the `SAFETY` chain still applies on top.

## Testing

The first version of this repo uses the json files in scripts/ to automate feeding prompts to a list of model, and record if they fail the jailbreak prompts. It's a quick and dirty check for refusal words on the jailbreak prompts.
It is not guaranteed the test is working after numerous commits.

```bash
yarn test:prompts
```
