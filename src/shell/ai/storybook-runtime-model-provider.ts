import {
  type RouteModelPickerDataProvider,
} from '@nimiplatform/kit/features/model-picker/runtime';

export function createStorybookRuntimeModelPickerProviderCache(): (
  capability: string,
) => RouteModelPickerDataProvider | null {
  return () => null;
}
