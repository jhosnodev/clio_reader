import {
  DomainValidationError,
  type FeedbackArea,
  type FeedbackContext,
  type FeedbackDocumentFormat,
  type FeedbackPlatform,
} from '@clio-reader/domain';

export interface AppInfo {
  readonly version: string;
  readonly platform: string;
  readonly osVersion?: string | undefined;
}

export interface CollectContextOptions {
  readonly area?: FeedbackArea | undefined;
  readonly documentFormat?: FeedbackDocumentFormat | undefined;
  readonly eventName?: string | undefined;
  readonly locale?: string | undefined;
}

const PLATFORM_MAP: Record<string, FeedbackPlatform> = {
  win32: 'windows',
  win64: 'windows',
  windows: 'windows',
  darwin: 'macos',
  macos: 'macos',
  linux: 'linux',
  android: 'android',
  ios: 'ios',
};

export function mapPlatform(rawPlatform: string): FeedbackPlatform {
  const mapped = PLATFORM_MAP[rawPlatform.toLowerCase()];
  if (!mapped) {
    throw new DomainValidationError(`Unsupported feedback platform '${rawPlatform}'`);
  }
  return mapped;
}

export function collectFeedbackContext(
  appInfo: AppInfo,
  options: CollectContextOptions = {},
): FeedbackContext {
  return {
    appVersion: appInfo.version,
    platform: mapPlatform(appInfo.platform),
    osVersion: appInfo.osVersion,
    area: options.area,
    documentFormat: options.documentFormat,
    eventName: options.eventName,
    locale: options.locale,
  };
}
