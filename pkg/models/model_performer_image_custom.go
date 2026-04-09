package models

import "context"

// PerformerImage represents an additional image for a performer
type PerformerImage struct {
	ID          int    `json:"id"`
	PerformerID int    `json:"performer_id"`
	ImageBlob   string `json:"image_blob"`
	Position    int    `json:"position"`
}

// PerformerImageGetter provides methods to get performer images
type PerformerImageGetter interface {
	Get(ctx context.Context, id int) (*PerformerImage, error)
}

// PerformerImageFinder provides methods to find performer images
type PerformerImageFinder interface {
	PerformerImageGetter
	GetByPerformerID(ctx context.Context, performerID int) ([]*PerformerImage, error)
}

// PerformerImageCreator provides methods to create performer images
type PerformerImageCreator interface {
	Create(ctx context.Context, performerID int, imageBlob string) (*PerformerImage, error)
}

// PerformerImageUpdater provides methods to update performer images
type PerformerImageUpdater interface {
	UpdateBlob(ctx context.Context, id int, imageBlob string) error
}

// PerformerImageDestroyer provides methods to destroy performer images
type PerformerImageDestroyer interface {
	Destroy(ctx context.Context, id int) error
}

// PerformerImageReader provides read methods for performer images
type PerformerImageReader interface {
	PerformerImageFinder
}

// PerformerImageWriter provides write methods for performer images
type PerformerImageWriter interface {
	PerformerImageCreator
	PerformerImageUpdater
	PerformerImageDestroyer
}

// PerformerImageReaderWriter provides read and write methods for performer images
type PerformerImageReaderWriter interface {
	PerformerImageReader
	PerformerImageWriter
}
