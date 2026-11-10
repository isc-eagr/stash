package models

import "context"

type historyMutationCountOnlyContextKeyCustom struct{}

type historyMutationCountOnlyStateCustom struct {
	count int
	set   bool
}

func WithHistoryMutationCountOnlyCustom(ctx context.Context) context.Context {
	return context.WithValue(ctx, historyMutationCountOnlyContextKeyCustom{}, &historyMutationCountOnlyStateCustom{})
}

func HistoryMutationCountOnlyCustom(ctx context.Context) bool {
	_, ok := ctx.Value(historyMutationCountOnlyContextKeyCustom{}).(*historyMutationCountOnlyStateCustom)
	return ok
}

func SetHistoryMutationResultCountCustom(ctx context.Context, count int) {
	if state, ok := ctx.Value(historyMutationCountOnlyContextKeyCustom{}).(*historyMutationCountOnlyStateCustom); ok {
		state.count = count
		state.set = true
	}
}

func HistoryMutationResultCountCustom(ctx context.Context, fallback int) int {
	if state, ok := ctx.Value(historyMutationCountOnlyContextKeyCustom{}).(*historyMutationCountOnlyStateCustom); ok && state.set {
		return state.count
	}
	return fallback
}
