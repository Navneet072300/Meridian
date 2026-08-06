package services

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
	"meridian/internal/config"
)

var Redis *redis.Client

const (
	TTLHealth     = 30 * time.Second
	TTLPods       = 15 * time.Second
	TTLNamespaces = 60 * time.Second
	TTLNodes      = 30 * time.Second
	TTLOverview   = 20 * time.Second
)

func InitRedis(ctx context.Context) error {
	opt, err := redis.ParseURL(config.RedisURL)
	if err != nil {
		log.Printf("Redis URL parse error: %v", err)
		return err
	}
	Redis = redis.NewClient(opt)
	if err := Redis.Ping(ctx).Err(); err != nil {
		log.Printf("Redis ping failed: %v", err)
		Redis = nil
		return err
	}
	log.Println("Redis connected")
	return nil
}

func CacheGet(ctx context.Context, key string, dest interface{}) bool {
	if Redis == nil {
		return false
	}
	val, err := Redis.Get(ctx, key).Result()
	if err != nil {
		return false
	}
	return json.Unmarshal([]byte(val), dest) == nil
}

func CacheSet(ctx context.Context, key string, value interface{}, ttl time.Duration) {
	if Redis == nil {
		return
	}
	data, err := json.Marshal(value)
	if err != nil {
		return
	}
	Redis.Set(ctx, key, data, ttl)
}

func CacheDelete(ctx context.Context, pattern string) {
	if Redis == nil {
		return
	}
	keys, err := Redis.Keys(ctx, pattern).Result()
	if err != nil || len(keys) == 0 {
		return
	}
	Redis.Del(ctx, keys...)
}
