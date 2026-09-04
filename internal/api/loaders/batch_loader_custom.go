package loaders

import (
	"sync"
	"time"
)

// BatchLoaderCustom is a small request-scoped batching cache used for custom
// relationships that are not covered by the generated dataloaders.
type BatchLoaderCustom[K comparable, V any] struct {
	fetch    func([]K) ([]V, []error)
	wait     time.Duration
	maxBatch int

	mu    sync.Mutex
	cache map[K]V
	batch *batchLoaderBatchCustom[K, V]
}

type batchLoaderBatchCustom[K comparable, V any] struct {
	keys    []K
	data    []V
	errors  []error
	closing bool
	done    chan struct{}
}

func newBatchLoaderCustom[K comparable, V any](
	fetch func([]K) ([]V, []error),
	wait time.Duration,
	maxBatch int,
) *BatchLoaderCustom[K, V] {
	return &BatchLoaderCustom[K, V]{
		fetch:    fetch,
		wait:     wait,
		maxBatch: maxBatch,
	}
}

// Load returns one value while coalescing concurrent misses into one fetch.
func (l *BatchLoaderCustom[K, V]) Load(key K) (V, error) {
	return l.LoadThunk(key)()
}

// LoadThunk queues a key and returns a function that waits for its batch.
func (l *BatchLoaderCustom[K, V]) LoadThunk(key K) func() (V, error) {
	l.mu.Lock()
	if value, ok := l.cache[key]; ok {
		l.mu.Unlock()
		return func() (V, error) { return value, nil }
	}

	if l.batch == nil {
		l.batch = &batchLoaderBatchCustom[K, V]{done: make(chan struct{})}
	}
	batch := l.batch
	position := batch.keyIndex(l, key)
	l.mu.Unlock()

	return func() (V, error) {
		<-batch.done

		var value V
		if position < len(batch.data) {
			value = batch.data[position]
		}

		var err error
		if len(batch.errors) == 1 {
			err = batch.errors[0]
		} else if position < len(batch.errors) {
			err = batch.errors[position]
		}
		if err == nil {
			l.mu.Lock()
			if l.cache == nil {
				l.cache = make(map[K]V)
			}
			l.cache[key] = value
			l.mu.Unlock()
		}

		return value, err
	}
}

func (b *batchLoaderBatchCustom[K, V]) keyIndex(l *BatchLoaderCustom[K, V], key K) int {
	for i, existingKey := range b.keys {
		if existingKey == key {
			return i
		}
	}

	position := len(b.keys)
	b.keys = append(b.keys, key)
	if position == 0 {
		go b.startTimer(l)
	}
	if l.maxBatch != 0 && position >= l.maxBatch-1 && !b.closing {
		b.closing = true
		l.batch = nil
		go b.end(l)
	}

	return position
}

func (b *batchLoaderBatchCustom[K, V]) startTimer(l *BatchLoaderCustom[K, V]) {
	time.Sleep(l.wait)
	l.mu.Lock()
	if b.closing {
		l.mu.Unlock()
		return
	}
	b.closing = true
	l.batch = nil
	l.mu.Unlock()
	b.end(l)
}

func (b *batchLoaderBatchCustom[K, V]) end(l *BatchLoaderCustom[K, V]) {
	b.data, b.errors = l.fetch(b.keys)
	close(b.done)
}
