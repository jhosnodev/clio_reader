import type { Feedback } from '@clio-reader/domain';

export interface FeedbackWireSubmission {
  readonly id: string;
  readonly installationId?: string | undefined;
  readonly reaction?: Feedback['reaction'];
  readonly category?: Feedback['category'];
  readonly message?: string | undefined;
  readonly context: Feedback['context'];
  readonly createdAt: string;
  readonly diagnosticsConsent: boolean;
  readonly followUpConsent: boolean;
}

export type TransportResult =
  | { readonly kind: 'accepted' }
  | { readonly kind: 'duplicate' }
  | { readonly kind: 'retryable'; readonly status?: number | undefined }
  | { readonly kind: 'permanent'; readonly status: number };

export interface FeedbackTransport {
  submit(submission: FeedbackWireSubmission): Promise<TransportResult>;
}

export function toWireSubmission(feedback: Feedback): FeedbackWireSubmission {
  return {
    id: feedback.id,
    installationId: feedback.installationId,
    reaction: feedback.reaction,
    category: feedback.category,
    message: feedback.message,
    context: feedback.context,
    createdAt: new Date(feedback.createdAt).toISOString(),
    diagnosticsConsent: feedback.diagnosticsConsent,
    followUpConsent: feedback.followUpConsent,
  };
}

export interface HttpTransportOptions {
  readonly endpoint: string;
  readonly fetchImpl?: typeof fetch;
}

export class HttpFeedbackTransport implements FeedbackTransport {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpTransportOptions) {
    this.endpoint = options.endpoint;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async submit(submission: FeedbackWireSubmission): Promise<TransportResult> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(submission),
      });
    } catch {
      return { kind: 'retryable' };
    }

    if (response.ok) {
      if (response.status === 201) return { kind: 'accepted' };
      return { kind: 'duplicate' };
    }

    if (response.status === 429 || response.status >= 500) {
      return { kind: 'retryable', status: response.status };
    }

    return { kind: 'permanent', status: response.status };
  }
}
