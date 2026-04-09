package urlbuilders

import (
	"fmt"
	"net/url"
	"strconv"
)

type SceneReleaseURLBuilder struct {
	BaseURL   string
	ReleaseID string
}

func NewSceneReleaseURLBuilder(baseURL string, releaseID int) SceneReleaseURLBuilder {
	return SceneReleaseURLBuilder{
		BaseURL:   baseURL,
		ReleaseID: strconv.Itoa(releaseID),
	}
}

func (b SceneReleaseURLBuilder) GetScreenshotURL() string {
	return b.BaseURL + "/scene-release/" + b.ReleaseID + "/screenshot"
}

func (b SceneReleaseURLBuilder) GetStreamURL(apiKey string) *url.URL {
	u, err := url.Parse(fmt.Sprintf("%s/scene-release/%s/stream", b.BaseURL, b.ReleaseID))
	if err != nil {
		panic(err)
	}

	if apiKey != "" {
		v := u.Query()
		v.Set("apikey", apiKey)
		u.RawQuery = v.Encode()
	}
	return u
}
