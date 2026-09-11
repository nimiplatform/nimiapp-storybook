import { CONVERSATION, FLOW, GENERATION, type ContentPart, type StorybookWork, type ConversationConfig, type FlowConfig, type GenerationConfig } from './types.js';

export type MediaTransform = (uri: string, mimeType: string) => Promise<string>;
export async function mapContentMedia(parts: ContentPart[], transform: MediaTransform): Promise<ContentPart[]> {
  return Promise.all(parts.map(async part => part.type === 'media' ? { ...part, uri: await transform(part.uri, part.mimeType) } : structuredClone(part)));
}

/** Change only declared media locations, leaving cards and opaque extensions intact. */
export async function mapWorkMedia(work: StorybookWork, transform: MediaTransform): Promise<StorybookWork> {
  const next = structuredClone(work);
  for (const resource of Object.values(next.resources ?? {})) if (resource.type === 'media') resource.uri = await transform(resource.uri, resource.mimeType);
  const modules = next.modules ?? {};
  const conversation = modules[CONVERSATION];
  if (conversation?.version === '1') {
    const config = conversation.config as ConversationConfig;
    if (config.opening) config.opening = await mapContentMedia(config.opening, transform);
  }
  const flow = modules[FLOW];
  if (flow?.version === '1') for (const node of (flow.config as FlowConfig).nodes) {
    if (node.content) node.content = await mapContentMedia(node.content, transform);
    for (const choice of node.choices ?? []) if (choice.feedback) choice.feedback = await mapContentMedia(choice.feedback, transform);
  }
  const generation = modules[GENERATION];
  if (generation?.version === '1') for (const task of (generation.config as GenerationConfig).tasks) {
    task.inputs = await mapContentMedia(task.inputs, transform);
    if (task.fallback) task.fallback = await mapContentMedia(task.fallback, transform);
  }
  return next;
}
