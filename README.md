# Lexus chat

A Vite proof of concept that compares Azure, AWS Bedrock, and Vercel APIs for a Lexus help chat bot.

## Quickstart

```bash
yarn dev
```

## Settings

The UI exposes three dropdowns:

| Setting  | Values                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| Provider | `vercel` (AI Gateway), `Azure`, `Bedrock`, `Bedrock-inline`                                                  |
| Model    | Depends on the provider                                                                                      |
| Safety   | `none`, `prompt-shield` (Azure Content Safety), `bedrock-guardrail`, `oss-safeguard` (gpt-oss-safeguard on Vercel) |

Fixed across every combination:

- `azure` and `bedrock-inline` run guardrails inside the model call, saving a round trip. Picking a Safety option on top still works, but this duplicates the check.
- Retrieval runs where applicable. `azure` and `vercel` use Azure Search; `bedrock` and `bedrock-inline` use AWS Knowledge Base.
- Every provider can call tools. 
  - Only dealer lookup exists, and it always returns `Sydney 2000`.

## Safety trade-offs

| Option              | Covers                                                                                    | Cost                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `prompt-shield`     | Content filter on the major categories                                                      | Input only. Grounding and output need a second option.                                            |
| `bedrock-guardrail` | Content filter, retrieval, prompt and document injection, contextual grounding               | 1-2 extra calls per turn, unless the provider is `bedrock-inline`, which folds it into `Converse`. |
| `oss-safeguard`     | A hand-written policy, so it tunes finer than the Azure/Bedrock low→high sliders             | Large judging model, so high latency. Still open to jailbreaks.                                   |

## Additional Setup

If you'd like to create your personal safety layers.

### AWS Bedrock

1. Create a guardrail and save its ID and version.
1. Replace BEDROCK_GUARDRAIL_* with the ID and version

 Two settings point at the same guardrail:

- `safety=bedrock-guardrail` — standalone `ApplyGuardrail` calls, one on input, one on output
- `provider=bedrock-inline` — `guardrailConfig` inside `Converse`

Both send the same contextual grounding triplet, so their verdicts compare directly.

Warning: scores swing run to run because the model rewords each answer. Do not rank the two off a single pass.

### Azure Foundry Models with Attached Guardrails

1. Create a guardrail and attach it to a deployed model
1. Update the azure list in scripts/models.json

### gpt-oss-safeguard (Vercel AI Gateway)

No portal setup. The policy is [lib/safety/policy.js](lib/safety/policy.js), a versioned text file the model classifies against at inference time. Override the model with `SAFEGUARD_MODEL` (default `openai/gpt-oss-safeguard-20b`, the only variant on the gateway).

Warning: the free gateway tier rate-limits this model after a handful of calls. A demo or the prompt suite needs paid credits.

## Layering safety checks

The dropdown takes one value. To layer, pass a comma-separated `SAFETY`:

```bash
SAFETY=bedrock-guardrail,oss-safeguard yarn dev
```

Checks run in the order given and stop at the first block, so put the cheapest first. The request body accepts a string or an array of strings.

`oss-safeguard` is a classifier only — no PII masking, no grounding score, no audit trail — so pair it with `bedrock-guardrail`.

`SAFETY` defaults to `none`, mirroring `scripts/safety.json`. Only direct API callers hit that default; the UI always sends an explicit value.

`bedrock-inline` layers separately: its guardrail runs inside the Converse call, and the `SAFETY` chain applies on top.

## Prompt testing

```bash
yarn test:prompts
```

Feeds `scripts/prompts.*.json` to the models in `scripts/models.json` and flags refusal words on the jailbreak prompts. Quick and dirty, and unverified against recent commits.
