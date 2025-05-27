/**
 * Frame API utilities for handling Farcaster frame requests
 * Since we're using Vite (not Next.js), we'll handle frame requests client-side
 */

export interface FrameRequest {
  untrustedData: {
    fid: number;
    url: string;
    messageHash: string;
    timestamp: number;
    network: number;
    buttonIndex: number;
    inputText?: string;
    castId?: {
      fid: number;
      hash: string;
    };
  };
  trustedData: {
    messageBytes: string;
  };
}

export interface FrameResponse {
  image: string;
  buttons?: Array<{
    label: string;
    action?: 'post' | 'post_redirect' | 'link' | 'mint' | 'tx';
    target?: string;
  }>;
  input?: {
    text: string;
  };
  postUrl?: string;
  state?: string;
}

/**
 * Generate frame metadata for HTML head
 */
export function generateFrameMetadata(frame: FrameResponse): Record<string, string> {
  const metadata: Record<string, string> = {
    'fc:frame': 'vNext',
    'fc:frame:image': frame.image,
  };

  if (frame.buttons) {
    frame.buttons.forEach((button, index) => {
      metadata[`fc:frame:button:${index + 1}`] = button.label;
      if (button.action) {
        metadata[`fc:frame:button:${index + 1}:action`] = button.action;
      }
      if (button.target) {
        metadata[`fc:frame:button:${index + 1}:target`] = button.target;
      }
    });
  }

  if (frame.input) {
    metadata['fc:frame:input:text'] = frame.input.text;
  }

  if (frame.postUrl) {
    metadata['fc:frame:post_url'] = frame.postUrl;
  }

  if (frame.state) {
    metadata['fc:frame:state'] = frame.state;
  }

  return metadata;
}

/**
 * Create frame proxy handler for client-side frame requests
 */
export async function handleFrameRequest(
  url: string,
  method: 'GET' | 'POST' = 'GET',
  body?: FrameRequest
): Promise<Response> {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'farcaster-frames-client',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    return response;
  } catch (error) {
    console.error('Frame request failed:', error);
    throw error;
  }
}

/**
 * Validate frame request signature (simplified for client-side)
 */
export function validateFrameRequest(request: FrameRequest): boolean {
  // In a real implementation, you would validate the signature
  // For now, we'll do basic validation
  return !!(
    request.untrustedData &&
    request.untrustedData.fid &&
    request.untrustedData.timestamp &&
    request.trustedData &&
    request.trustedData.messageBytes
  );
}

/**
 * Create a frame image URL with proper encoding
 */
export function createFrameImageUrl(baseUrl: string, params: Record<string, string>): string {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

/**
 * Generate frame state for maintaining context between interactions
 */
export function generateFrameState(data: Record<string, any>): string {
  return btoa(JSON.stringify(data));
}

/**
 * Parse frame state from encoded string
 */
export function parseFrameState(state: string): Record<string, any> {
  try {
    return JSON.parse(atob(state));
  } catch {
    return {};
  }
}
