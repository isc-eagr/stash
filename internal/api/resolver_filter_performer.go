package api

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
)

// Roles is a no-op resolver for the PerformerFilterType input type.
// This is required because roles is a custom directive on an input type field.
func (r *performerFilterTypeResolver) Roles(ctx context.Context, obj *models.PerformerFilterType, data *PerformerRolesCriterionInput) error {
	// No-op: PerformerFilterType is an input type and doesn't require runtime resolution.
	// The data is already bound to the input by GraphQL.
	return nil
}
