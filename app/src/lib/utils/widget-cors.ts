import { NextRequest, NextResponse } from 'next/server'

/**
 * Get the request origin from headers.
 * Uses Origin header if present, otherwise falls back to request URL origin.
 */
export function getWidgetRequestOrigin(request: NextRequest): string {
  return request.headers.get('Origin') || request.nextUrl.origin
}

/**
 * Add CORS headers to an existing NextResponse.
 */
export function addWidgetCorsHeaders(
  response: NextResponse,
  origin: string,
  methods = 'GET, OPTIONS'
): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Methods', methods)
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}

/**
 * Create a CORS headers object for inline use (e.g. SSE streams, NextResponse.json options).
 */
export function createWidgetCorsHeaders(
  origin: string,
  methods = 'GET, OPTIONS'
): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

/**
 * Create a 204 OPTIONS response with CORS headers for preflight requests.
 */
export function createWidgetOptionsResponse(
  request: NextRequest,
  methods = 'GET, OPTIONS'
): NextResponse {
  const origin = getWidgetRequestOrigin(request)

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
