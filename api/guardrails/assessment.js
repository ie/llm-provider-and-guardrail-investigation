// Compacts a Bedrock GuardrailAssessment down to the signal you tune on.
//
// Deliberately drops:
// - appliedGuardrailDetails (guardrailArn embeds the AWS account id, plus guardrailId)
// - modelOutput (the blocked reply verbatim)
// - every `match` field (the matched word / PII value, i.e. the guarded text itself)
//
// Used by both mechanisms so their verdicts are diffable: the ApplyGuardrail response
// in guardrails/bedrock.js and the in-Converse trace in providers/bedrock.js.

// Only contextual grounding is reported unconditionally — its score is meaningful on a
// pass. The rest are listed only when they acted, or the line is mostly action=NONE.
const acted = (entry) => entry.action && entry.action !== 'NONE'

export function summariseAssessment(assessment = {}) {
  const summary = {}

  for (const filter of assessment.contextualGroundingPolicy?.filters ?? []) {
    summary[filter.type === 'RELEVANCE' ? 'relevance' : 'grounding'] = {
      score: filter.score,
      threshold: filter.threshold,
      action: filter.action,
    }
  }

  const topics = (assessment.topicPolicy?.topics ?? []).filter(acted).map((topic) => topic.name)
  if (topics.length) summary.topics = topics

  const filters = (assessment.contentPolicy?.filters ?? [])
    .filter(acted)
    .map((filter) => ({ type: filter.type, confidence: filter.confidence, action: filter.action }))
  if (filters.length) summary.filters = filters

  const words = [
    ...(assessment.wordPolicy?.customWords ?? []),
    ...(assessment.wordPolicy?.managedWordLists ?? []),
  ].filter(acted)
  if (words.length) summary.words = words.length

  const pii = [
    ...(assessment.sensitiveInformationPolicy?.piiEntities ?? []).filter(acted).map((entity) => ({
      type: entity.type,
      action: entity.action,
    })),
    ...(assessment.sensitiveInformationPolicy?.regexes ?? []).filter(acted).map((regex) => ({
      type: regex.name,
      action: regex.action,
    })),
  ]
  if (pii.length) summary.pii = pii

  return summary
}

// Converse returns assessments keyed by guardrail id — take the values only, so the id
// never reaches the log.
export function summariseTrace(trace = {}) {
  const summarise = (assessments) => assessments.map(summariseAssessment).filter((s) => Object.keys(s).length)

  return {
    reason: trace.actionReason,
    input: summarise(Object.values(trace.inputAssessment ?? {})),
    output: summarise(Object.values(trace.outputAssessments ?? {}).flat()),
  }
}
