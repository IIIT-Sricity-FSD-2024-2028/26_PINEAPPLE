import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useDispatch } from 'react-redux';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { createAppStore } from '..';
import communicationReducer, {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setChatDraft,
  setChatScrollFlag,
  openReportDialog,
  createInitialCommunicationState,
} from '../slices/communicationSlice';
import {
  fetchProjectMessages,
  sendProjectMessage,
  fetchChatUnread,
  markProjectChatRead,
  reportChatMessage,
} from '../thunks/communicationThunks';
import {
  selectMessagesByProjectId,
  selectMessagesStatusForProject,
  selectIsChatForbidden,
  selectChatForbiddenMessage,
  selectChatUnreadSummary,
  selectReportedIdsMap,
  selectChatDraftForProject,
  selectChatSendErrorForProject,
  selectCommunicationWorking,
} from '../selectors/communicationSelectors';
import { routeChanged, sessionReset } from '../actions/appActions';
import { renderWithStore } from '../../test/test-utils';
import { RouteResetListener } from '../components/RouteResetListener';
import ChatBox from '../../components/features/ChatBox';
import Navbar from '../../components/navbar';
import {
  useChatUnreadPolling,
  useChatMessagesPolling,
  getActiveChatUnreadPollHandle,
  getActiveChatUnreadSubscribersCount,
  getActiveChatMessagesPollHandle,
  getActiveChatMessagesSubscribersCount,
  resetChatPollingForTests,
} from '../../hooks/useChatPolling';

const { mockCommunicationApi } = vi.hoisted(() => ({
  mockCommunicationApi: {
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
    getUnread: vi.fn(),
    markProjectRead: vi.fn(),
    reportMessage: vi.fn(),
  },
}));

vi.mock('../../services/communicationApi', () => ({
  default: mockCommunicationApi,
  communicationApi: mockCommunicationApi,
}));

function UnreadPollerHarness({ userId = 'u-1', enabled = true, intervalMs = 60000 }) {
  const dispatch = useDispatch();
  useChatUnreadPolling(dispatch, { userId, enabled, intervalMs, immediate: true });
  return <div data-testid="unread-poller-mounted" />;
}

function MessagesPollerHarness({ projectId = 'p-1', enabled = true, intervalMs = 6000 }) {
  const dispatch = useDispatch();
  useChatMessagesPolling(dispatch, { projectId, enabled, intervalMs, immediate: false });
  return <div data-testid="msgs-poller-mounted" />;
}

function RouteChatHarness({ projectId = 'p-1' }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(fetchProjectMessages({ projectId, force: true }));
  }, [dispatch, projectId]);

  return (
    <div>
      <RouteResetListener />
      <Routes>
        <Route
          path="/workspace/:id"
          element={
            <div>
              <ChatBox
                projectId={projectId}
                messages={[{ id: 'm1', senderId: 'u2', senderName: 'Bob', content: 'Hello team' }]}
                currentUserId="u1"
                currentUserName="Alice"
                onSendMessage={(text) =>
                  dispatch(
                    sendProjectMessage({
                      projectId,
                      text,
                      senderId: 'u1',
                      senderName: 'Alice',
                    }),
                  )
                }
              />
              <button
                type="button"
                data-testid="go-other-route"
                onClick={() => navigate('/marketplace')}
              >
                Leave
              </button>
            </div>
          }
        />
        <Route path="/marketplace" element={<div data-testid="marketplace-route" />} />
      </Routes>
    </div>
  );
}

describe('Phase 7: communicationSlice, thunks, polling, ChatBox & Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChatPollingForTests();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    mockCommunicationApi.getMessages.mockResolvedValue([]);
    mockCommunicationApi.getUnread.mockResolvedValue({ total: 0, byProject: [] });
    mockCommunicationApi.markProjectRead.mockResolvedValue({ ok: true });
    mockCommunicationApi.reportMessage.mockResolvedValue({ id: 'rep-1' });
  });

  afterEach(() => {
    resetChatPollingForTests();
    vi.useRealTimers();
  });

  describe('1. CRUD Reducers, Optimistic Send & Reading B Route Reset', () => {
    it('supports all four explicit CRUD reducers (setAll, addOne, updateOne, removeOne)', () => {
      let state = createInitialCommunicationState();

      state = communicationReducer(
        state,
        setAll({
          projectId: 'p1',
          items: [
            { id: 'm1', projectId: 'p1', content: 'Hi', senderName: 'A' },
            { id: 'm2', projectId: 'p1', content: 'Hello', senderName: 'B' },
          ],
        }),
      );
      expect(selectMessagesByProjectId({ communication: state }, 'p1')).toHaveLength(2);

      state = communicationReducer(
        state,
        addOne({ id: 'm3', projectId: 'p1', content: 'Welcome', senderName: 'C' }),
      );
      expect(selectMessagesByProjectId({ communication: state }, 'p1')).toHaveLength(3);

      state = communicationReducer(
        state,
        updateOne({ id: 'm2', changes: { content: 'Hello edited' } }),
      );
      expect(state.entities.m2.content).toBe('Hello edited');

      state = communicationReducer(state, removeOne('m2'));
      expect(state.entities.m2).toBeUndefined();
      expect(state.messageIdsByProject.p1).toEqual(['m1', 'm3']);
    });

    it('clears volatile chat buffers on routeChanged while preserving loaded messages & unread summary', () => {
      let state = createInitialCommunicationState();
      state = communicationReducer(
        state,
        setAll({
          projectId: 'p1',
          items: [{ id: 'm1', projectId: 'p1', content: 'Persisted msg' }],
        }),
      );
      state = communicationReducer(
        state,
        setChatDraft({ projectId: 'p1', text: 'Unsent message draft' }),
      );
      state = communicationReducer(
        state,
        setChatScrollFlag({ projectId: 'p1', shouldScroll: true }),
      );
      state = communicationReducer(
        state,
        openReportDialog({ id: 'm1', senderName: 'Bob', content: 'Spam' }),
      );
      state = communicationReducer(
        state,
        fetchChatUnread.fulfilled(
          { total: 4, byProject: [{ projectId: 'p1', projectTitle: 'Alpha', unreadCount: 4 }] },
          'req-unread',
          {},
        ),
      );

      state = communicationReducer(
        state,
        routeChanged({ from: '/workspace/p1', to: '/marketplace', group: 'marketplace' }),
      );

      // Volatile working buffers cleared
      expect(selectChatDraftForProject({ communication: state }, 'p1')).toBe('');
      expect(selectCommunicationWorking({ communication: state }).shouldScrollByProject).toEqual({});
      expect(selectCommunicationWorking({ communication: state }).reportTarget).toBeNull();
      // Loaded messages & unread counts stayed
      expect(selectMessagesByProjectId({ communication: state }, 'p1')).toHaveLength(1);
      expect(selectChatUnreadSummary({ communication: state }).total).toBe(4);

      // Full wipe on sessionReset
      state = communicationReducer(state, sessionReset());
      expect(selectMessagesByProjectId({ communication: state }, 'p1')).toEqual([]);
      expect(selectChatUnreadSummary({ communication: state }).total).toBe(0);
    });
  });

  describe('2. Thunks & Condition Caching', () => {
    it('fetchProjectMessages fetches once, skips while fresh, force=true refetches, and 403 sets forbidden state', async () => {
      const store = createAppStore();
      mockCommunicationApi.getMessages.mockResolvedValueOnce([
        { id: 'm1', projectId: 'p1', senderId: 'u2', senderName: 'Bob', content: 'Hello' },
      ]);

      await store.dispatch(fetchProjectMessages({ projectId: 'p1' }));
      expect(mockCommunicationApi.getMessages).toHaveBeenCalledTimes(1);
      expect(selectMessagesStatusForProject(store.getState(), 'p1')).toBe('succeeded');
      expect(selectMessagesByProjectId(store.getState(), 'p1')).toHaveLength(1);

      // Freshness condition skips duplicate call
      await store.dispatch(fetchProjectMessages({ projectId: 'p1' }));
      expect(mockCommunicationApi.getMessages).toHaveBeenCalledTimes(1);

      // force: true bypasses freshness cache
      mockCommunicationApi.getMessages.mockRejectedValueOnce({
        statusCode: 403,
        code: 'CHAT_MEMBERSHIP_REQUIRED',
        message: 'You are not a member of this project.',
      });
      await store.dispatch(fetchProjectMessages({ projectId: 'p1', force: true }));
      expect(selectIsChatForbidden(store.getState(), 'p1')).toBe(true);
      expect(selectChatForbiddenMessage(store.getState(), 'p1')).toBe(
        'You are not a member of this project.',
      );
    });

    it('optimistic sendProjectMessage adds temp id in pending, swaps on fulfill, and rolls back on failure', async () => {
      const store = createAppStore();
      let resolveSend;
      mockCommunicationApi.sendMessage.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSend = resolve;
          }),
      );

      const pendingPromise = store.dispatch(
        sendProjectMessage({
          projectId: 'p1',
          text: 'Optimistic hello',
          senderId: 'u1',
          senderName: 'Alice',
        }),
      );

      // Immediately visible via optimistic temp entity
      let msgs = selectMessagesByProjectId(store.getState(), 'p1');
      expect(msgs).toHaveLength(1);
      expect(msgs[0].id).toMatch(/^temp-/);
      expect(msgs[0].content).toBe('Optimistic hello');

      resolveSend({
        id: 'srv-101',
        projectId: 'p1',
        senderId: 'u1',
        senderName: 'Alice',
        content: 'Optimistic hello',
      });
      await pendingPromise;

      msgs = selectMessagesByProjectId(store.getState(), 'p1');
      expect(msgs).toHaveLength(1);
      expect(msgs[0].id).toBe('srv-101');

      // Failure removes temp message and records send error
      mockCommunicationApi.sendMessage.mockRejectedValueOnce({
        statusCode: 500,
        message: 'Chat service down',
      });

      await store.dispatch(
        sendProjectMessage({
          projectId: 'p1',
          text: 'Fails to deliver',
          senderId: 'u1',
          senderName: 'Alice',
        }),
      );

      msgs = selectMessagesByProjectId(store.getState(), 'p1');
      expect(msgs.map((m) => m.id)).toEqual(['srv-101']);
      expect(selectChatSendErrorForProject(store.getState(), 'p1')).toBe(
        'Chat service down',
      );
    });

    it('reportChatMessage updates reportedIdsById and formats error codes cleanly', async () => {
      const store = createAppStore();
      mockCommunicationApi.reportMessage.mockResolvedValueOnce({ id: 'rep-1' });

      await store.dispatch(
        reportChatMessage({ messageId: 'm1', reason: 'Abusive language in chat.' }),
      );
      expect(mockCommunicationApi.reportMessage).toHaveBeenCalledWith(
        'm1',
        'Abusive language in chat.',
      );
      expect(selectReportedIdsMap(store.getState())['m1']).toBe(true);
      expect(selectCommunicationWorking(store.getState()).reportSuccessMsg).toContain(
        'Report sent. Admins will review it.',
      );

      mockCommunicationApi.reportMessage.mockRejectedValueOnce({
        statusCode: 429,
        code: 'TOO_MANY_REPORTS',
        message: 'Too many requests',
      });
      await store.dispatch(
        reportChatMessage({ messageId: 'm2', reason: 'Spam flood message.' }),
      );
      expect(selectCommunicationWorking(store.getState()).reportError).toContain(
        'Daily report limit reached.',
      );
    });
  });

  describe('3. Polling Hooks (Single Loop, Visibility Pause/Resume & Unmount Cleanup)', () => {
    it('runs single unread & messages polling loops, pauses while hidden, resumes on visible, and cleans up on unmount', async () => {
      vi.useFakeTimers();
      const store = createAppStore();

      const { unmount } = renderWithStore(
        <>
          <UnreadPollerHarness userId="u-1" intervalMs={60000} />
          <UnreadPollerHarness userId="u-1" intervalMs={60000} />
          <MessagesPollerHarness projectId="p-1" intervalMs={6000} />
          <MessagesPollerHarness projectId="p-1" intervalMs={6000} />
        </>,
        { store },
      );

      expect(getActiveChatUnreadSubscribersCount()).toBe(2);
      expect(getActiveChatUnreadPollHandle()).not.toBeNull();
      expect(getActiveChatMessagesSubscribersCount()).toBe(2);
      expect(getActiveChatMessagesPollHandle()).not.toBeNull();
      // Immediate unread call once for single loop
      expect(mockCommunicationApi.getUnread).toHaveBeenCalledTimes(1);

      // Advance 6s -> only 1 getMessages call (not 2)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });
      expect(mockCommunicationApi.getMessages).toHaveBeenCalledTimes(1);

      // Hide tab -> polling skips
      const origHiddenDesc = Object.getOwnPropertyDescriptor(document, 'hidden');
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(60000);
      });
      expect(mockCommunicationApi.getUnread).toHaveBeenCalledTimes(1);
      expect(mockCommunicationApi.getMessages).toHaveBeenCalledTimes(1);

      // Restore visibility -> resumes cleanly
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(mockCommunicationApi.getUnread).toHaveBeenCalledTimes(2);
      expect(mockCommunicationApi.getMessages).toHaveBeenCalledTimes(2);

      if (origHiddenDesc) {
        Object.defineProperty(document, 'hidden', origHiddenDesc);
      }

      unmount();
      expect(getActiveChatUnreadSubscribersCount()).toBe(0);
      expect(getActiveChatUnreadPollHandle()).toBeNull();
      expect(getActiveChatMessagesSubscribersCount()).toBe(0);
      expect(getActiveChatMessagesPollHandle()).toBeNull();
    });
  });

  describe('4. UI Integration: Navbar + Chat Read Sync, 403 State, Report & Route-Leave Reset', () => {
    it('Navbar badge and workspace markProjectChatRead agree via Redux store with no DOM events', async () => {
      const store = createAppStore({
        preloadedState: {
          session: {
            user: { id: 'u1', name: 'Alice', role: 'Collaborator' },
            isAuthenticated: true,
            status: 'authenticated',
            activeRole: 'Collaborator',
            allowedRoles: ['Collaborator'],
            mentorApproved: false,
          },
        },
      });
      mockCommunicationApi.getUnread
        .mockResolvedValueOnce({
          total: 2,
          byProject: [{ projectId: 'p-1', projectTitle: 'Alpha', unreadCount: 2 }],
        })
        .mockResolvedValueOnce({
          total: 0,
          byProject: [{ projectId: 'p-1', projectTitle: 'Alpha', unreadCount: 0 }],
        });

      renderWithStore(
        <Navbar onMenuClick={vi.fn()} />,
        { store },
      );

      expect((await screen.findByTestId('navbar-chat-badge')).textContent).toBe('2');

      // Opening chat in workspace dispatches markProjectChatRead -> updates Navbar immediately
      await act(async () => {
        await store.dispatch(markProjectChatRead({ projectId: 'p-1' }));
      });

      await waitFor(() => {
        expect(mockCommunicationApi.markProjectRead).toHaveBeenCalledWith('p-1');
        expect(screen.queryByTestId('navbar-chat-badge')).toBeNull();
      });
    });

    it('ChatBox renders 403 forbidden state from store, submits report, and clears draft on route change', async () => {
      const store = createAppStore();
      mockCommunicationApi.getMessages.mockResolvedValueOnce([
        { id: 'm1', projectId: 'p-1', senderId: 'u2', senderName: 'Bob', content: 'Hello team' },
      ]);
      mockCommunicationApi.reportMessage.mockResolvedValueOnce({ id: 'rep-9' });

      renderWithStore(<RouteChatHarness projectId="p-1" />, {
        store,
        route: '/workspace/p-1',
      });

      const input = screen.getByPlaceholderText(/Type your message/i);
      fireEvent.change(input, { target: { value: 'Half-typed note' } });
      expect(selectChatDraftForProject(store.getState(), 'p-1')).toBe('Half-typed note');

      // Report flow
      fireEvent.click(screen.getByTestId('report-msg-btn-m1'));
      fireEvent.change(screen.getByTestId('chat-report-reason-input'), {
        target: { value: 'Contains inappropriate spam remarks.' },
      });
      fireEvent.click(screen.getByTestId('submit-chat-report-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('chat-report-success')).toBeTruthy();
        expect(screen.getByTestId('reported-badge-m1')).toBeTruthy();
      });

      // Navigating away triggers RouteResetListener -> clears draft & report confirmation banner
      fireEvent.click(screen.getByTestId('go-other-route'));
      await waitFor(() => {
        expect(screen.getByTestId('marketplace-route')).toBeTruthy();
      });
      expect(selectChatDraftForProject(store.getState(), 'p-1')).toBe('');
      expect(selectCommunicationWorking(store.getState()).reportSuccessMsg).toBe('');
      // Loaded messages stay in store
      expect(selectMessagesByProjectId(store.getState(), 'p-1')).toHaveLength(1);

      // 403 non-member display
      const forbiddenStore = createAppStore({
        preloadedState: {
          communication: {
            ...createInitialCommunicationState(),
            forbiddenByProject: { 'p-secret': true },
            byProjectError: { 'p-secret': 'You are not a member of this project.' },
          },
        },
      });
      renderWithStore(
        <ChatBox
          projectId="p-secret"
          isForbidden={selectIsChatForbidden(forbiddenStore.getState(), 'p-secret')}
          forbiddenMessage={selectChatForbiddenMessage(forbiddenStore.getState(), 'p-secret')}
          onSendMessage={vi.fn()}
        />,
        { store: forbiddenStore },
      );
      expect(screen.getByTestId('chatbox-forbidden').textContent).toContain(
        'You are not a member of this project.',
      );
    });
  });
});
