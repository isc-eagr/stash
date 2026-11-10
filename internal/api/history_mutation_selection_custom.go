package api

import (
	"context"

	"github.com/99designs/gqlgen/graphql"
	"github.com/stashapp/stash/pkg/models"
)

func historyMutationContextCustom(ctx context.Context) context.Context {
	if !graphql.HasOperationContext(ctx) || graphql.GetFieldContext(ctx) == nil {
		return ctx
	}

	for _, field := range graphql.CollectAllFields(ctx) {
		if field == "history" {
			return ctx
		}
	}

	return models.WithHistoryMutationCountOnlyCustom(ctx)
}
