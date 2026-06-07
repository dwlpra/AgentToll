package main

import (
	"encoding/json"
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

func mergeCatalogWithPrices(catalogJSON []byte, prices map[string]PriceInfo) []byte {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(catalogJSON, &raw); err != nil {
		return catalogJSON
	}

	var entries []map[string]interface{}
	if err := json.Unmarshal(raw["catalog"], &entries); err != nil {
		return catalogJSON
	}

	for i := range entries {
		path, _ := entries[i]["path"].(string)
		if p, ok := prices[path]; ok {
			entries[i]["gatewayPriceUSD"] = p.USD
			entries[i]["gatewayPriceUnits"] = p.Units
		}
	}

	merged, _ := json.Marshal(map[string]interface{}{
		"catalog":    entries,
		"totalCount": len(entries),
	})
	return merged
}

type PriceInfo struct {
	USD   float64
	Units string
}
