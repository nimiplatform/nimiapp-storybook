/** Creator interchange. Unknown JSON is retained; only registered modules execute. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Extra = { [key: string]: unknown };

export type LoreEntry = Extra & {
  keys: string[]; content: string; extensions: Extra; enabled: boolean; insertion_order: number;
  name?: string; id?: number; comment?: string; case_sensitive?: boolean; priority?: number;
  selective?: boolean; secondary_keys?: string[]; constant?: boolean;
  position?: string;
};
export type Lorebook = Extra & {
  name?: string; description?: string; scan_depth?: number; token_budget?: number;
  recursive_scanning?: boolean; extensions: Extra; entries: LoreEntry[];
};
export type CharacterCardV2 = Extra & {
  spec: 'chara_card_v2'; spec_version: '2.0';
  data: Extra & {
    name: string; description: string; personality: string; scenario: string;
    first_mes: string; mes_example: string; creator_notes: string; system_prompt: string;
    post_history_instructions: string; alternate_greetings: string[]; tags: string[];
    creator: string; character_version: string; extensions: Extra; character_book?: Lorebook;
  };
};

export type MediaContent = { type: 'media'; uri: string; mimeType: string; purpose?: string; alt?: string };
export type Resource =
  | { type: 'character'; card: CharacterCardV2; portrait?: string }
  | { type: 'lorebook'; book: Lorebook }
  | MediaContent
  | { type: 'text'; text: string }
  | { type: `x-${string}`; [key: string]: unknown };
export type ContentPart =
  | { type: 'text'; text: string }
  | MediaContent
  | { type: 'resource'; ref: string; alt?: string }
  | { type: 'output'; task: string; output: string; alt?: string };
export type ModuleDeclaration = { version: string; required?: boolean; config: unknown };
export type RoleSlot = { label: string; card?: string; required?: boolean };

// @nimi-authority: rule.storybook.protocol.r001
export type StorybookWork = Extra & {
  format: 'nimi.storybook'; version: '0.1.0'; title: string; summary?: string;
  cover?: string; resources?: Record<string, Resource>; roles?: Record<string, RoleSlot>;
  modules?: Record<string, ModuleDeclaration>; extensions?: Extra;
};
export const CONVERSATION = 'nimi.storybook.conversation';
export const FLOW = 'nimi.storybook.flow';
export const GENERATION = 'nimi.storybook.generation';
export type ConversationConfig = {
  role?: string; context?: string; worlds?: string[]; opening?: ContentPart[];
};
export type StateValue = string | number | boolean;
export type StoryChoice = {
  id: string; label: string; target: string; when?: Record<string, StateValue>;
  set?: Record<string, StateValue>; feedback?: ContentPart[];
};
export type FlowNode = {
  id: string; title?: string; content?: ContentPart[]; context?: string;
  role?: string; dialogue?: boolean; choices?: StoryChoice[]; end?: boolean;
};
export type FlowConfig = {
  entry: string; state?: Record<string, StateValue>; nodes: FlowNode[];
};
export type OutputKind = 'text' | 'image' | 'music' | 'speech' | 'sound' | 'video' | `x-${string}`;
export type GenerationTask = {
  id: string; label: string; capability: string; inputs: ContentPart[];
  outputs: { id: string; kind: OutputKind }[];
  trigger: { event: 'manual' | 'enter'; node?: string };
  dependsOn?: string[]; required?: boolean;
  reuse: 'run' | 'visit' | 'never'; fallback?: ContentPart[];
};
export type GenerationConfig = { tasks: GenerationTask[] };

export type ProtocolDocument =
  | { kind: 'card'; data: CharacterCardV2 }
  | { kind: 'work'; data: StorybookWork }
  | { kind: 'lorebook'; data: Lorebook };
export type ImportedDocument = ProtocolDocument & {
  id: string; importedAt: string; sourceName: string; artwork?: string;
};
export type ProtocolIssue = { path: string; message: string; level: 'error' | 'warning' };
export type SupportIssue = { id: string; message: string; blocking: boolean };

export function moduleConfig<T>(work: StorybookWork, name: string): T | undefined {
  const module = work.modules?.[name];
  return module?.version === '1' ? module.config as T : undefined;
}
export function conversationOf(work: StorybookWork): ConversationConfig {
  return moduleConfig<ConversationConfig>(work, CONVERSATION) ?? {};
}
export function flowOf(work: StorybookWork): FlowConfig | undefined {
  return moduleConfig<FlowConfig>(work, FLOW);
}
export function tasksOf(work: StorybookWork): GenerationTask[] {
  return moduleConfig<GenerationConfig>(work, GENERATION)?.tasks ?? [];
}
