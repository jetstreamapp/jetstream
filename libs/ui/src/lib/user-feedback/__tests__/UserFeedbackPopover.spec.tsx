/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
// The real app-state module calls fetchUserProfile() at init time, which fails in the test environment. See Popover.spec.tsx.
vi.mock('@jetstream/ui/app-state', async () => {
  const { atom } = await import('jotai');
  return { fromAppState: { appInfoState: atom({ version: 'v-test' }) } };
});

vi.mock('@jetstream/shared/data', () => ({
  submitUserFeedback: vi.fn(),
}));

vi.mock('../../toast/AppToast', () => ({
  fireToast: vi.fn(),
}));

vi.mock('../../form/file-selector/file-selector-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../form/file-selector/file-selector-utils')>();
  return { ...actual, readFileForUpload: vi.fn(actual.readFileForUpload) };
});

import { submitUserFeedback } from '@jetstream/shared/data';
import { axeScan } from '@jetstream/test-utils';
import { InputReadFileContent } from '@jetstream/types';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileForUpload } from '../../form/file-selector/file-selector-utils';
import { fireToast } from '../../toast/AppToast';
import { UserFeedbackPopover } from '../UserFeedbackPopover';

const mockSubmitUserFeedback = vi.mocked(submitUserFeedback);
const mockReadFileForUpload = vi.mocked(readFileForUpload);

async function openPopover(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Feedback' }));
  return getMessageInput();
}

function getMessageInput() {
  return screen.getByPlaceholderText<HTMLTextAreaElement>(/anything else on your mind/);
}

function createImage(filename: string) {
  return new File([new Uint8Array([137, 80, 78, 71])], filename, { type: 'image/png' });
}

function pasteImages(textarea: HTMLTextAreaElement, images: File[]) {
  fireEvent.paste(textarea, {
    clipboardData: { items: images.map((image) => ({ kind: 'file', type: image.type, getAsFile: () => image })) },
  });
}

function getSendButton() {
  return screen.getByRole<HTMLButtonElement>('button', { name: 'Send' });
}

describe('UserFeedbackPopover', () => {
  beforeEach(() => {
    mockSubmitUserFeedback.mockReset();
    mockSubmitUserFeedback.mockResolvedValue({ success: true });
    vi.mocked(fireToast).mockReset();
    // Restores the pass-through to the real implementation after tests that override it
    mockReadFileForUpload.mockReset();
  });

  test('has no axe violations when open', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(<UserFeedbackPopover />);

    await openPopover(user);

    await axeScan(baseElement);
  });

  test('sends a quick message and clears the draft', async () => {
    const user = userEvent.setup();
    render(<UserFeedbackPopover />);

    const textarea = await openPopover(user);
    expect(getSendButton().disabled).toBe(true);

    await user.type(textarea, 'Love the new query builder');
    await user.click(getSendButton());

    await waitFor(() => expect(screen.queryByTestId('user-feedback-popover')).toBeNull());
    expect(mockSubmitUserFeedback).toHaveBeenCalledWith({
      type: 'other',
      message: 'Love the new query builder',
      screenshots: [],
      clientVersion: 'v-test',
    });
    expect(fireToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));

    expect((await openPopover(user)).value).toBe('');
  });

  test('sends with modifier + Enter', async () => {
    const user = userEvent.setup();
    render(<UserFeedbackPopover />);

    const textarea = await openPopover(user);
    await user.type(textarea, 'Quick one');
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => expect(mockSubmitUserFeedback).toHaveBeenCalledTimes(1));
    expect(mockSubmitUserFeedback.mock.calls[0][0].message).toBe('Quick one');
  });

  test('keeps the draft when closed without sending', async () => {
    const user = userEvent.setup();
    render(<UserFeedbackPopover />);

    await user.type(await openPopover(user), 'Half written thought');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('user-feedback-popover')).toBeNull());

    expect((await openPopover(user)).value).toBe('Half written thought');
    expect(mockSubmitUserFeedback).not.toHaveBeenCalled();
  });

  test('keeps the draft and shows an error when sending fails', async () => {
    mockSubmitUserFeedback.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    render(<UserFeedbackPopover />);

    await user.type(await openPopover(user), 'This will fail');
    await user.click(getSendButton());

    expect(await screen.findByText(/could not be sent/)).toBeTruthy();
    expect(getMessageInput().value).toBe('This will fail');
    expect(fireToast).not.toHaveBeenCalled();
  });

  test('opens from the global keyboard shortcut', async () => {
    render(<UserFeedbackPopover />);

    // Shift changes `key` to ">" on most layouts, so the shortcut must match on `code`
    fireEvent.keyDown(window, { key: '>', code: 'Period', ctrlKey: true, shiftKey: true });

    expect(await screen.findByTestId('user-feedback-popover')).toBeTruthy();
  });

  test('attaches a pasted image instead of inserting it as text', async () => {
    const user = userEvent.setup();
    render(<UserFeedbackPopover />);

    const textarea = await openPopover(user);
    await user.type(textarea, 'See screenshot');
    pasteImages(textarea, [createImage('image.png')]);

    expect(await screen.findByText('image.png')).toBeTruthy();
    expect(textarea.value).toBe('See screenshot');

    await user.click(getSendButton());
    await waitFor(() => expect(mockSubmitUserFeedback).toHaveBeenCalledTimes(1));
    expect(mockSubmitUserFeedback.mock.calls[0][0].screenshots).toEqual([expect.objectContaining({ filename: 'image.png' })]);
  });

  test('blocks sending until a pasted image has finished reading', async () => {
    let finishRead: (content: InputReadFileContent) => void = () => undefined;
    mockReadFileForUpload.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRead = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<UserFeedbackPopover />);

    const textarea = await openPopover(user);
    await user.type(textarea, 'See screenshot');
    pasteImages(textarea, [createImage('slow.png')]);

    await waitFor(() => expect(getSendButton().disabled).toBe(true));
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(mockSubmitUserFeedback).not.toHaveBeenCalled();

    finishRead({ filename: 'slow.png', extension: '.png', content: new ArrayBuffer(4) });
    expect(await screen.findByText('slow.png')).toBeTruthy();
    expect(getSendButton().disabled).toBe(false);

    await user.click(getSendButton());
    await waitFor(() => expect(mockSubmitUserFeedback).toHaveBeenCalledTimes(1));
    expect(mockSubmitUserFeedback.mock.calls[0][0].screenshots).toEqual([expect.objectContaining({ filename: 'slow.png' })]);
  });

  test('stops reading images once the screenshot limit is reached', async () => {
    const user = userEvent.setup();
    render(<UserFeedbackPopover />);

    const textarea = await openPopover(user);
    pasteImages(
      textarea,
      Array.from({ length: 7 }, (_, i) => createImage(`image-${i}.png`)),
    );

    expect(await screen.findByText(/You can attach up to 5 screenshots/)).toBeTruthy();
    expect(mockReadFileForUpload).toHaveBeenCalledTimes(5);
    expect(screen.getAllByRole('button', { name: /^Remove image-/ })).toHaveLength(5);
  });

  test('overlapping additions cannot exceed the screenshot limit', async () => {
    const pendingReads: Array<() => void> = [];
    mockReadFileForUpload.mockImplementation(
      (file) =>
        new Promise((resolve) => {
          pendingReads.push(() => resolve({ filename: file.name, extension: '.png', content: new ArrayBuffer(4) }));
        }),
    );
    const user = userEvent.setup();
    render(<UserFeedbackPopover />);

    const textarea = await openPopover(user);
    pasteImages(textarea, [createImage('first-1.png'), createImage('first-2.png'), createImage('first-3.png')]);
    pasteImages(textarea, [createImage('second-1.png'), createImage('second-2.png'), createImage('second-3.png')]);

    // Each finished read lets the next one in the loop start, so keep draining until both pastes are done
    while (pendingReads.length) {
      await act(async () => {
        pendingReads.splice(0).forEach((finishRead) => finishRead());
      });
    }

    expect(await screen.findByText(/You can attach up to 5 screenshots/)).toBeTruthy();
    expect(mockReadFileForUpload).toHaveBeenCalledTimes(5);
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(5);
  });

  test('removing a screenshot frees its slot', async () => {
    const user = userEvent.setup();
    render(<UserFeedbackPopover />);

    const textarea = await openPopover(user);
    pasteImages(
      textarea,
      Array.from({ length: 5 }, (_, i) => createImage(`image-${i}.png`)),
    );
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Remove image-/ })).toHaveLength(5));

    await user.click(screen.getByRole('button', { name: 'Remove image-0.png' }));
    pasteImages(textarea, [createImage('replacement.png')]);

    expect(await screen.findByText('replacement.png')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(5);
  });
});
