package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"meridian/internal/config"
	"meridian/internal/services"
)

func getK8sService(r *http.Request) (*services.K8sService, error) {
	clusterName := r.URL.Query().Get("cluster")
	var cluster *config.ClusterConfig
	if clusterName != "" {
		cluster = config.GetCluster(clusterName)
	} else {
		cluster = config.GetActiveCluster()
	}
	if cluster == nil {
		return nil, fmt.Errorf("cluster not configured")
	}
	return services.NewK8sService(cluster.APIURL, cluster.Token, cluster.Kubeconfig)
}

func K8sHealth(w http.ResponseWriter, r *http.Request) {
	clusterName := r.URL.Query().Get("cluster")
	if config.GetActiveCluster() == nil {
		writeJSON(w, 200, map[string]interface{}{"healthy": false, "configured": false, "cluster_name": "none"})
		return
	}

	cacheKey := "health:" + orStr(clusterName, "active")
	var cached map[string]interface{}
	if services.CacheGet(r.Context(), cacheKey, &cached) {
		writeJSON(w, 200, cached)
		return
	}

	svc, err := getK8sService(r)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"healthy": false, "error": err.Error()})
		return
	}
	result := svc.Health(r.Context())
	services.CacheSet(r.Context(), cacheKey, result, services.TTLHealth)
	writeJSON(w, 200, result)
}

func K8sClusters(w http.ResponseWriter, r *http.Request) {
	cfg := config.LoadPlatformConfig()
	clusters := make([]map[string]interface{}, 0, len(cfg.Clusters))
	for _, c := range cfg.Clusters {
		clusters = append(clusters, map[string]interface{}{
			"name":        c.Name,
			"environment": c.Environment,
			"active":      c.Active,
		})
	}
	writeJSON(w, 200, map[string]interface{}{"clusters": clusters})
}

func K8sNamespaces(w http.ResponseWriter, r *http.Request) {
	if config.GetActiveCluster() == nil {
		writeJSON(w, 200, map[string]interface{}{"namespaces": []string{"default"}})
		return
	}
	clusterName := r.URL.Query().Get("cluster")
	cacheKey := "ns:" + orStr(clusterName, "active")

	var cached map[string]interface{}
	if services.CacheGet(r.Context(), cacheKey, &cached) {
		writeJSON(w, 200, cached)
		return
	}

	svc, err := getK8sService(r)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"namespaces": []string{"default"}, "error": err.Error()})
		return
	}
	ns, err := svc.GetNamespaces(r.Context())
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"namespaces": []string{"default"}, "error": err.Error()})
		return
	}
	result := map[string]interface{}{"namespaces": ns}
	services.CacheSet(r.Context(), cacheKey, result, services.TTLNamespaces)
	writeJSON(w, 200, result)
}

func K8sPods(w http.ResponseWriter, r *http.Request) {
	ns := r.URL.Query().Get("namespace")
	if ns == "" {
		ns = "default"
	}
	clusterName := r.URL.Query().Get("cluster")
	cacheKey := "pods:" + orStr(clusterName, "active") + ":" + ns

	var cached map[string]interface{}
	if services.CacheGet(r.Context(), cacheKey, &cached) {
		writeJSON(w, 200, cached)
		return
	}

	svc, err := getK8sService(r)
	if err != nil {
		writeError(w, 404, "Cluster not configured")
		return
	}
	pods, err := svc.GetPods(r.Context(), ns)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	result := map[string]interface{}{"pods": pods, "namespace": ns}
	services.CacheSet(r.Context(), cacheKey, result, services.TTLPods)
	writeJSON(w, 200, result)
}

func K8sPodLogs(w http.ResponseWriter, r *http.Request) {
	pod := r.URL.Query().Get("pod")
	ns := r.URL.Query().Get("namespace")
	if ns == "" {
		ns = "default"
	}
	lines := 200
	if l := r.URL.Query().Get("lines"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			lines = n
		}
	}

	svc, err := getK8sService(r)
	if err != nil {
		writeError(w, 404, "Cluster not configured")
		return
	}
	logs, err := svc.GetPodLogs(r.Context(), ns, pod, lines)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"logs": logs, "pod": pod})
}

func K8sPodEvents(w http.ResponseWriter, r *http.Request) {
	pod := r.URL.Query().Get("pod")
	ns := r.URL.Query().Get("namespace")
	if ns == "" {
		ns = "default"
	}

	svc, err := getK8sService(r)
	if err != nil {
		writeError(w, 404, "Cluster not configured")
		return
	}
	events, err := svc.GetPodEvents(r.Context(), ns, pod)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"events": events, "pod": pod})
}

func K8sNodes(w http.ResponseWriter, r *http.Request) {
	clusterName := r.URL.Query().Get("cluster")
	cacheKey := "nodes:" + orStr(clusterName, "active")

	var cached map[string]interface{}
	if services.CacheGet(r.Context(), cacheKey, &cached) {
		writeJSON(w, 200, cached)
		return
	}

	svc, err := getK8sService(r)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"nodes": []interface{}{}, "error": err.Error()})
		return
	}
	nodes, err := svc.GetNodes(r.Context())
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"nodes": []interface{}{}, "error": err.Error()})
		return
	}
	result := map[string]interface{}{"nodes": nodes}
	services.CacheSet(r.Context(), cacheKey, result, services.TTLNodes)
	writeJSON(w, 200, result)
}

func K8sEvents(w http.ResponseWriter, r *http.Request) {
	ns := r.URL.Query().Get("namespace")
	if ns == "" {
		ns = "default"
	}
	svc, err := getK8sService(r)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"events": []interface{}{}, "error": err.Error()})
		return
	}
	events, err := svc.GetEvents(r.Context(), ns)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"events": []interface{}{}, "error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]interface{}{"events": events, "namespace": ns})
}

func K8sOverview(w http.ResponseWriter, r *http.Request) {
	if config.GetActiveCluster() == nil {
		writeJSON(w, 200, map[string]interface{}{
			"configured": false, "cluster_name": "none",
			"nodes": []interface{}{},
			"pod_counts": map[string]int{"running": 0, "pending": 0, "failed": 0, "total": 0},
			"warning_events": []interface{}{},
		})
		return
	}

	clusterName := r.URL.Query().Get("cluster")
	cacheKey := "overview:" + orStr(clusterName, "active")

	var cached map[string]interface{}
	if services.CacheGet(r.Context(), cacheKey, &cached) {
		writeJSON(w, 200, cached)
		return
	}

	svc, err := getK8sService(r)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"configured": true, "error": err.Error(),
			"nodes": []interface{}{},
			"pod_counts": map[string]int{"running": 0, "pending": 0, "failed": 0, "total": 0},
			"warning_events": []interface{}{},
		})
		return
	}

	result, err := svc.GetOverview(r.Context())
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"configured": true, "error": err.Error()})
		return
	}
	services.CacheSet(r.Context(), cacheKey, result, services.TTLOverview)
	writeJSON(w, 200, result)
}

func K8sDescribe(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	if kind == "" {
		kind = "pod"
	}
	name := r.URL.Query().Get("name")
	ns := r.URL.Query().Get("namespace")
	if ns == "" {
		ns = "default"
	}

	svc, err := getK8sService(r)
	if err != nil {
		writeJSON(w, 200, map[string]string{"output": "", "error": err.Error()})
		return
	}
	output, err := svc.Describe(r.Context(), kind, name, ns)
	if err != nil {
		writeJSON(w, 200, map[string]string{"output": "", "error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]string{"output": output})
}

func K8sAllResources(w http.ResponseWriter, r *http.Request) {
	ns := r.URL.Query().Get("namespace")
	if ns == "" {
		ns = "default"
	}
	svc, err := getK8sService(r)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"pods": []interface{}{}, "services": []interface{}{},
			"deployments": []interface{}{}, "error": err.Error(),
		})
		return
	}
	result, _ := svc.GetAllResources(r.Context(), ns)
	writeJSON(w, 200, result)
}

func K8sNodeMetrics(w http.ResponseWriter, r *http.Request) {
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

func K8sKubectl(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Cluster   *string  `json:"cluster"`
		Command   []string `json:"command"`
		Confirmed bool     `json:"confirmed"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "Invalid request")
		return
	}

	svc, err := getK8sService(r)
	if err != nil {
		writeError(w, 404, "Cluster not configured")
		return
	}

	sseHeaders(w)

	// For safety, only allow read-only commands
	allowedVerbs := map[string]bool{
		"get": true, "describe": true, "logs": true, "top": true,
		"explain": true, "version": true, "cluster-info": true,
	}

	if len(req.Command) > 0 {
		verb := req.Command[0]
		if !allowedVerbs[verb] && !req.Confirmed {
			sseWrite(w, map[string]interface{}{
				"line":      fmt.Sprintf("Command '%s' requires confirmation (confirmed=true)", verb),
				"type":      "stderr",
			})
			sseWrite(w, map[string]interface{}{"done": true, "exit_code": 1})
			return
		}
	}

	// Execute via describe (simplified)
	if len(req.Command) >= 2 && req.Command[0] == "describe" {
		parts := req.Command
		kind := ""
		name := ""
		ns := "default"
		if len(parts) > 1 {
			kind = parts[1]
		}
		if len(parts) > 2 {
			name = parts[2]
		}
		for i, p := range parts {
			if (p == "-n" || p == "--namespace") && i+1 < len(parts) {
				ns = parts[i+1]
			}
		}
		output, err := svc.Describe(r.Context(), kind, name, ns)
		if err != nil {
			sseWrite(w, map[string]interface{}{"line": err.Error(), "type": "stderr"})
		} else {
			for _, line := range splitLines(output) {
				sseWrite(w, map[string]interface{}{"line": line, "type": "stdout"})
			}
		}
	} else {
		sseWrite(w, map[string]interface{}{
			"line": fmt.Sprintf("kubectl %v (streamed via Meridian)", req.Command),
			"type": "stdout",
		})
	}
	sseWrite(w, map[string]interface{}{"done": true, "exit_code": 0})
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i, c := range s {
		if c == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

func orStr(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
