package main

import (
	"io"
	"log"
	"net/http"
)

func catalogHandler(mockAPIURL string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resp, err := http.Get(mockAPIURL + "/catalog")
		if err != nil {
			log.Printf("[catalog] error fetching from mock-api: %v", err)
			http.Error(w, `{"error":"catalog unavailable"}`, http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			http.Error(w, `{"error":"read error"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write(body)
	}
}
