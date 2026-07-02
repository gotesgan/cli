import {AbortError} from '@shopify/cli-kit/node/error'
import type {StoredStoreAppSession} from '@shopify/cli-kit/node/store-auth-session'

export const UNKNOWN_SCOPES_PLACEHOLDER = '<comma-separated-scopes>'

function storeAuthCommand(store: string, scopes: string): {command: string} {
  return {command: `shopify store auth --store ${store} --scopes ${scopes}`}
}

function storeAuthCommandNextStepsWithUnknownScopes(store: string) {
  return [[storeAuthCommand(store, UNKNOWN_SCOPES_PLACEHOLDER)]]
}

function storeAuthCommandNextStepsToReauthenticate(store: string, scopes: string) {
  return [['Run', storeAuthCommand(store, scopes), 'to re-authenticate']]
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
    storeAuthCommandNextStepsToReauthenticate(store, UNKNOWN_SCOPES_PLACEHOLDER),
  )
}

export function throwReauthenticateStoreAuthError(message: string, session: StoredStoreAppSession): never {
  throw new AbortError(
    message,
    undefined,
    storeAuthCommandNextStepsToReauthenticate(session.store, reauthScopesFor(session)),
  )
}

export function retryStoreAuthWithPermanentDomainError(returnedStore: string): AbortError {
  // eslint-disable-next-line @shopify/cli/no-error-factory-functions
  return new AbortError(
    'OAuth callback store does not match the requested store.',
    `Shopify returned ${returnedStore} during authentication. Re-run using the permanent store domain:`,
    storeAuthCommandNextStepsWithUnknownScopes(returnedStore),
  )
}
