package handlers

import (
	"net/http"

	"meridian/internal/services"
)

func MonitoringOverview(w http.ResponseWriter, r *http.Request) {
	clusterName := r.URL.Query().Get("cluster")
	cacheKey := "mon:overview:" + orStr(clusterName, "active")

	var cached map[string]interface{}
	if services.CacheGet(r.Context(), cacheKey, &cached) {
		writeJSON(w, 200, cached)
		return
	}

	svc, err := getK8sService(r)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"configured": false, "error": err.Error()})
		return
	}

	result, err := svc.GetOverview(r.Context())
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"configured": false, "error": err.Error()})
		return
	}

	services.CacheSet(r.Context(), cacheKey, result, services.TTLOverview)
	writeJSON(w, 200, result)
}

func MonitoringMetrics(w http.ResponseWriter, r *http.Request) {
	svc, err := getK8sService(r)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"metrics": []interface{}{}, "error": err.Error()})
		return
	}
	metrics, err := svc.GetNodeMetrics(r.Context())
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"metrics": []interface{}{}, "error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]interface{}{"metrics": metrics})
}
