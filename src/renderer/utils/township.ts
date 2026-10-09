export type ChinaAddressNode = {
  value: string
  label: string
  adcode: string
  level: number
  children?: ChinaAddressNode[]
}

let chinaAddressDataPromise: Promise<ChinaAddressNode[]> | null = null;

export const getChinaAddressData = async (): Promise<ChinaAddressNode[]> => {
  if (!chinaAddressDataPromise) {
    // Keep the large address dataset out of the main Rollup module graph.
    // @ts-ignore
    chinaAddressDataPromise = import("@renderer/assets/data/china-address-data.json?raw").then(({ default: raw }) => {
      return JSON.parse(raw) as ChinaAddressNode[];
    }).catch((error) => {
      chinaAddressDataPromise = null;
      console.error("Failed to load china address data", error);
      throw error;
    });
  }
  return chinaAddressDataPromise;
};
