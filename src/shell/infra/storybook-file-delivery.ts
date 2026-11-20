export type StorybookFileDelivery = (json: string, filename: string, assertCurrent: () => void) => Promise<void>;

let deliver: StorybookFileDelivery | undefined;

export function bindStorybookFileDelivery(next: StorybookFileDelivery) {
  deliver = next;
  return () => { if (deliver === next) deliver = undefined; };
}

export async function deliverStorybookJson(value: unknown, filename: string, assertCurrent: () => void) {
  if (!deliver) throw new Error('Storybook file delivery is unavailable');
  assertCurrent();
  await deliver(JSON.stringify(value, null, 2), filename.replace(/[\\/:*?"<>|\0]/g, '-'), assertCurrent);
}

export const downloadStorybookFile: StorybookFileDelivery = async (json, filename, assertCurrent) => {
  assertCurrent();
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};
