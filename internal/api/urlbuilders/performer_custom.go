package urlbuilders

// CUSTOM: URL builder for performer additional images.

import (
	"strconv"

	"github.com/stashapp/stash/pkg/models"
)

type PerformerImageURLBuilder struct {
	BaseURL          string
	PerformerImageID string
}

func NewPerformerImageURLBuilder(baseURL string, performerImage *models.PerformerImage) PerformerImageURLBuilder {
	return PerformerImageURLBuilder{
		BaseURL:          baseURL,
		PerformerImageID: strconv.Itoa(performerImage.ID),
	}
}

func (b PerformerImageURLBuilder) GetPerformerImageURL() string {
	return b.BaseURL + "/performer/image/" + b.PerformerImageID
}
