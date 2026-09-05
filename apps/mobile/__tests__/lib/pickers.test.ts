// Both pickers cache their native module at module scope, so a test that wants a different
// mock has to load a fresh copy of the wrapper: reset the registry, doMock the expo package,
// then require. A shared import at the top of this file would pin the first mock for the run.

type DocumentPickerFactory = () => unknown;
type ImagePickerFactory = () => unknown;

function loadDocumentPicker(factory: DocumentPickerFactory) {
  jest.resetModules();
  jest.doMock('expo-document-picker', factory);
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- fresh copy per test, see above.
  return require('@/lib/documentPicker') as typeof import('@/lib/documentPicker');
}

function loadImagePicker(factory: ImagePickerFactory) {
  jest.resetModules();
  jest.doMock('expo-image-picker', factory);
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- fresh copy per test, see above.
  return require('@/lib/imagePicker') as typeof import('@/lib/imagePicker');
}

afterEach(() => {
  jest.resetModules();
  jest.restoreAllMocks();
});

describe('pickDocument', () => {
  it('maps a picked asset and asks for exactly the MIME types of the kinds passed', async () => {
    const getDocumentAsync = jest.fn(() =>
      Promise.resolve({
        canceled: false,
        assets: [
          {
            uri: 'file:///cache/resume.pdf',
            name: 'resume.pdf',
            size: 24_576,
            mimeType: 'application/pdf',
            lastModified: 0,
          },
        ],
      }),
    );
    const { pickDocument } = loadDocumentPicker(() => ({ getDocumentAsync }));

    await expect(pickDocument(['pdf', 'docx'])).resolves.toEqual({
      name: 'resume.pdf',
      uri: 'file:///cache/resume.pdf',
      mimeType: 'application/pdf',
      size: 24_576,
    });
    expect(getDocumentAsync).toHaveBeenCalledWith({
      type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });
  });

  it('returns null when the user cancels', async () => {
    const getDocumentAsync = jest.fn(() => Promise.resolve({ canceled: true, assets: null }));
    const { pickDocument } = loadDocumentPicker(() => ({ getDocumentAsync }));

    await expect(pickDocument(['txt'])).resolves.toBeNull();
  });

  it('returns null instead of throwing when the native module is unavailable', async () => {
    const { pickDocument } = loadDocumentPicker(() => {
      throw new Error('expo-document-picker is not available in this runtime');
    });

    await expect(pickDocument(['pdf'])).resolves.toBeNull();
  });
});

describe('pickImage', () => {
  it('never opens the library when media permission is denied', async () => {
    const launchImageLibraryAsync = jest.fn();
    const { pickImage } = loadImagePicker(() => ({
      requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
      launchImageLibraryAsync,
    }));

    await expect(pickImage()).resolves.toBeNull();
    expect(launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('maps a picked asset once permission is granted', async () => {
    const launchImageLibraryAsync = jest.fn(() =>
      Promise.resolve({
        canceled: false,
        assets: [{ uri: 'file:///cache/avatar.jpg', width: 512, height: 512 }],
      }),
    );
    const { pickImage } = loadImagePicker(() => ({
      requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
      launchImageLibraryAsync,
    }));

    await expect(pickImage()).resolves.toEqual({
      uri: 'file:///cache/avatar.jpg',
      width: 512,
      height: 512,
    });
    expect(launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
  });
});
