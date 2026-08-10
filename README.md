# README.md

## Context

A proof of concept vite app that tests Azure/AWS Bedrock/Vercel APIs to implement a lexus-help chat bot

The current working prototype is the @api/providers/vercel.js file. The only vercel about it is the vercel ai gate way baseurl.

- User access the @App, which sends the user input to @api/chat.js
- Passes user message history to the Azure AI search index, and may return the knowledge chunk
- Wraps the knowledge (if applicable) + user message history in a prompt shield (powered by Azure)
- Model may return an answer or request a tool
  - Tool handler @api/tools.js will call the appropriate tool until model stops

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

## Testing

The first version of this repo uses the json files in scripts/ to automate feeding prompts to a list of model, and record if they fail the jailbreak prompts. It's a quick and dirty check for refusal words on the jailbreak prompts.
It is not guaranteed the test is working after numerous commits.

```bash
yarn test:prompts
```
