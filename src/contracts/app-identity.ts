// Canonical Storybook app identity. Keep this single-sourced across manifest,
// Runtime/SDK, storage, AIConfig, and Tauri bundle identity.

export const STORYBOOK_APP_ID = 'nimi.storybook';
export const STORYBOOK_PRODUCT_SLUG = 'storybook';
export const STORYBOOK_TAURI_IDENTIFIER = STORYBOOK_APP_ID;
export const STORYBOOK_RUNTIME_APP_ID = STORYBOOK_APP_ID;
export const STORYBOOK_RUNTIME_APP_INSTANCE_ID = `${STORYBOOK_RUNTIME_APP_ID}.local-developer`;
export const STORYBOOK_RUNTIME_DEVICE_ID = 'storybook-local-developer-device';
