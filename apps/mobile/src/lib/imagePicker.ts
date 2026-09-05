/** Avatar / photo picking from the device library (plan §Phase 9A). */

export type PickedImage = { uri: string; width: number; height: number };

/** The slice of expo-image-picker's SDK 57 surface this wrapper uses. */
type ImageAsset = { uri: string; width: number; height: number };
type ImageResult = { canceled: true; assets: null } | { canceled: false; assets: ImageAsset[] };
type ImagePickerModule = {
  requestMediaLibraryPermissionsAsync(): Promise<{ granted: boolean }>;
  launchImageLibraryAsync(options: {
    mediaTypes: string[];
    allowsEditing: boolean;
    aspect: [number, number];
    quality: number;
  }): Promise<ImageResult>;
};

let cached: ImagePickerModule | null | undefined;

/**
 * expo-image-picker is required lazily, never imported statically: this file is re-exported from
 * the @/lib barrel that every screen imports, so a static import of a native module would take
 * down every route (and every Jest suite) the moment that module is unavailable. The shape above
 * is declared structurally for the same reason — the barrel keeps zero import-time coupling to
 * the expo package.
 */
function imagePickerModule(): ImagePickerModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy by necessity, see above.
    cached = require('expo-image-picker') as ImagePickerModule;
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * Asks for library access first and returns null without opening the picker when it is refused —
 * launching after a denial shows the user an empty sheet with no explanation. Everything else —
 * cancel, an empty result, a missing module, a throw — degrades to null too, so a caller only
 * branches on "did the user give me an image".
 */
export async function pickImage(): Promise<PickedImage | null> {
  const module = imagePickerModule();
  if (!module) return null;
  try {
    const permission = await module.requestMediaLibraryPermissionsAsync();
    if (!permission?.granted) return null;
    const result = await module.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) return null;
    return { uri: asset.uri, width: asset.width, height: asset.height };
  } catch {
    return null;
  }
}
