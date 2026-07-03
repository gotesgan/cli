import {buildGraphiQLUrl, generateRandomGraphiQLKey, runGraphiQLSession, waitForGraphiQLAbort} from './session.js'
import {setupGraphiQLServer} from './server.js'
import {AbortController} from '../abort.js'
import {openURL} from '../system.js'
import {getAvailableTCPPort} from '../tcp.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./server.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./server.js')>()
  return {
    ...original,
    setupGraphiQLServer: vi.fn(),
  }
})
vi.mock('../tcp.js')
vi.mock('../system.js')

const mockedSetupGraphiQLServer = vi.mocked(setupGraphiQLServer)
const mockedGetAvailableTCPPort = vi.mocked(getAvailableTCPPort)
const mockedOpenURL = vi.mocked(openURL)

function abortAfter(controller: AbortController) {
  setImmediate(() => controller.abort())
  return controller.signal
}

describe('buildGraphiQLUrl', () => {
  test('builds a keyed local GraphiQL URL with optional prefilled fields', () => {
    const url = buildGraphiQLUrl({
      port: 4567,
      key: 'key',
      query: 'query { shop { name } }',
      variables: '{"id":1}',
      apiVersion: '2024-10',
    })

    const parsed = new URL(url)
    expect(parsed.origin).toBe('http://localhost:4567')
    expect(parsed.pathname).toBe('/graphiql')
    expect(parsed.searchParams.get('key')).toBe('key')
    expect(parsed.searchParams.get('query')).toBe('query { shop { name } }')
    expect(parsed.searchParams.get('variables')).toBe('{"id":1}')
    expect(parsed.searchParams.get('api_version')).toBe('2024-10')
  })
})

describe('generateRandomGraphiQLKey', () => {
  test('generates a 64-character hexadecimal key', () => {
    expect(generateRandomGraphiQLKey()).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('runGraphiQLSession', () => {
  beforeEach(() => {
    mockedGetAvailableTCPPort.mockResolvedValue(4567)
    mockedOpenURL.mockResolvedValue(true)
    mockedSetupGraphiQLServer.mockReturnValue({close: vi.fn()} as unknown as ReturnType<typeof setupGraphiQLServer>)
  })

  test('starts the server, opens the keyed URL, waits for abort, and closes the server', async () => {
    const controller = new AbortController()
    const tokenProvider = {getToken: async () => 'token'}
    const server = {close: vi.fn()}
    mockedSetupGraphiQLServer.mockReturnValueOnce(server as unknown as ReturnType<typeof setupGraphiQLServer>)

    await runGraphiQLSession({
      storeFqdn: 'shop.myshopify.com',
      tokenProvider,
      key: 'key',
      port: 1234,
      query: 'query { shop { name } }',
      variables: '{"id":1}',
      apiVersion: '2024-10',
      protectMutations: true,
      appContext: {
        appName: 'Test App',
        appUrl: 'https://admin.shopify.com/store/shop/apps/api-key?dev-console=show',
        apiSecret: 'secret',
      },
      abortSignal: abortAfter(controller),
    })

    expect(mockedGetAvailableTCPPort).toHaveBeenCalledWith(1234)
    expect(mockedSetupGraphiQLServer).toHaveBeenCalledWith(
      expect.objectContaining({
        stdout: process.stdout,
        port: 4567,
        storeFqdn: 'shop.myshopify.com',
        tokenProvider,
        key: 'key',
        protectMutations: true,
        appContext: {
          appName: 'Test App',
          appUrl: 'https://admin.shopify.com/store/shop/apps/api-key?dev-console=show',
          apiSecret: 'secret',
        },
      }),
    )
    expect(mockedOpenURL).toHaveBeenCalledWith(
      'http://localhost:4567/graphiql?key=key&query=query+%7B+shop+%7B+name+%7D+%7D&variables=%7B%22id%22%3A1%7D&api_version=2024-10',
    )
    expect(server.close).toHaveBeenCalled()
  })

  test('closes the server when opening the browser fails', async () => {
    const server = {close: vi.fn()}
    mockedSetupGraphiQLServer.mockReturnValueOnce(server as unknown as ReturnType<typeof setupGraphiQLServer>)
    mockedOpenURL.mockRejectedValueOnce(new Error('failed to open'))

    await expect(
      runGraphiQLSession({
        storeFqdn: 'shop.myshopify.com',
        tokenProvider: {getToken: async () => 'token'},
        key: 'key',
      }),
    ).rejects.toThrow('failed to open')
    expect(server.close).toHaveBeenCalled()
  })
})

describe('waitForGraphiQLAbort', () => {
  test('resolves immediately when the external signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(waitForGraphiQLAbort(controller.signal)).resolves.toBeUndefined()
  })
})
