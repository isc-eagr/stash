package stashbox

// CUSTOM: StashDB Matches counts the users who matched a scene on stashdb.org.

import (
	"context"
	"fmt"
	"net/url"
	"reflect"
	"strings"

	"github.com/stashapp/stash/pkg/stashbox/graphql"
)

func IsStashDBEndpointCustom(endpoint string) bool {
	u, err := url.Parse(strings.TrimSpace(endpoint))
	if err != nil {
		return false
	}
	host := strings.ToLower(u.Hostname())
	return host == "stashdb.org" || strings.HasSuffix(host, ".stashdb.org")
}

// Each user submits a scene's PHASH once, so summed PHASH submissions
// approximate how many users matched it.
func phashSubmissionsCustom(fingerprints []*graphql.FingerprintFragment) int {
	total := 0
	for _, fp := range fingerprints {
		if fp != nil && fp.Algorithm == graphql.FingerprintAlgorithmPhash {
			total += fp.Submissions
		}
	}
	return total
}

// Other stash-box instances return nil.
func stashDBMatchesCustom(endpoint string, fingerprints []*graphql.FingerprintFragment) *int {
	if !IsStashDBEndpointCustom(endpoint) {
		return nil
	}
	total := phashSubmissionsCustom(fingerprints)
	return &total
}

type stashDBMatchSceneCustom struct {
	Deleted      bool
	Fingerprints []*stashDBMatchFingerprintCustom
}

type stashDBMatchFingerprintCustom struct {
	Algorithm     graphql.FingerprintAlgorithm
	Submissions   int
	UserSubmitted bool `json:"user_submitted" graphql:"user_submitted"`
}

// StashDBMatchCustom includes the authenticated account's PHASH submission
// status, independently of how many users submitted the scene's fingerprints.
type StashDBMatchCustom struct {
	Matches   int
	Submitted bool
}

// FindStashDBMatchesCustom looks up several scenes in one request with aliased
// findScene queries that select counts and the current user's submissions. The result is
// keyed by stash ID; missing and deleted scenes are omitted.
func (c Client) FindStashDBMatchesCustom(ctx context.Context, stashIDs []string) (map[string]StashDBMatchCustom, error) {
	ret := make(map[string]StashDBMatchCustom, len(stashIDs))
	if len(stashIDs) == 0 {
		return ret, nil
	}

	params := make([]string, len(stashIDs))
	selections := make([]string, len(stashIDs))
	vars := make(map[string]any, len(stashIDs))
	// The GraphQL decoder fills structs only, so aliases sN map to fields SN.
	fields := make([]reflect.StructField, len(stashIDs))
	for i, id := range stashIDs {
		alias := fmt.Sprintf("s%d", i)
		params[i] = fmt.Sprintf("$%s: ID!", alias)
		selections[i] = fmt.Sprintf("%s: findScene(id: $%s) { deleted fingerprints { algorithm submissions user_submitted } }", alias, alias)
		vars[alias] = id
		fields[i] = reflect.StructField{
			Name: fmt.Sprintf("S%d", i),
			Type: reflect.TypeOf((*stashDBMatchSceneCustom)(nil)),
		}
	}
	query := fmt.Sprintf("query StashDBMatches(%s) { %s }", strings.Join(params, ", "), strings.Join(selections, " "))

	res := reflect.New(reflect.StructOf(fields))
	if err := c.client.Client.Post(ctx, "StashDBMatches", query, res.Interface(), vars); err != nil {
		return nil, err
	}

	for i, id := range stashIDs {
		scene, _ := res.Elem().Field(i).Interface().(*stashDBMatchSceneCustom)
		if scene == nil || scene.Deleted {
			continue
		}
		var match StashDBMatchCustom
		for _, fp := range scene.Fingerprints {
			if fp != nil && fp.Algorithm == graphql.FingerprintAlgorithmPhash {
				match.Matches += fp.Submissions
				match.Submitted = match.Submitted || fp.UserSubmitted
			}
		}
		ret[id] = match
	}
	return ret, nil
}
