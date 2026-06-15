describe('workerPushNotifications', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.REACT_APP_FIREBASE_VAPID_KEY;
    delete process.env.REACT_APP_FIREBASE_WEB_PUSH_VAPID_KEY;
    process.env.NODE_ENV = 'development';
  });

  function mockFirebase(registerCallable = jest.fn(() => Promise.resolve({ data: { success: true } }))) {
    jest.doMock('../firebase', () => ({
      __esModule: true,
      default: { name: 'test-app' },
      functionsInstance: {},
    }));
    jest.doMock('firebase/functions', () => ({
      httpsCallable: jest.fn(() => registerCallable),
    }));
    return { registerCallable };
  }

  it('returns missing_vapid_key before asking browser permission', async () => {
    mockFirebase();
    global.Notification = { permission: 'default', requestPermission: jest.fn() };
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: { serviceWorker: { register: jest.fn() } },
    });

    const { registerWorkerOfferPushToken } = require('./workerPushNotifications');
    const result = await registerWorkerOfferPushToken();

    expect(result.status).toBe('missing_vapid_key');
    expect(global.Notification.requestPermission).not.toHaveBeenCalled();
  });

  it('registers a worker push token when VAPID and permission are available', async () => {
    process.env.REACT_APP_FIREBASE_VAPID_KEY = 'B'.repeat(87);
    const { registerCallable } = mockFirebase();
    const serviceWorkerRegistration = { scope: '/' };
    global.Notification = { permission: 'granted', requestPermission: jest.fn() };
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: {
        serviceWorker: { register: jest.fn(() => Promise.resolve(serviceWorkerRegistration)) },
        userAgent: 'jest-worker-browser',
      },
    });
    jest.doMock('firebase/messaging', () => ({
      getMessaging: jest.fn(() => ({ app: 'test-app' })),
      getToken: jest.fn(() => Promise.resolve('fcm-token-123')),
      isSupported: jest.fn(() => Promise.resolve(true)),
    }));

    const { registerWorkerOfferPushToken } = require('./workerPushNotifications');
    const result = await registerWorkerOfferPushToken();

    expect(result.status).toBe('registered');
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/firebase-messaging-sw.js');
    expect(registerCallable).toHaveBeenCalledWith({
      token: 'fcm-token-123',
      platform: 'web',
      permission: 'granted',
      userAgent: 'jest-worker-browser',
    });
  });
});
