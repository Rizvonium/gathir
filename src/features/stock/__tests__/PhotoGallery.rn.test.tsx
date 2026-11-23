import { fireEvent, screen } from '@testing-library/react-native';

import { Dimensions } from 'react-native';

import type { Photo } from '@/db/schema';
import { renderWithTheme } from '@/ui/components/__tests__/renderWithTheme';

import { isFullSizePage, PhotoGallery } from '../components/PhotoGallery';

jest.mock('react-native-gesture-handler', () => require('./stockMocks').gestureHandler);
jest.mock('@/lib/photos', () => require('./stockMocks').photos);
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: ({ source }: { source: { uri: string } }) => <View testID={`img:${source.uri}`} /> };
});

const photos: Photo[] = Array.from({ length: 8 }, (_, i) => ({
  id: `ph${i}`,
  productId: 'p1',
  fileName: `p${i}.jpg`,
  thumbName: `p${i}.thumb.jpg`,
  width: 1600,
  height: 2000,
  sortOrder: i,
  createdAt: 0,
}));

const fullImages = () => screen.queryAllByTestId(/^img:file:\/\/\/photos\//).map((n) => n.props.testID as string);

describe('PhotoGallery', () => {
  it('windows full-size photos to the current page and its neighbours', () => {
    expect([0, 1, 2, 3].map((i) => isFullSizePage(i, 0))).toEqual([true, true, false, false]);
    expect([2, 3, 4, 5].map((i) => isFullSizePage(i, 4))).toEqual([false, true, true, true]);
  });

  it('loads only 2 of 8 full-size photos on open, and moves the window as pages change', async () => {
    await renderWithTheme(<PhotoGallery photos={photos} name="Stole" />);
    expect(fullImages()).toEqual(['img:file:///photos/p0.jpg', 'img:file:///photos/p1.jpg']);
    // Every page still has a picture (the thumbnail) and its TalkBack label.
    expect(screen.getAllByRole('image')).toHaveLength(8);

    const { width } = Dimensions.get('window');
    await fireEvent(screen.getByTestId('photo-gallery'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: width * 4, y: 0 } } });
    expect(fullImages()).toEqual(['img:file:///photos/p3.jpg', 'img:file:///photos/p4.jpg', 'img:file:///photos/p5.jpg']);
  });
});
