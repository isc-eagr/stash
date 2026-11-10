package models

import (
	"context"
	"testing"
)

func TestHistoryMutationCountOnlyContextCustom(t *testing.T) {
	ctx := context.Background()
	if HistoryMutationCountOnlyCustom(ctx) {
		t.Fatal("plain context unexpectedly enabled count-only history results")
	}

	ctx = WithHistoryMutationCountOnlyCustom(ctx)
	if !HistoryMutationCountOnlyCustom(ctx) {
		t.Fatal("count-only history result flag was not preserved")
	}

	SetHistoryMutationResultCountCustom(ctx, 42)
	if count := HistoryMutationResultCountCustom(ctx, 0); count != 42 {
		t.Fatalf("got count %d, want 42", count)
	}
}
