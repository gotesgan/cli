import {AbortError} from '@shopify/cli-kit/node/error'

function storeAuthCommand(store: string, scopes: string): {command: string} {
  return {command: `shopify store auth --store ${store} --scopes ${scopes}`}
}

function storeAuthCommandNextSteps(store: string, scopes: string) {
  return [[storeAuthCommand(store, scopes)]]
}

function storeAuthCommandNextStepsToReauthenticate(store: string, scopes: string) {
  return [['Run', storeAuthCommand(store, scopes), 'to re-authenticate']]
}

export function throwStoredStoreAuthError(store: string): never {
  throw new AbortError(
    `No stored app authentication found for ${store}.`,
    undefined,
    storeAuthCommandNextStepsToReauthenticate(store, '<comma-separated-scopes>'),
  )
}

export function throwReauthenticateStoreAuthError(message: string, store: string, scopes: string): never {
  throw new AbortError(message, undefined, storeAuthCommandNextStepsToReauthenticate(store, scopes))
}

export function retryStoreAuthWithPermanentDomainError(returnedStore: string): AbortError {
  // eslint-disable-next-line @shopify/cli/no-error-factory-functions
  return new AbortError(
    'OAuth callback store does not match the requested store.',
    `Shopify returned ${returnedStore} during authentication. Re-run using the permanent store domain:`,
    storeAuthCommandNextSteps(returnedStore, '<comma-separated-scopes>'),
  )
}
