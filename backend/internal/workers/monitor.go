package workers

import (
	"context"
	"crypto/rand"
	"fmt"
	"log"
	"sync"
	"time"

	"meridian/internal/config"
	"meridian/internal/services"
)

type Incident struct {
	ID             string  `json:"id"`
	UserID         string  `json:"user_id"`
	ClusterName    string  `json:"cluster_name"`
	Namespace      *string `json:"namespace"`
	ResourceType   string  `json:"resource_type"`
	ResourceName   string  `json:"resource_name"`
	IssueType      string  `json:"issue_type"`
	Severity       string  `json:"severity"`
	Title          string  `json:"title"`
	Status         string  `json:"status"`
	DetectedAt     string  `json:"detected_at"`
	LastAlertedAt  *string `json:"last_alerted_at"`
	AlertCount     int     `json:"alert_count"`
	SnoozedUntil   *string `json:"snoozed_until"`
	AcknowledgedAt *string `json:"acknowledged_at"`
	AcknowledgedBy *string `json:"acknowledged_by"`
	ResolvedAt     *string `json:"resolved_at"`
	Resolution     *string `json:"resolution_description"`
}

var (
	incidentsMu sync.RWMutex
	incidents   = map[string]*Incident{}
)

var issueMap = map[string]struct{ Severity, Title string }{
	"CrashLoopBackOff":          {"critical", "Pod keeps crashing"},
	"ImagePullBackOff":          {"high", "Cannot pull container image"},
	"ErrImagePull":              {"high", "Image pull error"},
	"OOMKilled":                 {"high", "Pod killed — out of memory"},
	"CreateContainerConfigError": {"high", "Missing secret or configmap"},
	"Pending":                   {"medium", "Pod stuck in pending"},
	"Evicted":                   {"medium", "Pod evicted"},
}

func GetIncidents(userID string) []Incident {
	incidentsMu.RLock()
	defer incidentsMu.RUnlock()
	out := make([]Incident, 0)
	for _, inc := range incidents {
		if userID == "" || inc.UserID == userID {
			out = append(out, *inc)
		}
	}
	return out
}

func GetIncident(id string) *Incident {
	incidentsMu.RLock()
	defer incidentsMu.RUnlock()
	for _, inc := range incidents {
		if inc.ID == id {
			cp := *inc
			return &cp
		}
	}
	return nil
}

func AcknowledgeIncident(id, by string) bool {
	incidentsMu.Lock()
	defer incidentsMu.Unlock()
	for _, inc := range incidents {
		if inc.ID == id {
			now := time.Now().UTC().Format(time.RFC3339)
			inc.Status = "acknowledged"
			inc.AcknowledgedAt = &now
			inc.AcknowledgedBy = &by
			return true
		}
	}
	return false
}

func SnoozeIncident(id string, minutes int) bool {
	incidentsMu.Lock()
	defer incidentsMu.Unlock()
	for _, inc := range incidents {
		if inc.ID == id {
			t := time.Now().UTC().Add(time.Duration(minutes) * time.Minute).Format(time.RFC3339)
			inc.SnoozedUntil = &t
			return true
		}
	}
	return false
}

func ResolveIncident(id, resolution string) bool {
	incidentsMu.Lock()
	defer incidentsMu.Unlock()
	for _, inc := range incidents {
		if inc.ID == id {
			now := time.Now().UTC().Format(time.RFC3339)
			inc.Status = "resolved"
			inc.ResolvedAt = &now
			inc.Resolution = &resolution
			return true
		}
	}
	return false
}

func Start(ctx context.Context) {
	interval := time.Duration(config.MonitorPollInterval) * time.Second
	log.Printf("Cluster monitor started (interval=%v)", interval)
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-time.After(interval):
				pollAll(ctx)
			}
		}
	}()
}

func pollAll(ctx context.Context) {
	cfg := config.LoadPlatformConfig()
	for _, cluster := range cfg.Clusters {
		if !cluster.Active {
			continue
		}
		go pollCluster(ctx, cluster)
	}
}

func pollCluster(ctx context.Context, cluster config.ClusterConfig) {
	svc, err := services.NewK8sService(cluster.APIURL, cluster.Token, cluster.Kubeconfig)
	if err != nil {
		log.Printf("Monitor: cluster %s connect error: %v", cluster.Name, err)
		return
	}

	namespaces, err := svc.GetNamespaces(ctx)
	if err != nil {
		namespaces = []string{"default"}
	}

	allPods := make([]map[string]interface{}, 0)
	for _, ns := range namespaces {
		pods, err := svc.GetPods(ctx, ns)
		if err == nil {
			allPods = append(allPods, pods...)
		}
	}

	nodes, _ := svc.GetNodes(ctx)
	checkPods(cluster.Name, allPods)
	checkNodes(cluster.Name, nodes)
	checkRecoveries(cluster.Name, allPods, nodes)
}

func checkPods(clusterName string, pods []map[string]interface{}) {
	for _, pod := range pods {
		status, _ := pod["status"].(string)
		name, _ := pod["name"].(string)
		ns, _ := pod["namespace"].(string)
		for issueType, meta := range issueMap {
			if status == issueType || (len(status) > 0 && status == issueType) {
				handleIssue(clusterName, "pod", name, ns, issueType, meta.Severity, meta.Title)
			}
		}
	}
}

func checkNodes(clusterName string, nodes []map[string]interface{}) {
	for _, node := range nodes {
		name, _ := node["name"].(string)
		status, _ := node["status"].(string)
		if status == "NotReady" {
			handleIssue(clusterName, "node", name, "", "NodeNotReady", "critical", "Node not ready")
		}
	}
}

func checkRecoveries(clusterName string, pods []map[string]interface{}, nodes []map[string]interface{}) {
	healthyPods := map[string]bool{}
	for _, p := range pods {
		status, _ := p["status"].(string)
		name, _ := p["name"].(string)
		if _, bad := issueMap[status]; !bad {
			healthyPods[name] = true
		}
	}
	healthyNodes := map[string]bool{}
	for _, n := range nodes {
		status, _ := n["status"].(string)
		name, _ := n["name"].(string)
		if status == "Ready" {
			healthyNodes[name] = true
		}
	}

	incidentsMu.Lock()
	defer incidentsMu.Unlock()
	for _, inc := range incidents {
		if inc.ClusterName != clusterName {
			continue
		}
		if inc.Status != "active" && inc.Status != "acknowledged" {
			continue
		}
		recovered := (inc.ResourceType == "pod" && healthyPods[inc.ResourceName]) ||
			(inc.ResourceType == "node" && healthyNodes[inc.ResourceName])
		if recovered {
			now := time.Now().UTC().Format(time.RFC3339)
			inc.Status = "auto_resolved"
			inc.ResolvedAt = &now
			log.Printf("Monitor: auto-resolved %s %s on %s", inc.ResourceType, inc.ResourceName, clusterName)
		}
	}
}

func handleIssue(clusterName, resType, resName, ns, issueType, severity, title string) {
	key := clusterName + ":" + resType + ":" + resName
	incidentsMu.Lock()
	defer incidentsMu.Unlock()

	if inc, ok := incidents[key]; ok {
		if inc.Status == "active" || inc.Status == "acknowledged" {
			return
		}
	}

	id := generateID()
	now := time.Now().UTC().Format(time.RFC3339)
	var nsPtr *string
	if ns != "" {
		nsPtr = &ns
	}
	incidents[key] = &Incident{
		ID:           id,
		UserID:       "system",
		ClusterName:  clusterName,
		Namespace:    nsPtr,
		ResourceType: resType,
		ResourceName: resName,
		IssueType:    issueType,
		Severity:     severity,
		Title:        title,
		Status:       "active",
		DetectedAt:   now,
		AlertCount:   0,
	}
	log.Printf("Monitor: new incident [%s] %s on %s/%s", severity, title, clusterName, resName)
}

func generateID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// keep config import used
var _ = config.MonitorPollInterval
