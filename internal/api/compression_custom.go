package api

import (
	"net/http"

	"github.com/go-chi/chi/v5/middleware"
)

// customCompressMiddleware preserves chi's default compressible content types
// and adds the GraphQL-over-HTTP response type emitted by gqlgen.
func customCompressMiddleware() func(http.Handler) http.Handler {
	return middleware.Compress(4,
		"text/html",
		"text/css",
		"text/plain",
		"text/javascript",
		"application/javascript",
		"application/x-javascript",
		"application/json",
		"application/graphql-response+json",
		"application/atom+xml",
		"application/rss+xml",
		"image/svg+xml",
	)
}
