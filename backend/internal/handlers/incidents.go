package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"meridian/internal/workers"
)

func IncidentsList(w http.ResponseWriter, r *http.Request) {
	uid := ""
	if id, ok := getUserID(r); ok {
		uid = "" // return all system incidents for now
		_ = id
	}
	incidents := workers.GetIncidents(uid)
	writeJSON(w, 200, map[string]interface{}{"incidents": incidents})
}

func IncidentGet(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	inc := workers.GetIncident(id)
	if inc == nil {
		writeError(w, 404, "Incident not found")
		return
	}
	writeJSON(w, 200, inc)
}

func IncidentAcknowledge(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		By string `json:"by"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if !workers.AcknowledgeIncident(id, req.By) {
		writeError(w, 404, "Incident not found")
		return
	}
	writeJSON(w, 200, map[string]string{"message": "Acknowledged"})
}

func IncidentSnooze(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Minutes int `json:"minutes"`
	}
	req.Minutes = 30
	json.NewDecoder(r.Body).Decode(&req)
	if !workers.SnoozeIncident(id, req.Minutes) {
		writeError(w, 404, "Incident not found")
		return
	}
	writeJSON(w, 200, map[string]string{"message": "Snoozed"})
}

func IncidentResolve(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Resolution string `json:"resolution_description"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if !workers.ResolveIncident(id, req.Resolution) {
		writeError(w, 404, "Incident not found")
		return
	}
	writeJSON(w, 200, map[string]string{"message": "Resolved"})
}
