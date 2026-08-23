import Storage from 'expo-sqlite/kv-store';

import { storage } from '@/lib';

// `expo-sqlite/kv-store` is replaced with an in-memory Map in jest.setup.ts,
// so these tests exercise the JSON wrapper, not SQLite itself.

const KEY = 'test.key';

afterEach(() => {
  storage.remove(KEY);
  jest.restoreAllMocks();
});

describe('storage', () => {
  it('returns null for a key that was never written', () => {
    expect(storage.get('test.missing')).toBeNull();
  });

  it('round-trips a plain object', () => {
    const value = { viewMode: 'grid', count: 3, nested: { enabled: true } };
    storage.set(KEY, value);
    expect(storage.get<typeof value>(KEY)).toEqual(value);
  });

  it('round-trips arrays and primitive values', () => {
    storage.set(KEY, ['a', 'b']);
    expect(storage.get<string[]>(KEY)).toEqual(['a', 'b']);

    storage.set(KEY, 'dark');
    expect(storage.get<string>(KEY)).toBe('dark');

    storage.set(KEY, 42);
    expect(storage.get<number>(KEY)).toBe(42);

    storage.set(KEY, false);
    expect(storage.get<boolean>(KEY)).toBe(false);
  });

  it('returns a fresh copy rather than the original reference', () => {
    const value = { items: [1, 2, 3] };
    storage.set(KEY, value);
    const read = storage.get<typeof value>(KEY);
    expect(read).toEqual(value);
    expect(read).not.toBe(value);
  });

  it('overwrites an existing value', () => {
    storage.set(KEY, { v: 1 });
    storage.set(KEY, { v: 2 });
    expect(storage.get<{ v: number }>(KEY)).toEqual({ v: 2 });
  });

  it('removes a value so subsequent reads return null', () => {
    storage.set(KEY, 'value');
    expect(storage.get(KEY)).toBe('value');
    storage.remove(KEY);
    expect(storage.get(KEY)).toBeNull();
  });

  it('does not throw when removing a key that does not exist', () => {
    expect(() => storage.remove('test.never-set')).not.toThrow();
  });

  it('stores JSON strings in the underlying key-value store', () => {
    storage.set(KEY, { a: 1 });
    expect(Storage.getItemSync(KEY)).toBe('{"a":1}');
  });

  it('returns null when the stored payload is not valid JSON', () => {
    Storage.setItemSync(KEY, '{not json');
    expect(storage.get(KEY)).toBeNull();
  });

  it('returns null when the store itself throws on read', () => {
    jest.spyOn(Storage, 'getItemSync').mockImplementation(() => {
      throw new Error('sqlite unavailable');
    });
    expect(storage.get(KEY)).toBeNull();
  });

  it('swallows write and remove failures instead of crashing the UI', () => {
    jest.spyOn(Storage, 'setItemSync').mockImplementation(() => {
      throw new Error('disk full');
    });
    jest.spyOn(Storage, 'removeItemSync').mockImplementation(() => {
      throw new Error('locked');
    });
    expect(() => storage.set(KEY, 'x')).not.toThrow();
    expect(() => storage.remove(KEY)).not.toThrow();
  });

  it('keeps keys isolated from each other', () => {
    storage.set('test.a', 'A');
    storage.set('test.b', 'B');
    expect(storage.get('test.a')).toBe('A');
    expect(storage.get('test.b')).toBe('B');
    storage.remove('test.a');
    expect(storage.get('test.a')).toBeNull();
    expect(storage.get('test.b')).toBe('B');
    storage.remove('test.b');
  });
});
