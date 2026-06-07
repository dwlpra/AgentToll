package payments

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"
)

type WebhookPayload struct {
	TaskID   string `json:"taskId"`
	Status   string `json:"status"`
	Wallet   string `json:"wallet"`
	Resource string `json:"resource"`
	Amount   string `json:"amount"`
	Asset    string `json:"asset"`
	TxHash   string `json:"txHash"`
}

func WebhookHandler(store *Store, cfg X402Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		var payload WebhookPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
			return
		}

		log.Printf("[webhook] received: taskId=%s status=%s wallet=%s resource=%s amount=%s",
			payload.TaskID, payload.Status, payload.Wallet, payload.Resource, payload.Amount)

		if payload.Status == "confirmed" || payload.Status == "success" {
			expectedUnits, _, ok := cfg.GetPriceForPath(payload.Resource)
			if ok && payload.Amount != "" && payload.Amount != expectedUnits {
				log.Printf("[webhook] REJECTED: amount mismatch for %s: got %s, expected %s",
					payload.Resource, payload.Amount, expectedUnits)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]string{
					"status": "rejected",
					"taskId": payload.TaskID,
					"error":  "amount mismatch",
				})
				return
			}

			store.Authorize(payload.Wallet, payload.Resource, 5*time.Minute)
			log.Printf("[webhook] authorized: wallet=%s resource=%s for 5min", payload.Wallet, payload.Resource)

			// Record purchase for provider dashboard
			amountUSD := "0.00"
			if units, err := strconv.ParseFloat(payload.Amount, 64); err == nil {
				amountUSD = fmt.Sprintf("%.2f", units/1e6)
			}
			store.RecordPurchase(Purchase{
				TaskID:    payload.TaskID,
				Wallet:    payload.Wallet,
				Resource:  payload.Resource,
				Amount:    payload.Amount,
				AmountUSD: amountUSD,
				TxHash:    payload.TxHash,
				Asset:     payload.Asset,
				Timestamp: time.Now(),
			})
			log.Printf("[webhook] purchase recorded: %s $%s txHash=%s",
				payload.Resource, amountUSD, payload.TxHash)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "ok",
			"taskId": payload.TaskID,
			"action": "authorized",
		})
	}
}
