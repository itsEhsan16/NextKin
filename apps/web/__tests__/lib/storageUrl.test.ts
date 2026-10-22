import { browserStorageUrl } from '@/lib/storageUrl';

const signed = 'http://127.0.0.1:8333/nextkin-uploads/u/1/resume.pdf?X-Amz-Signature=abc';
const TUNNEL = 'worcester-racks-reduction-clarke.trycloudflare.com';

describe('browserStorageUrl (toreview §131.7)', () => {
  it('leaves local storage alone on a page opened at localhost', () => {
    expect(browserStorageUrl(signed, 'localhost')).toBe(signed);
    expect(browserStorageUrl(signed, '127.0.0.1')).toBe(signed);
  });

  it('sends local storage through the page’s own origin from anywhere else, path and signature kept', () => {
    expect(browserStorageUrl(signed, TUNNEL)).toBe(
      '/storage/nextkin-uploads/u/1/resume.pdf?X-Amz-Signature=abc',
    );
  });

  it('leaves the cloud’s storage, and anything that is no URL, alone', () => {
    const cloud =
      'https://nextkin-uploads.s3.ap-south-1.amazonaws.com/u/1/resume.pdf?X-Amz-Signature=abc';
    expect(browserStorageUrl(cloud, TUNNEL)).toBe(cloud);
    expect(browserStorageUrl('not a url', TUNNEL)).toBe('not a url');
  });
});
