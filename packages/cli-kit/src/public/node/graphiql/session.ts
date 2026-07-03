import {GraphiQLAppContext, setupGraphiQLServer, TokenProvider} from './server.js'
import {AbortController, AbortSignal} from '../abort.js'
import {OutputMessage, outputContent, outputInfo, outputToken, outputWarn} from '../output.js'
import {openURL} from '../system.js'
import {getAvailableTCPPort} from '../tcp.js'
import {randomBytes} from 'crypto'
import {Writable} from 'stream'

export interface BuildGraphiQLUrlOptions {
  port: number
  key: string
  query?: string
  variables?: string
  apiVersion?: string
}

export interface RunGraphiQLSessionOptions {
  storeFqdn: string
  tokenProvider: TokenProvider
  key: string
  port?: number
  query?: string
  variables?: string
  apiVersion?: string
  appContext?: GraphiQLAppContext
  protectMutations?: boolean
  additionalReadyMessages?: OutputMessage[]
  abortSignal?: AbortSignal
  stdout?: Writable
}

/**
 * Generates a random key suitable for authenticating a single local GraphiQL session.
 *
 * @returns A 64-character hex string.
 */
export function generateRandomGraphiQLKey(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Builds the browser URL for a local GraphiQL session.
 *
 * @param options - The local port, key, and optional query string fields to prefill.
 * @returns The fully-qualified local GraphiQL URL.
 */
export function buildGraphiQLUrl(options: BuildGraphiQLUrlOptions): string {
  const url = new URL(`http://localhost:${options.port}/graphiql`)
  url.searchParams.set('key', options.key)
  if (options.query) url.searchParams.set('query', options.query)
  if (options.variables) url.searchParams.set('variables', options.variables)
  if (options.apiVersion) url.searchParams.set('api_version', options.apiVersion)
  return url.toString()
}

/**
 * Runs a local GraphiQL session until the user interrupts it or the supplied abort signal fires.
 *
 * @param options - The server, authentication, URL prefill, and output options for the session.
 */
export async function runGraphiQLSession(options: RunGraphiQLSessionOptions): Promise<void> {
  const port = await getAvailableTCPPort(options.port)
  const server = setupGraphiQLServer({
    stdout: options.stdout ?? process.stdout,
    port,
    storeFqdn: options.storeFqdn,
    tokenProvider: options.tokenProvider,
    key: options.key,
    appContext: options.appContext,
    protectMutations: options.protectMutations,
  })

  const url = buildGraphiQLUrl({
    port,
    key: options.key,
    query: options.query,
    variables: options.variables,
    apiVersion: options.apiVersion,
  })

  try {
    outputInfo(outputContent`GraphiQL is running at ${outputToken.link(url)}`)
    options.additionalReadyMessages?.forEach((message) => outputInfo(message))
    outputInfo('Press Ctrl+C to stop.')

    const opened = await openURL(url)
    if (!opened) {
      outputWarn('Browser did not open automatically. Open the URL above manually.')
    }

    await waitForGraphiQLAbort(options.abortSignal)
  } finally {
    server.close()
  }
}

/**
 * Resolves when the process receives SIGINT or when the supplied abort signal fires.
 *
 * @param externalSignal - Optional signal used by tests or callers to stop the session.
 */
export async function waitForGraphiQLAbort(externalSignal?: AbortSignal): Promise<void> {
  const controller = new AbortController()

  const onSigint = () => controller.abort()
  process.once('SIGINT', onSigint)

  try {
    await new Promise<void>((resolve) => {
      if (controller.signal.aborted || externalSignal?.aborted) {
        resolve()
        return
      }
      controller.signal.addEventListener('abort', () => resolve(), {once: true})
      externalSignal?.addEventListener('abort', () => controller.abort(), {once: true})
    })
  } finally {
    process.removeListener('SIGINT', onSigint)
  }
}
