# README.md

## Context

A proof of concept vite app that tests Azure/AWS Bedrock/Vercel APIs to implement a Lexus-help chat bot

The current working prototype is the @api/providers/vercel.js file. The only vercel about it is the vercel ai gate way baseurl.

- User access the @App, which sends the user input to @api/chat.js
- Retrieval returns knowledge chunks — @api/retrieval/azureSearch.js for the Azure AI search index,
  @api/retrieval/bedrockKb.js for the Bedrock knowledge base
- Wraps the knowledge (if applicable) + user message history in a prompt shield (powered by Azure)
- Model may return an answer or request a tool
  - Tool handler @api/utils/tools.js will call the appropriate tool until model stops

Bedrock is Amazon Bedrock version of this pattern.
The bedrock-mantle file is the agent "equivalent" version code. It requires additional role permission on the portal and therefore not functioning.

@api/providers/azure.js runs end-to-end on `AZURE_OPENAI_API_KEY`. It falls back to
`DefaultAzureCredential`, which still needs the `Azure AI User` role at project scope.

## Quickstart

```bash
yarn dev
```

## Creating guardrails

### AWS Bedrock

1. Create a guardrail, save the ID and version

Two mechanisms point at the same guardrail:

- `guardrail=bedrock` — standalone `ApplyGuardrail` calls, one on input, one on output
- `provider=bedrock-inline` — `guardrailConfig` inside `Converse`

Both send the contextual grounding triplet (`grounding_source` + `query` + `guard_content`), so
their verdicts are comparable. Grounding sources are the retrieved chunks plus any tool output —
without the tool output a dealer-lookup answer scores 0.12 and blocks; with it, 0.90.

Contextual grounding threshold is 0.7 (console config, unchanged). Relevance is not configured.
Scores are logged per turn as `[guardrail] ... details=[{"grounding":{...}}]`.

Warning: scores swing run to run because the model rewords the answer each time. Two runs of the
same question have landed either side of the threshold. Do not rank the two mechanisms off a
single pass.

### Azure Foundry | Guardrail

1. Create a guardrail and the model to apply to. Make sure `jailbreak` detection checkbox is ticked.

### gpt-oss-safeguard (Vercel AI Gateway)

No portal setup. The policy is `api/utils/safeguardPolicy.js` — a versioned text file the model
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
  that check.
- Support layering guardrails. gpt-oss-safeguard is a classifier only — no PII masking, no
  grounding score, no audit trail. Running it alongside `bedrock` needs `guardrail` to accept a
  list in `api/chat.js`.
- Re-enable the `should-answer` suite in `scripts/testPrompts.ts` before trusting any catch rate.
  Without it the false-positive rate is unmeasured, and `off_scope` is the rule most likely to
  reject legitimate questions.

## Testing

The first version of this repo uses the json files in scripts/ to automate feeding prompts to a list of model, and record if they fail the jailbreak prompts. It's a quick and dirty check for refusal words on the jailbreak prompts.
It is not guaranteed the test is working after numerous commits.

```bash
yarn test:prompts
```
