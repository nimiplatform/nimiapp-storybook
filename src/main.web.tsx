import { createWebNimiAppSession, type NimiRemoteAppConfig } from '@nimiplatform/kit/auth/app/web';
import { mountStorybook } from './shell/mount-storybook.js';
import { downloadStorybookFile } from './shell/infra/storybook-file-delivery.js';
declare const __NIMI_APP_WEB_CONFIG__: NimiRemoteAppConfig;
const dispose = mountStorybook(createWebNimiAppSession(__NIMI_APP_WEB_CONFIG__), downloadStorybookFile);
if (import.meta.hot) import.meta.hot.dispose(dispose);
