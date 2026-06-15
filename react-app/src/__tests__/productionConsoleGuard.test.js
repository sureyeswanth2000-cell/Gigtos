import { installProductionConsoleGuard } from '../utils/productionConsoleGuard';

describe('production console guard', () => {
  it('suppresses noisy browser logs only in production', () => {
    const originalLog = jest.fn();
    const originalInfo = jest.fn();
    const originalDebug = jest.fn();
    const fakeConsole = {
      log: originalLog,
      info: originalInfo,
      debug: originalDebug,
      warn: jest.fn(),
      error: jest.fn(),
    };
    const fakeGlobal = {};

    expect(installProductionConsoleGuard({
      env: 'production',
      consoleRef: fakeConsole,
      globalRef: fakeGlobal,
    })).toBe(true);

    fakeConsole.log('hidden');
    fakeConsole.info('hidden');
    fakeConsole.debug('hidden');
    fakeConsole.warn('kept');
    fakeConsole.error('kept');

    expect(fakeConsole.log).not.toBe(originalLog);
    expect(fakeConsole.info).not.toBe(originalInfo);
    expect(fakeConsole.debug).not.toBe(originalDebug);
    expect(originalLog).not.toHaveBeenCalled();
    expect(originalInfo).not.toHaveBeenCalled();
    expect(originalDebug).not.toHaveBeenCalled();
    expect(fakeConsole.warn).toHaveBeenCalledWith('kept');
    expect(fakeConsole.error).toHaveBeenCalledWith('kept');
    expect(fakeGlobal.__GIGTOS_PRODUCTION_CONSOLE_GUARD__).toBe(true);
  });

  it('does not change console methods outside production', () => {
    const originalLog = jest.fn();
    const fakeConsole = { log: originalLog };

    expect(installProductionConsoleGuard({
      env: 'development',
      consoleRef: fakeConsole,
      globalRef: {},
    })).toBe(false);

    fakeConsole.log('visible');
    expect(originalLog).toHaveBeenCalledWith('visible');
  });
});
