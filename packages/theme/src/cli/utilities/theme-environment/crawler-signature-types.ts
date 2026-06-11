export interface CrawlerSignatureHeaders {
  Signature: string
  'Signature-Input': string
  'Signature-Agent': string
}

export interface StorefrontCrawlerSignature {
  id: string
  name: string
  domainHost: string
  signature: string
  signatureInput: string
  signatureAgent: string
  expiresAt: string
}

export interface StorefrontCrawlerSignatureUserError {
  field?: string[] | null
  message: string
  code?: string | null
}

export interface StorefrontCrawlerSignaturesResponse {
  storefrontCrawlerSignatures?: {
    edges: {
      node: StorefrontCrawlerSignature
    }[]
  } | null
}

export interface StorefrontCrawlerSignatureGenerateResponse {
  storefrontCrawlerSignatureGenerate?:
    | (StorefrontCrawlerSignature & {
        userErrors: StorefrontCrawlerSignatureUserError[]
      })
    | null
}
