import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

process.env.REACT_APP_ENABLE_DEV_BYPASS = 'true';

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'dev-app' })),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  GoogleAuthProvider: jest.fn(),
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
}));

jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(() => ({})),
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({})),
  ref: jest.fn((storage, path) => ({ storage, path })),
  uploadBytes: jest.fn(() => Promise.resolve()),
  getDownloadURL: jest.fn(() => Promise.resolve('https://example.com/dev-upload.jpg')),
}));

const App = require('../App').default;
const { ThemeProvider } = require('../context/ThemeContext');

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
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
  });

  it('opens the public service catalog with launch and recruitable services', async () => {
    window.history.pushState({}, '', '/Gigtos/services?devAuth=consumer');

    renderApp();

    expect(await screen.findByRole('heading', { name: /Services/i })).toBeInTheDocument();
    expect(screen.getByText('Kitchen Help')).toBeInTheDocument();
    expect(screen.getByText('Painter')).toBeInTheDocument();
    expect(screen.getAllByText(/Suggested fair range/i).length).toBeGreaterThan(1);
  });

  it('opens the protected worker dashboard as a dev worker and reaches completion-photo modal', async () => {
    window.history.pushState({}, '', '/Gigtos/worker/dashboard?devAuth=worker');

    renderApp();

    expect(await screen.findByText('Dev Worker')).toBeInTheDocument();
    expect(screen.getByLabelText(/SocioScore 500/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Worker wallet/i)).toBeInTheDocument();
    expect(screen.getByText(/Cash platform-fee due/i)).toBeInTheDocument();
    expect(screen.getByText(/one job per day/i)).toBeInTheDocument();
    expect(screen.getByText(/In-Progress Services/i)).toBeInTheDocument();
    expect(screen.getByText(/Available Services/i)).toBeInTheDocument();
    expect(screen.getByText(/Set Your Fixed Day Rate/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Start Work/i));

    await waitFor(() => {
      expect(screen.getByText(/Mark Complete/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Mark Complete/i));
    expect(await screen.findByText(/Mark Job as Complete/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload at least one/i)).toBeInTheDocument();
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
