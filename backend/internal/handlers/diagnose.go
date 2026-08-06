package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"time"

	"meridian/internal/services"
)

type diagnoseSession struct {
	ID        string                   `json:"id"`
	ClusterID string                   `json:"cluster_id"`
	PodName   string                   `json:"pod_name"`
	Namespace string                   `json:"namespace"`
	Logs      string                   `json:"logs"`
	Events    []map[string]interface{} `json:"events"`
	Diagnosis map[string]interface{}   `json:"diagnosis"`
	Messages  []map[string]interface{} `json:"messages"`
	CreatedAt string                   `json:"created_at"`
}

var diagnoseSessions = map[string]*diagnoseSession{}

func DiagnoseStart(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PodName   string `json:"pod_name"`
		Namespace string `json:"namespace"`
		ClusterID string `json:"cluster_id"`
		Logs      string `json:"logs"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "Invalid request")
		return
	}

	id := genID()
	sess := &diagnoseSession{
		ID:        id,
		ClusterID: req.ClusterID,
		PodName:   req.PodName,
		Namespace: req.Namespace,
		Logs:      req.Logs,
		Events:    []map[string]interface{}{},
		Messages:  []map[string]interface{}{},
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	diagnoseSessions[id] = sess
	writeJSON(w, 201, map[string]interface{}{"session_id": id})
}

func DiagnoseAnalyze(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SessionID string `json:"session_id"`
		Logs      string `json:"logs"`
		Events    string `json:"events"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "Invalid request")
		return
	}

	sseHeaders(w)

	var buf bytes.Buffer
	err := services.AI.StreamDiagnose(r.Context(), &buf, req.Logs, req.Events)
	content := buf.String()
	if err != nil {
		sseWrite(w, map[string]interface{}{"error": err.Error(), "done": true})
		return
	}

	for i := 0; i < len(content); i += 64 {
		end := i + 64
		if end > len(content) {
			end = len(content)
		}
		sseWrite(w, map[string]interface{}{"chunk": content[i:end], "done": false})
	}
	sseWrite(w, map[string]interface{}{"done": true})
}

func DiagnoseChat(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SessionID string `json:"session_id"`
		Message   string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "Invalid request")
		return
	}

	sseHeaders(w)
	system := "You are a Staff SRE continuing an interactive incident investigation. Answer concisely and give exact commands."

	var buf bytes.Buffer
	err := services.AI.StreamGenerate(r.Context(), &buf, system, req.Message, 1024)
	content := buf.String()
	if err != nil {
		sseWrite(w, map[string]interface{}{"error": err.Error(), "done": true})
		return
	}
	for i := 0; i < len(content); i += 64 {
		end := i + 64
		if end > len(content) {
			end = len(content)
		}
		sseWrite(w, map[string]interface{}{"chunk": content[i:end], "done": false})
	}
	sseWrite(w, map[string]interface{}{"done": true})
}

func DiagnoseGetSession(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("session_id")
	if sess, ok := diagnoseSessions[id]; ok {
		writeJSON(w, 200, sess)
		return
	}
	writeError(w, 404, "Session not found")
}
