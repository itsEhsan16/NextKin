/**
 * The host element every scroll container bottoms out as under `@react-native/jest-preset`.
 *
 * The preset swaps `ScrollView` for a mock that renders `RCTScrollView`, and `jest.setup.ts`
 * mocks `FlashList` to `FlatList` — which is a `ScrollView` — so this one tag covers the three
 * ScrollView screens and the FlashList one alike.
 */
const SCROLLER = 'RCTScrollView';

/**
 * As much of a rendered node as the walk below needs.
 *
 * Structural rather than `ReactTestInstance`, which lives in `react-test-renderer` — a package
 * this app does not depend on directly and whose types are not installed. Any RNTL query result
 * satisfies this.
 */
type Walkable = { type: unknown; parent: Walkable | null };

/**
 * Whether `node` has a scroll container anywhere above it.
 *
 * This is the whole proof that a header is pinned. "Pinned" is not a style or a flag that can be
 * asserted directly — it is the structural claim that the node lives *outside* whatever scrolls,
 * so no scroll offset can move it. Anything that walked styles instead would still pass if the
 * header were put back inside the scroller with `stickyHeaderIndices`, which is exactly the drift
 * this is defending against.
 *
 * It is only half a proof on its own: pinning the entire page also puts every node outside the
 * scroller. Always assert the other half too — that content which *should* scroll reports `true`.
 *
 * This file sits outside `__tests__` on purpose. Jest's default `testMatch` treats every
 * `.ts`/`.tsx` file under `__tests__` as a suite, and a helper module has no tests in it.
 */
export function insideScroller(node: Walkable | null | undefined): boolean {
  for (let n = node?.parent ?? null; n; n = n.parent) if (n.type === SCROLLER) return true;
  return false;
}
