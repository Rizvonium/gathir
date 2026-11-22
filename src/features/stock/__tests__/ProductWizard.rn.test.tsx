import { fireEvent, screen } from '@testing-library/react-native';

import { ProductWizardScreen } from '../components/wizard/ProductWizardScreen';
import { useDraftStore } from '../store/draftStore';
import { photos, renderScreen, router } from './stockMocks';

jest.mock('react-native-reanimated', () => require('@/ui/components/__tests__/reanimatedMock'));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('@expo/ui', () => require('./stockMocks').expoUi);
jest.mock('react-native-gesture-handler', () => require('./stockMocks').gestureHandler);
jest.mock('@/ui/patterns', () => require('./stockMocks').patterns);
jest.mock('@/lib/photos', () => require('./stockMocks').photos);
jest.mock('expo-router', () => ({ router: require('./stockMocks').router }));
jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/db/stock', () => ({ StockError: class StockError extends Error {} }));
jest.mock('@/db/hooks', () => ({
  useProductDetail: () => null,
  useCategories: () => [{ id: 'cat-stoles', name: 'Stoles', icon: 'gesture', sortOrder: 0, isDefault: true, createdAt: 0, updatedAt: 0 }],
}));
jest.mock('../logic/saveDraft', () => ({
  saveDraft: jest.fn(() => ({ productId: 'new-1', created: true, filesToDelete: ['old.jpg'] })),
  filesOfDiscardedDraft: jest.fn(() => []),
}));

const { saveDraft } = jest.requireMock('../logic/saveDraft') as { saveDraft: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  useDraftStore.setState({ drafts: {}, justSavedId: null });
});

const render = () => renderScreen(<ProductWizardScreen />);

describe('ProductWizardScreen', () => {
  it('adds gallery photos to the draft', async () => {
    photos.pickFromGallery.mockResolvedValueOnce({ status: 'ok', uris: ['content://a', 'content://b'] } as never);
    photos.savePhoto.mockImplementation(async (uri: string) => ({ fileName: `${uri.slice(-1)}.jpg`, thumbName: `${uri.slice(-1)}.thumb.jpg`, width: 10, height: 10 }));
    await render();
    expect(screen.getByText('Lay flat in daylight, fill the frame.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('wizard-gallery'));
    expect(await screen.findByText('2 of 8 photos')).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('wizard-photos'), 'layout', { nativeEvent: { layout: { width: 360, height: 600, x: 0, y: 0 } } });
    expect(screen.getByLabelText('Cover photo, photo 1 of 2')).toBeOnTheScreen();
  });

  it('validates inline, jumps back to the missing field, then saves with the suggested name', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('wizard-next')); // → Details
    await fireEvent.press(screen.getByTestId('wizard-category-cat-stoles'));
    await fireEvent.press(screen.getByTestId('wizard-craft-Sozni'));
    expect(screen.getByLabelText('Sozni Stole')).toBeOnTheScreen(); // suggestion chip
    await fireEvent.press(screen.getByTestId('wizard-next')); // → Colours
    await fireEvent.press(screen.getByTestId('swatch-red'));
    expect(screen.getByText('Total: 1 piece')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('wizard-next')); // Save → rate missing
    expect(saveDraft).not.toHaveBeenCalled();
    expect(screen.getByText('Enter the rate in rupees.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Rate'), '6500');
    await fireEvent.press(screen.getByTestId('wizard-next'));
    await fireEvent.press(screen.getByTestId('wizard-next'));
    expect(saveDraft).toHaveBeenCalledTimes(1);
    const [, draft, name] = saveDraft.mock.calls[0];
    expect(name).toBe('Sozni Stole');
    expect(draft.ratePaise).toBe(650_000);
    expect(draft.colours.map((c: { name: string }) => c.name)).toEqual(['Red']);
    expect(photos.deletePhotoFiles).toHaveBeenCalledWith(['old.jpg']);
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/product/[id]', params: { id: 'new-1' } });
    expect(useDraftStore.getState().drafts.new).toBeUndefined();
    expect(useDraftStore.getState().justSavedId).toBe('new-1');
  });

  it('keeps the draft when leaving and coming back', async () => {
    const first = await render();
    await fireEvent.press(screen.getByTestId('wizard-next'));
    await fireEvent.press(screen.getByTestId('wizard-craft-Kani'));
    await first.unmount();
    await render();
    expect(screen.getByText('Details')).toBeOnTheScreen();
    expect(screen.getByTestId('wizard-craft-Kani')).toBeChecked();
  });

  it('One of a kind keeps a single piece and hides the steppers', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('wizard-next'));
    await fireEvent.press(screen.getByTestId('wizard-next'));
    await fireEvent.press(screen.getByTestId('swatch-red'));
    expect(screen.getByLabelText('Add one, Red pieces')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('wizard-one-of-a-kind'));
    expect(screen.queryByLabelText('Add one, Red pieces')).toBeNull();
    expect(screen.getByText('Which colour is it?')).toBeOnTheScreen();
  });
});
