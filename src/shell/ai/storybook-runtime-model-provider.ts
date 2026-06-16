import {
  createRuntimeRouteModelPickerProviderCache,
  type RouteModelPickerDataProvider,
} from '@nimiplatform/kit/features/model-picker/runtime';
import {
  createNimiRuntimeRouteOptionsHostDeps,
  listNimiRuntimeRouteOptionsWithHost,
} from '@nimiplatform/sdk/runtime';
import { getStorybookNimiClient } from '../infra/storybook-nimi-client.ts';

export function createStorybookRuntimeModelPickerProviderCache(): (
  capability: string,
) => RouteModelPickerDataProvider | null {
  return createRuntimeRouteModelPickerProviderCache({
    loadOptions: async (input) => {
      const client = getStorybookNimiClient();
      return listNimiRuntimeRouteOptionsWithHost(
        input,
        createNimiRuntimeRouteOptionsHostDeps(client.runtime),
      );
    },
    unavailableMessage: 'Storybook Runtime route catalog is unavailable.',
  });
}
