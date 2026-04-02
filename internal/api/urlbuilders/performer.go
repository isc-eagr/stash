package urlbuilders

import (
	"strconv"

	"github.com/stashapp/stash/pkg/models"
)

type PerformerURLBuilder struct {
	BaseURL     string
	PerformerID string
	UpdatedAt   string
}

func NewPerformerURLBuilder(baseURL string, performer *models.Performer) PerformerURLBuilder {
	return PerformerURLBuilder{
		BaseURL:     baseURL,
		PerformerID: strconv.Itoa(performer.ID),
		UpdatedAt:   strconv.FormatInt(performer.UpdatedAt.Unix(), 10),
	}
}

func (b PerformerURLBuilder) GetPerformerImageURL(hasImage bool) string {
	url := b.BaseURL + "/performer/" + b.PerformerID + "/image?t=" + b.UpdatedAt
	if !hasImage {
		url += "&default=true"
	}
	return url
}

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
