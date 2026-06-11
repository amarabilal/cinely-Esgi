import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Layout values for bottom sheets rendered inside an RN <Modal>.
 *
 * - `paddingBottom`: on iOS the modal draws under the home indicator, so pad
 *   by the safe-area inset. On Android the system navigation bar sits OUTSIDE
 *   the modal window, so an inset-sized pad would double-compensate and render
 *   as a dead gap — a fixed, comfortable padding is correct there.
 * - `maxHeight(fraction)`: a DEFINITE pixel cap (fraction of the window).
 *   Percentage maxHeight strings resolve against an indefinite-height parent
 *   inside the modal and clamp the inner ScrollView unpredictably (content
 *   hidden behind a scroll while blank space shows).
 */
export function useSheetLayout() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const paddingBottom =
    Platform.OS === 'ios' ? Math.max(insets.bottom, 16) + 8 : 24;
  return {
    paddingBottom,
    maxHeight: (fraction: number) => Math.round(windowHeight * fraction),
  };
}
