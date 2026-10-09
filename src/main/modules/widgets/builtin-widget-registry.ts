import manifestData from "@common/widgets/manifests.json";

export type BuiltinWidgetManifest = (typeof manifestData)[number] & {
  virtualPath: string;
  dir: string;
};

const manifests: BuiltinWidgetManifest[] = manifestData.map((manifest) => ({
  ...manifest,
  virtualPath: "assets/widgets",
  dir: manifest.path,
}));

export function getBuiltinWidgetManifests(): BuiltinWidgetManifest[] {
  return manifests;
}
