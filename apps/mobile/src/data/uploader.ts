import { ApiError, type FileUploader } from '@nextkin/shared/repos';

/**
 * The phone's uploader (ImBackendImplementationPlan P7-02): POSTs a picked file from its `file://`
 * URI straight to a presigned storage target, as multipart form data with every policy field first
 * and the file last as `file` — expo-file-system's `File.upload` with `UploadType.MULTIPART`
 * (SDK 57, included in Expo Go).
 *
 * expo-file-system is required lazily, as `@/lib/documentPicker` requires its module: the data layer
 * loads at startup and in every Jest suite, and must not take a native module down with it.
 */

type FileSystemModule = {
  File: new (uri: string) => {
    upload(
      url: string,
      options: {
        uploadType: number;
        fieldName: string;
        parameters: Record<string, string>;
        mimeType?: string;
      },
    ): Promise<{ status: number; body: string }>;
  };
  UploadType: { MULTIPART: number };
};

function fileSystem(): FileSystemModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy by necessity, see above.
  return require('expo-file-system') as FileSystemModule;
}

export const expoUploader: FileUploader = async (target, file) => {
  const { File, UploadType } = fileSystem();
  const result = await new File(file.uri).upload(target.url, {
    uploadType: UploadType.MULTIPART,
    fieldName: 'file',
    parameters: target.fields,
    mimeType: file.mimeType,
  });
  // upload() resolves for any completed response; storage answers 204 (or 201) on success.
  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(
      'VALIDATION_FAILED',
      'The upload was refused. Check the file’s size and type.',
      result.status,
    );
  }
};
