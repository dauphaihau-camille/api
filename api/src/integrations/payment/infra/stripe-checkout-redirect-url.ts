import type { PaymentConfig } from '~/platform/config/payment.config';

type BuildStripeCheckoutRedirectUrlInput = {
  paymentConfig: PaymentConfig;
  pathOrUrl: string;
  query: Record<string, string>;
  createInvalidUrlError?: () => Error;
};

const CHECKOUT_SESSION_ID_PLACEHOLDER = '{CHECKOUT_SESSION_ID}';
const ENCODED_CHECKOUT_SESSION_ID_PLACEHOLDER = '%7BCHECKOUT_SESSION_ID%7D';

export function buildStripeCheckoutRedirectUrl({
  paymentConfig,
  pathOrUrl,
  query,
  createInvalidUrlError = () => new Error('Stripe checkout redirect URL is invalid.'),
}: BuildStripeCheckoutRedirectUrlInput): string {
  const publicBaseUrl = requireConfig(
    paymentConfig.publicBaseUrl,
    'PAYMENT_PUBLIC_BASE_URL',
  );
  const parsedPublicBaseUrl = parseRequiredUrl(
    publicBaseUrl,
    createInvalidUrlError,
  );
  const redirectUrl = parseRedirectUrl({
    createInvalidUrlError,
    parsedPublicBaseUrl,
    pathOrUrl,
  });

  for (const [key, value] of Object.entries(query)) {
    redirectUrl.searchParams.set(key, value);
  }

  return redirectUrl
    .toString()
    .replace(
      ENCODED_CHECKOUT_SESSION_ID_PLACEHOLDER,
      CHECKOUT_SESSION_ID_PLACEHOLDER,
    );
}

// ---------- Private helpers ----------

function parseRedirectUrl({
  createInvalidUrlError,
  parsedPublicBaseUrl,
  pathOrUrl,
}: {
  createInvalidUrlError: () => Error;
  parsedPublicBaseUrl: URL;
  pathOrUrl: string;
}): URL {
  const parsedUrl = tryParseUrl(pathOrUrl);
  const redirectUrl = parsedUrl ?? new URL(
    pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`,
    parsedPublicBaseUrl,
  );

  if (redirectUrl.origin !== parsedPublicBaseUrl.origin) {
    throw createInvalidUrlError();
  }

  return redirectUrl;
}

function parseRequiredUrl(
  value: string,
  createInvalidUrlError: () => Error,
): URL {
  try {
    return new URL(value);
  }
  catch {
    throw createInvalidUrlError();
  }
}

function tryParseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  }
  catch {
    return undefined;
  }
}

function requireConfig(value: string | null | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required for Stripe checkout redirects.`);
  }

  return value;
}
