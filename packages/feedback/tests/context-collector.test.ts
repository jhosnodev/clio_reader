import { describe, expect, it } from 'vitest';
import { DomainValidationError } from '@clio-reader/domain';

import { collectFeedbackContext, mapPlatform } from '../src/context-collector.js';

describe('mapPlatform', () => {
  it('maps electron process platforms', () => {
    expect(mapPlatform('win32')).toBe('windows');
    expect(mapPlatform('darwin')).toBe('macos');
    expect(mapPlatform('linux')).toBe('linux');
  });

  it('is case insensitive', () => {
    expect(mapPlatform('Win32')).toBe('windows');
    expect(mapPlatform('DARWIN')).toBe('macos');
  });

  it('rejects unknown platforms', () => {
    expect(() => mapPlatform('freebsd')).toThrow(DomainValidationError);
    expect(() => mapPlatform('freebsd')).toThrow('Unsupported feedback platform');
  });
});

describe('collectFeedbackContext', () => {
  it('collects the permitted metadata only', () => {
    const context = collectFeedbackContext(
      { version: '0.1.0', platform: 'linux', osVersion: '6.8.0' },
      { area: 'reader', documentFormat: 'epub', eventName: 'reader_open', locale: 'es' },
    );

    expect(context).toEqual({
      appVersion: '0.1.0',
      platform: 'linux',
      osVersion: '6.8.0',
      area: 'reader',
      documentFormat: 'epub',
      eventName: 'reader_open',
      locale: 'es',
    });
  });

  it('omits optional fields when not provided', () => {
    const context = collectFeedbackContext({ version: '0.1.0', platform: 'windows' });

    expect(context.osVersion).toBeUndefined();
    expect(context.area).toBeUndefined();
    expect(context.documentFormat).toBeUndefined();
    expect(context.eventName).toBeUndefined();
    expect(context.locale).toBeUndefined();
  });
});
