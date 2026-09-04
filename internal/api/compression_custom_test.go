package api

import (
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCustomCompressMiddlewareIncludesGraphQLResponses(t *testing.T) {
	const body = "scene-stats-payload-"
	for _, contentType := range []string{
		"application/json",
		"application/graphql-response+json",
	} {
		t.Run(contentType, func(t *testing.T) {
			handler := customCompressMiddleware()(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", contentType)
				_, err := io.WriteString(w, strings.Repeat(body, 100))
				require.NoError(t, err)
			}))
			request := httptest.NewRequest(http.MethodPost, "/graphql", nil)
			request.Header.Set("Accept-Encoding", "gzip")
			response := httptest.NewRecorder()

			handler.ServeHTTP(response, request)

			require.Equal(t, "gzip", response.Header().Get("Content-Encoding"))
			reader, err := gzip.NewReader(response.Body)
			require.NoError(t, err)
			decompressed, err := io.ReadAll(reader)
			require.NoError(t, err)
			require.NoError(t, reader.Close())
			require.Equal(t, strings.Repeat(body, 100), string(decompressed))
		})
	}
}
