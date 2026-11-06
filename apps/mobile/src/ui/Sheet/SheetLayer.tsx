import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';

type SheetLayerApi = { show: (id: string, node: ReactNode | null) => void };

const SheetLayerContext = createContext<SheetLayerApi | null>(null);

/**
 * The layer every `Sheet` on a page is drawn in (owner, 2026-11-07). A sheet used to be drawn where
 * it was written, and React Native has no `position: fixed`: written inside a scrolling page or a
 * card, its "full screen" was the scroll content or the card. The Build source sheet then sat
 * below the fold, and the figure editor opened inside the plan card. `Screen` wraps the whole page
 * in this layer, so a sheet written anywhere on the page covers the window.
 *
 * The children render where they are, and only their open sheets move. A moved sheet keeps the
 * app-wide providers but not ones between the page's `Screen` and the sheet. No sheet relies on
 * those today, and keeping the page's field reveal off sheets is what the sibling layout did too.
 */
export function SheetLayerHost({ children }: { children: ReactNode }) {
  const [sheets, setSheets] = useState<ReadonlyMap<string, ReactNode>>(() => new Map());

  const show = useCallback((id: string, node: ReactNode | null) => {
    setSheets((current) => {
      if (node == null) {
        if (!current.has(id)) return current;
        const next = new Map(current);
        next.delete(id);
        return next;
      }
      if (current.get(id) === node) return current;
      const next = new Map(current);
      next.set(id, node);
      return next;
    });
  }, []);
  const api = useMemo(() => ({ show }), [show]);

  return (
    <SheetLayerContext.Provider value={api}>
      <View style={styles.fill}>
        {children}
        {sheets.size > 0 ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {[...sheets].map(([id, node]) => (
              <Fragment key={id}>{node}</Fragment>
            ))}
          </View>
        ) : null}
      </View>
    </SheetLayerContext.Provider>
  );
}

/**
 * Draws `node` in the page's sheet layer when there is one, otherwise where it stands (a sheet on
 * a screen without `Screen`, or in a test without one).
 */
export function InSheetLayer({ node }: { node: ReactNode | null }) {
  const layer = useContext(SheetLayerContext);
  const id = useId();
  // Every render hands the layer the newest element, so the sheet's content follows the page's
  // state exactly as if it were drawn in place.
  useLayoutEffect(() => {
    layer?.show(id, node);
  });
  useLayoutEffect(() => (layer ? () => layer.show(id, null) : undefined), [id, layer]);
  return layer ? null : <>{node}</>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
