package proxy

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
)

func NewProxy(target string, secret string) http.Handler {
	targetURL, err := url.Parse(target)
	if err != nil {
		log.Fatalf("invalid mock-api URL: %v", err)
	}

	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	originalDirector := proxy.Director

	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Header.Set("X-Gateway-Secret", secret)
		req.Host = targetURL.Host
		log.Printf("[proxy] %s %s -> %s", req.Method, req.URL.Path, targetURL.String()+req.URL.Path)
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("[proxy] error: %v", err)
		http.Error(w, `{"error":"upstream unavailable"}`, http.StatusBadGateway)
	}

	return proxy
}
