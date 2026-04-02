import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

function unauthorizedResponse() {
  return new NextResponse("Autorização necessária.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Admin Metrics"',
    },
  })
}

function decodeBasicAuth(authorizationHeader: string) {
  if (!authorizationHeader.startsWith("Basic ")) {
    return null
  }

  const encoded = authorizationHeader.slice("Basic ".length)

  try {
    const decoded = atob(encoded)
    const separatorIndex = decoded.indexOf(":")

    if (separatorIndex < 0) {
      return null
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    }
  } catch {
    return null
  }
}

export function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next()
  }

  const expectedUsername = process.env.ADMIN_METRICS_USERNAME
  const expectedPassword = process.env.ADMIN_METRICS_PASSWORD

  if (!expectedUsername || !expectedPassword) {
    return new NextResponse(
      "As variáveis ADMIN_METRICS_USERNAME e ADMIN_METRICS_PASSWORD precisam estar configuradas em .env.local na raiz do projeto.",
      { status: 500 }
    )
  }

  const authorizationHeader = request.headers.get("authorization")
  if (!authorizationHeader) {
    return unauthorizedResponse()
  }

  const credentials = decodeBasicAuth(authorizationHeader)
  if (!credentials) {
    return unauthorizedResponse()
  }

  if (
    credentials.username !== expectedUsername ||
    credentials.password !== expectedPassword
  ) {
    return unauthorizedResponse()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}
