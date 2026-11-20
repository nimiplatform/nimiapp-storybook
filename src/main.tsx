import { createDesktopNimiAppSession } from '@nimiplatform/kit/auth/app/desktop';
import { mountStorybook } from './shell/mount-storybook.js';
import { downloadStorybookFile } from './shell/infra/storybook-file-delivery.js';
const dispose = mountStorybook(createDesktopNimiAppSession(), downloadStorybookFile);
if (import.meta.hot) import.meta.hot.dispose(dispose);
