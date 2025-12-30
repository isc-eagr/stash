package models

import "context"

// BlobReader provides methods to get files by ID.
type BlobReader interface {
	EntryExists(ctx context.Context, checksum string) (bool, error)
}

// BlobStoreWriter provides methods to read, write, and delete blobs
type BlobStoreWriter interface {
	Read(ctx context.Context, checksum string) ([]byte, error)
	Write(ctx context.Context, data []byte) (string, error)
	Delete(ctx context.Context, checksum string) error
}
