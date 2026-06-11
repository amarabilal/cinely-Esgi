import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Layout values for bottom sheets rendered inside an RN <Modal>.
 *
 * - `paddingBottom`: the modal can draw under the system bar (home indicator
 *   on iOS, transparent nav bar on Android), so content must clear the
 *   safe-area inset plus a small visual margin — otherwise rows render
 *   underneath the system buttons (observed: tag color swatches bisected by
 *   the 3-button nav bar).
 * - `maxHeight(fraction)`: a DEFINITE pixel cap (fraction of the window).
 *   Percentage maxHeight strings resolve against an indefinite-height parent
 *   inside the modal and clamp the inner ScrollView unpredictably (content
 *   hidden behind a scroll while blank space shows).
 */
export function useSheetLayout() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  return {
    paddingBottom: Math.max(insets.bottom, 12) + 12,
    maxHeight: (fraction: number) => Math.round(windowHeight * fraction),
  };
}
