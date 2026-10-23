/**
 * At most one swipe row is open at a time, app-wide — the iOS Mail rule. Opening a row (or just
 * starting to drag one) closes whichever row was open before, and a list can close the open row
 * when it starts scrolling. Kept out of SwipeableRow so it can be tested without a gesture.
 */
export type SwipeRowHandle = { close: () => void };

let openRow: SwipeRowHandle | null = null;

/** `row` is now the open row; the previous one closes. */
export function claimSwipeRow(row: SwipeRowHandle): void {
  if (openRow && openRow !== row) openRow.close();
  openRow = row;
}

/** `row` closed (or unmounted, or was recycled to another item). */
export function releaseSwipeRow(row: SwipeRowHandle): void {
  if (openRow === row) openRow = null;
}

/** Closes the open row, if any — call from a list's onScrollBeginDrag. */
export function closeOpenSwipeRow(): void {
  const row = openRow;
  openRow = null;
  row?.close();
}
