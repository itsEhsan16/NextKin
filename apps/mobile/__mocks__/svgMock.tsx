import type { FC } from 'react';
import { View } from 'react-native';
import type { SvgProps } from 'react-native-svg';

/** Jest stand-in for `.svg` imports (react-native-svg-transformer is Metro-only). */
const SvgMock: FC<SvgProps> = (props) => <View testID="svg" {...(props as object)} />;

export default SvgMock;
