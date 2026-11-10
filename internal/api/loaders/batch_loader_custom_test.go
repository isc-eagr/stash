package loaders

import (
	"reflect"
	"sync"
	"testing"
	"time"
)

func TestBatchLoaderCustomBatchesAndCaches(t *testing.T) {
	var mu sync.Mutex
	var calls [][]int
	loader := newBatchLoaderCustom(func(keys []int) ([]string, []error) {
		mu.Lock()
		calls = append(calls, append([]int(nil), keys...))
		mu.Unlock()

		values := make([]string, len(keys))
		for i, key := range keys {
			values[i] = string(rune('a' + key))
		}
		return values, nil
	}, time.Millisecond, 100)

	first := loader.LoadThunk(1)
	second := loader.LoadThunk(2)
	duplicate := loader.LoadThunk(1)

	if value, err := first(); err != nil || value != "b" {
		t.Fatalf("first value = %q, %v; want b, nil", value, err)
	}
	if value, err := second(); err != nil || value != "c" {
		t.Fatalf("second value = %q, %v; want c, nil", value, err)
	}
	if value, err := duplicate(); err != nil || value != "b" {
		t.Fatalf("duplicate value = %q, %v; want b, nil", value, err)
	}
	if value, err := loader.Load(1); err != nil || value != "b" {
		t.Fatalf("cached value = %q, %v; want b, nil", value, err)
	}

	mu.Lock()
	defer mu.Unlock()
	if !reflect.DeepEqual(calls, [][]int{{1, 2}}) {
		t.Fatalf("fetch calls = %#v; want one batched call", calls)
	}
}
