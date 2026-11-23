import { router, useLocalSearchParams } from "expo-router";
import { fireEvent, screen } from "@testing-library/react-native";

jest.mock("expo-router", () => ({
  router: { setParams: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock("../../map/CalbayogMap", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: () => <View testID="calbayog-map" /> };
});

jest.mock("expo-location", () => ({
  getCurrentPositionAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));

jest.mock("../../services/api", () => ({
  api: jest.fn(),
  clearSession: jest.fn(),
}));

jest.mock("@expo/vector-icons/Ionicons", () => () => null);

jest.mock("react-native-reanimated", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const { useRef } = jest.requireActual<typeof import("react")>("react");
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (value: number) => useRef({ value }).current,
    useAnimatedStyle: (style: () => object) => style(),
    withSpring: (value: number) => value,
    interpolate: (_value: number, _input: number[], output: number[]) =>
      output[0],
    Extrapolation: { CLAMP: "clamp" },
  };
});

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView:
    jest.requireActual<typeof import("react-native")>("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  setRouteParams();
});

export const setParams = jest.mocked(router.setParams);

export function setRouteParams(params: Record<string, string> = {}) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params);
}

export function button(name: string | RegExp) {
  return screen.getByRole("button", { name });
}

export function press(name: string | RegExp) {
  return fireEvent.press(button(name));
}

export function fill(label: string, value: string) {
  return fireEvent.changeText(screen.getByLabelText(label), value);
}

export function appCallbacks() {
  return {
    action: jest
      .fn<
        Promise<boolean>,
        [endpoint: string, input: unknown, method?: string]
      >()
      .mockResolvedValue(true),
    refresh: jest.fn().mockResolvedValue(true),
    logout: jest.fn().mockResolvedValue(undefined),
    dismissNotice: jest.fn(),
  };
}
