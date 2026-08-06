package services

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	metricsv1beta1 "k8s.io/metrics/pkg/client/clientset/versioned"
)

type K8sService struct {
	client        *kubernetes.Clientset
	metricsClient *metricsv1beta1.Clientset
}

func NewK8sService(apiURL, token, kubeconfig string) (*K8sService, error) {
	var restConfig *rest.Config
	var err error

	if kubeconfig != "" {
		kc := kubeconfig
		if strings.HasPrefix(kc, "base64:") {
			decoded, err := base64.StdEncoding.DecodeString(kc[7:])
			if err != nil {
				return nil, fmt.Errorf("decode kubeconfig: %w", err)
			}
			kc = string(decoded)
		}
		restConfig, err = clientcmd.RESTConfigFromKubeConfig([]byte(kc))
		if err != nil {
			return nil, fmt.Errorf("kubeconfig parse: %w", err)
		}
	} else if apiURL != "" && token != "" {
		restConfig = &rest.Config{
			Host:        apiURL,
			BearerToken: token,
			TLSClientConfig: rest.TLSClientConfig{
				Insecure: true,
			},
		}
	} else {
		return nil, fmt.Errorf("no cluster credentials provided")
	}

	client, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, err
	}
	metricsClient, _ := metricsv1beta1.NewForConfig(restConfig)
	return &K8sService{client: client, metricsClient: metricsClient}, nil
}

func (s *K8sService) Health(ctx context.Context) map[string]interface{} {
	_, err := s.client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{Limit: 1})
	if err != nil {
		return map[string]interface{}{"healthy": false, "error": err.Error()}
	}
	return map[string]interface{}{"healthy": true, "configured": true}
}

func (s *K8sService) GetNamespaces(ctx context.Context) ([]string, error) {
	list, err := s.client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	ns := make([]string, 0, len(list.Items))
	for _, n := range list.Items {
		ns = append(ns, n.Name)
	}
	return ns, nil
}

func (s *K8sService) GetPods(ctx context.Context, namespace string) ([]map[string]interface{}, error) {
	list, err := s.client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	pods := make([]map[string]interface{}, 0, len(list.Items))
	for _, p := range list.Items {
		pods = append(pods, podToMap(&p))
	}
	return pods, nil
}

func podToMap(p *corev1.Pod) map[string]interface{} {
	status := string(p.Status.Phase)
	restarts := 0
	ready := 0
	total := len(p.Spec.Containers)

	for _, cs := range p.Status.ContainerStatuses {
		restarts += int(cs.RestartCount)
		if cs.Ready {
			ready++
		}
		if cs.State.Waiting != nil {
			status = cs.State.Waiting.Reason
		} else if cs.State.Terminated != nil && cs.State.Terminated.Reason != "" {
			status = cs.State.Terminated.Reason
		}
	}

	age := ""
	if !p.CreationTimestamp.IsZero() {
		dur := time.Since(p.CreationTimestamp.Time)
		h := int(dur.Hours())
		if h > 24 {
			age = fmt.Sprintf("%dd", h/24)
		} else {
			age = fmt.Sprintf("%dh", h)
		}
	}

	return map[string]interface{}{
		"name":      p.Name,
		"namespace": p.Namespace,
		"status":    status,
		"ready":     fmt.Sprintf("%d/%d", ready, total),
		"restarts":  restarts,
		"age":       age,
		"node":      p.Spec.NodeName,
		"labels":    p.Labels,
	}
}

func (s *K8sService) GetPodLogs(ctx context.Context, namespace, pod string, lines int) (string, error) {
	tailLines := int64(lines)
	opts := &corev1.PodLogOptions{TailLines: &tailLines}
	req := s.client.CoreV1().Pods(namespace).GetLogs(pod, opts)
	stream, err := req.Stream(ctx)
	if err != nil {
		return "", err
	}
	defer stream.Close()
	var sb strings.Builder
	buf := make([]byte, 4096)
	for {
		n, err := stream.Read(buf)
		if n > 0 {
			sb.Write(buf[:n])
		}
		if err != nil {
			break
		}
	}
	return sb.String(), nil
}

func (s *K8sService) GetPodEvents(ctx context.Context, namespace, pod string) ([]map[string]interface{}, error) {
	events, err := s.client.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{
		FieldSelector: "involvedObject.name=" + pod,
	})
	if err != nil {
		return nil, err
	}
	out := make([]map[string]interface{}, 0, len(events.Items))
	for _, e := range events.Items {
		out = append(out, eventToMap(&e))
	}
	return out, nil
}

func eventToMap(e *corev1.Event) map[string]interface{} {
	t := ""
	if !e.LastTimestamp.IsZero() {
		t = e.LastTimestamp.UTC().Format("2006-01-02T15:04:05Z")
	}
	return map[string]interface{}{
		"type":    e.Type,
		"reason":  e.Reason,
		"message": e.Message,
		"count":   e.Count,
		"time":    t,
	}
}

func (s *K8sService) GetNodes(ctx context.Context) ([]map[string]interface{}, error) {
	list, err := s.client.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	nodes := make([]map[string]interface{}, 0, len(list.Items))
	for _, n := range list.Items {
		nodes = append(nodes, nodeToMap(&n))
	}
	return nodes, nil
}

func nodeToMap(n *corev1.Node) map[string]interface{} {
	status := "Unknown"
	memPressure, diskPressure, pidPressure := false, false, false
	for _, c := range n.Status.Conditions {
		if c.Type == corev1.NodeReady {
			if c.Status == corev1.ConditionTrue {
				status = "Ready"
			} else {
				status = "NotReady"
			}
		}
		if c.Type == corev1.NodeMemoryPressure && c.Status == corev1.ConditionTrue {
			memPressure = true
		}
		if c.Type == corev1.NodeDiskPressure && c.Status == corev1.ConditionTrue {
			diskPressure = true
		}
		if c.Type == corev1.NodePIDPressure && c.Status == corev1.ConditionTrue {
			pidPressure = true
		}
	}

	roles := []string{}
	for k := range n.Labels {
		if strings.HasPrefix(k, "node-role.kubernetes.io/") {
			roles = append(roles, strings.TrimPrefix(k, "node-role.kubernetes.io/"))
		}
	}

	return map[string]interface{}{
		"name":            n.Name,
		"status":          status,
		"roles":           roles,
		"memory_pressure": memPressure,
		"disk_pressure":   diskPressure,
		"pid_pressure":    pidPressure,
		"version":         n.Status.NodeInfo.KubeletVersion,
		"os":              n.Status.NodeInfo.OSImage,
	}
}

func (s *K8sService) GetEvents(ctx context.Context, namespace string) ([]map[string]interface{}, error) {
	events, err := s.client.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]map[string]interface{}, 0)
	for _, e := range events.Items {
		if e.Type == "Warning" {
			out = append(out, eventToMap(&e))
		}
	}
	return out, nil
}

func (s *K8sService) GetOverview(ctx context.Context) (map[string]interface{}, error) {
	nodes, _ := s.GetNodes(ctx)
	pods, _ := s.GetPods(ctx, "")
	if pods == nil {
		// try default namespace
		pods, _ = s.GetPods(ctx, "default")
	}

	running, pending, failed := 0, 0, 0
	for _, p := range pods {
		switch p["status"] {
		case "Running":
			running++
		case "Pending":
			pending++
		case "Failed":
			failed++
		}
	}

	events, _ := s.GetEvents(ctx, "default")

	return map[string]interface{}{
		"configured":    true,
		"nodes":         nodes,
		"pod_counts":    map[string]int{"running": running, "pending": pending, "failed": failed, "total": len(pods)},
		"warning_events": events,
	}, nil
}

func (s *K8sService) GetAllResources(ctx context.Context, namespace string) (map[string]interface{}, error) {
	pods, _ := s.GetPods(ctx, namespace)
	svcs, _ := s.getServices(ctx, namespace)
	deps, _ := s.getDeployments(ctx, namespace)
	return map[string]interface{}{
		"pods":        pods,
		"services":    svcs,
		"deployments": deps,
		"statefulsets": []interface{}{},
		"daemonsets":  []interface{}{},
		"replicasets": []interface{}{},
	}, nil
}

func (s *K8sService) getServices(ctx context.Context, namespace string) ([]map[string]interface{}, error) {
	list, err := s.client.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]map[string]interface{}, 0, len(list.Items))
	for _, svc := range list.Items {
		ports := []string{}
		for _, p := range svc.Spec.Ports {
			ports = append(ports, fmt.Sprintf("%d/%s", p.Port, p.Protocol))
		}
		out = append(out, map[string]interface{}{
			"name":      svc.Name,
			"namespace": svc.Namespace,
			"type":      string(svc.Spec.Type),
			"cluster_ip": svc.Spec.ClusterIP,
			"ports":     ports,
		})
	}
	return out, nil
}

func (s *K8sService) getDeployments(ctx context.Context, namespace string) ([]map[string]interface{}, error) {
	list, err := s.client.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]map[string]interface{}, 0, len(list.Items))
	for _, d := range list.Items {
		out = append(out, map[string]interface{}{
			"name":      d.Name,
			"namespace": d.Namespace,
			"ready":     fmt.Sprintf("%d/%d", d.Status.ReadyReplicas, d.Status.Replicas),
			"replicas":  d.Status.Replicas,
		})
	}
	return out, nil
}

func (s *K8sService) GetNodeMetrics(ctx context.Context) ([]map[string]interface{}, error) {
	if s.metricsClient == nil {
		return nil, fmt.Errorf("metrics-server not available")
	}
	list, err := s.metricsClient.MetricsV1beta1().NodeMetricses().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]map[string]interface{}, 0, len(list.Items))
	for _, m := range list.Items {
		cpu := m.Usage.Cpu().MilliValue()
		mem := m.Usage.Memory().Value() / 1024 / 1024
		out = append(out, map[string]interface{}{
			"name":       m.Name,
			"cpu_milli":  cpu,
			"memory_mb":  mem,
		})
	}
	return out, nil
}

func (s *K8sService) Describe(ctx context.Context, kind, name, namespace string) (string, error) {
	// Simplified describe — returns pod/node/service info as JSON-like text
	switch strings.ToLower(kind) {
	case "pod":
		pod, err := s.client.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("Pod: %s\nNamespace: %s\nStatus: %s\nNode: %s", pod.Name, pod.Namespace, pod.Status.Phase, pod.Spec.NodeName), nil
	case "node":
		node, err := s.client.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("Node: %s\nKubelet: %s", node.Name, node.Status.NodeInfo.KubeletVersion), nil
	default:
		return fmt.Sprintf("describe %s/%s in %s (not yet implemented)", kind, name, namespace), nil
	}
}
