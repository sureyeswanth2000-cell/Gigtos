import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

process.env.REACT_APP_ENABLE_DEV_BYPASS = 'true';

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'dev-app' })),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  EmailAuthProvider: {
    credential: jest.fn((email, password) => ({ email, password })),
  },
  GoogleAuthProvider: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: { uid: 'new-user', email: 'new@example.com' } })),
  reauthenticateWithCredential: jest.fn(() => Promise.resolve()),
  reauthenticateWithPopup: jest.fn(() => Promise.resolve()),
  signInWithPopup: jest.fn(() => Promise.resolve({ user: { uid: 'google-user', email: 'g@example.com' } })),
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback(null);
    return jest.fn();
  }),
  signOut: jest.fn(() => Promise.resolve()),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn((db, name) => ({ db, name })),
  doc: jest.fn((db, collectionName, id) => ({ db, collectionName, id })),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  onSnapshot: jest.fn((queryRef, next) => {
    next({ docs: [] });
    return jest.fn();
  }),
  addDoc: jest.fn(() => Promise.resolve({ id: 'dev-doc' })),
  updateDoc: jest.fn(() => Promise.resolve()),
  setDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
  query: jest.fn((...args) => args),
  where: jest.fn((...args) => args),
  serverTimestamp: jest.fn(() => new Date('2026-05-16T00:00:00Z')),
  arrayUnion: jest.fn((...items) => items),
}));

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
}));

jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(() => ({})),
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({})),
  ref: jest.fn((storage, path) => ({ storage, path })),
  uploadBytesResumable: jest.fn(() => ({
    on: jest.fn((event, progress, error, complete) => {
      progress?.({ bytesTransferred: 1, totalBytes: 1 });
      complete?.();
    }),
  })),
  getDownloadURL: jest.fn(() => Promise.resolve('https://example.com/dev-upload.jpg')),
}));

const App = require('../App').default;
const Auth = require('../pages/Auth').default;
const { ThemeProvider } = require('../context/ThemeContext');
const { ToastProvider } = require('../context/ToastContext');
const { MemoryRouter } = require('react-router-dom');

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

function renderAuth(initialEntry = '/auth?mode=worker&phase=signup') {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Auth />
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

describe('dev-auth UI smoke', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = jest.fn(() => ({
      matches: false,
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }));
    global.URL.createObjectURL = jest.fn(() => 'blob:gigtos-preview');
    global.URL.revokeObjectURL = jest.fn();
  });

  it('opens the protected service booking screen as a dev consumer and updates smart match', async () => {
    window.history.pushState({}, '', '/Gigtos/service?devAuth=consumer');

    renderApp();

    expect(await screen.findByRole('heading', { name: /Book Home Helper/i })).toBeInTheDocument();
    expect(screen.getByText('Dev Consumer')).toBeInTheDocument();
    expect(screen.getByText(/Indiranagar, Bangalore/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Describe your issue/i), {
      target: { value: 'urgent kitchen help needed immediately' },
    });

    expect(await screen.findByText('High')).toBeInTheDocument();
    expect(screen.getByText('30-90 mins')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Review and book/i }));
    expect(await screen.findByText(/Locked price:/i)).toBeInTheDocument();
    expect(screen.getByText(/Worker receives full amount:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Why this price\?/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Worker receives the full customer price during launch/i).length).toBeGreaterThan(0);
  });

  it('opens the public service catalog with launch and recruitable services', async () => {
    window.history.pushState({}, '', '/Gigtos/services?devAuth=consumer');

    renderApp();

    expect(await screen.findByRole('heading', { name: /Services/i })).toBeInTheDocument();
    expect(screen.getByText('Kitchen Help')).toBeInTheDocument();
    expect(screen.getByText('Painter')).toBeInTheDocument();
    expect(screen.getAllByText(/Suggested fair range/i).length).toBeGreaterThan(1);
  });

  it('opens the public worker landing page and routes to worker signup', async () => {
    window.history.pushState({}, '', '/Gigtos/workers?devAuth=consumer');

    renderApp();

    expect(await screen.findByRole('heading', { name: /Join Gigtos as a verified home-service worker/i })).toBeInTheDocument();
    expect(screen.getByText(/Keep job earnings/i)).toBeInTheDocument();
    expect(screen.getByText(/Open-to-Work control/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start worker signup/i })).toHaveAttribute('href', '#/auth?mode=worker&phase=signup');
  });

  it('opens worker signup verification fields', async () => {
    renderAuth('/auth?mode=worker&phase=signup');

    expect(await screen.findByRole('heading', { name: /Join Gigtos/i })).toBeInTheDocument();
    expect(screen.getByText(/Experience years/i)).toBeInTheDocument();
    expect(screen.getByText(/Starting price/i)).toBeInTheDocument();
    expect(screen.getByText(/Identity check/i)).toBeInTheDocument();
    expect(screen.getByText(/Worker proof/i)).toBeInTheDocument();
    expect(screen.getByText(/Profile photo/i)).toBeInTheDocument();
    expect(screen.getByText(/Previous platform or work proof/i)).toBeInTheDocument();

    const profileInput = screen.getByLabelText(/Profile photo/i);
    const previousProofInput = screen.getByLabelText(/Previous platform or work proof/i);
    expect(profileInput).toHaveAttribute('multiple');
    expect(previousProofInput).toHaveAttribute('multiple');

    fireEvent.change(profileInput, {
      target: { files: [new File(['photo'], 'profile.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.change(previousProofInput, {
      target: { files: [new File(['proof'], 'platform-proof.pdf', { type: 'application/pdf' })] },
    });

    expect(await screen.findByText(/Selected proofs/i)).toBeInTheDocument();
    expect(screen.getByText(/profile.jpg/i)).toBeInTheDocument();
    expect(screen.getByText(/platform-proof.pdf/i)).toBeInTheDocument();
  });

  it('opens the protected worker dashboard as a dev worker and reaches start-work proof modal', async () => {
    window.history.pushState({}, '', '/Gigtos/worker/dashboard?devAuth=worker');

    renderApp();

    expect(await screen.findByText('Dev Worker')).toBeInTheDocument();
    expect(screen.getByLabelText(/GigScore 500/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Worker wallet/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/GigScore free access/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Smart Queue/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/New job offers/i)).toBeInTheDocument();
    expect(screen.getByText(/Open-to-Work setup/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Worker price guardrails/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Check price rules/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Worker price for/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open to Work \(90 min\)/i })).toBeInTheDocument();
    expect(screen.getByText(/In-Progress Services/i)).toBeInTheDocument();
    expect(screen.getByText(/Available Services/i)).toBeInTheDocument();
    expect(screen.getByText(/Set Your Fixed Day Rate/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Start Work/i));

    expect(await screen.findByText(/Start Work Proof/i)).toBeInTheDocument();
    expect(screen.getByText(/Take a fresh arrival selfie/i)).toBeInTheDocument();
    expect(screen.getByText(/Before-work photos optional/i)).toBeInTheDocument();
  });

  it('opens the protected field operator console as a dev field operator', async () => {
    window.history.pushState({}, '', '/Gigtos/operator?devAuth=field_operator');

    renderApp();

    expect(await screen.findByRole('heading', { name: /Local trust control tower/i })).toBeInTheDocument();
    expect(screen.getByText(/Worker Verification Queue/i)).toBeInTheDocument();
    expect(screen.getByText(/Ravi Kumar/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Disputes/i }));

    expect(await screen.findByText(/Dispute Queue/i)).toBeInTheDocument();
    expect(screen.getByText(/Bathroom Cleaning/i)).toBeInTheDocument();
  });
});
