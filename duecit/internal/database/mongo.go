package database

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func ConnectMongo(ctx context.Context, uri, dbName string) (*mongo.Database, error) {
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx, nil); err != nil {
		return nil, err
	}
	// Deliberately loud: which database an env-var typo/omission connects to
	// should never be silent. If this ever prints "duel_db" and you didn't
	// explicitly set MONGO_DB to that, config.go's fallback is firing -
	// meaning MONGO_DB isn't set the way you think it is on Render. Compare
	// this against the database name you see holding your custom problems
	// in the Atlas UI.
	log.Printf("MongoDB connected: database=%q", dbName)
	return client.Database(dbName), nil
}