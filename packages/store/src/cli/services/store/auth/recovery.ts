import {AbortError} from '@shopify/cli-kit/node/error'
import type {StoredStoreAppSession} from '@shopify/cli-kit/node/store-auth-session'

const UNKNOWN_SCOPES_PLACEHOLDER = '<comma-separated-scopes>'

function storeAuthCommand(store: string, scopes: string): {command: string} {
  return {command: `shopify store auth --store ${store} --scopes ${scopes}`}
}

function storeAuthCommandNextStepsWithUnknownScopes(store: string) {
  return [[storeAuthCommand(store, UNKNOWN_SCOPES_PLACEHOLDER)]]
}

function storeAuthCommandNextStepsWithPurpose(store: string, scopes: string, purpose: string) {
  return [['Run', storeAuthCommand(store, scopes), purpose]]
}

// Preview-store sessions are preapproved for a large, fixed scope catalog (often 30+ scopes).
// Suggesting the user re-request all of them encourages over-scoping, so they get the same
// placeholder as the "no stored auth" case and choose deliberately instead.
function reauthScopesFor(session: StoredStoreAppSession): string {
  return session.kind === 'preview' ? UNKNOWN_SCOPES_PLACEHOLDER : session.scopes.join(',')
}

export function throwStoredStoreAuthError(store: string): never {
  throw new AbortError(
    `No stored app authentication found for ${store}.`,
    undefined,
    storeAuthCommandNextStepsWithPurpose(store, UNKNOWN_SCOPES_PLACEHOLDER, 'to authenticate'),
  )
}

export function throwReauthenticateStoreAuthError(message: string, session: StoredStoreAppSession): never {
  throw new AbortError(
    message,
    undefined,
    storeAuthCommandNextStepsWithPurpose(session.store, reauthScopesFor(session), 'to re-authenticate'),
  )
}

// A preview store's local session has no way to know it was claimed through the browser claim
// flow; a 401/404 the first time the stale session is used again is the only signal. Surfacing
// that possibility is more useful than the generic "no longer valid" message a standard session
// gets, so every call site that detects an invalid stored session (regardless of which API it
// hit) should go through here instead of writing its own message.
export function throwStoredAuthInvalidError(session: StoredStoreAppSession): never {
  const message =
    session.kind === 'preview'
      ? `The preview store ${session.store} has likely been claimed, so its stored authentication is no longer valid.`
      : `Stored app authentication for ${session.store} is no longer valid.`

  throwReauthenticateStoreAuthError(message, session)
}

export function retryStoreAuthWithPermanentDomainError(returnedStore: string): AbortError {
  // eslint-disable-next-line @shopify/cli/no-error-factory-functions
  return new AbortError(
    'OAuth callback store does not match the requested store.',
    `Shopify returned ${returnedStore} during authentication. Re-run using the permanent store domain:`,
    storeAuthCommandNextStepsWithUnknownScopes(returnedStore),
  )
}
