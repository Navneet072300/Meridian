package launch

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"meridian/internal/db"
	"meridian/internal/services"
)

type Job struct {
	ID, Project, Revision, Environment, Encrypted, Image, Source string
	Port                                                         int
	Plan                                                         Plan
}
type Runtime struct {
	Client                                                  kubernetes.Interface
	Domain, Registry, IngressClass, TLSSecret, RuntimeClass string
}

var errPersistence = errors.New("release persistence failed")

func RuntimeFromEnv() (*Runtime, error) {
	for _, key := range []string{"APP_DOMAIN", "IMAGE_REPOSITORY", "BUILDKIT_HOST", "INGRESS_CLASS", "RUNTIME_CLASS"} {
		if os.Getenv(key) == "" {
			return nil, fmt.Errorf("%s is required for the deployment worker", key)
		}
	}
	if !regexp.MustCompile(`^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$`).MatchString(os.Getenv("APP_DOMAIN")) {
		return nil, fmt.Errorf("APP_DOMAIN must be a hostname without scheme or path")
	}
	if _, e := exec.LookPath("buildctl"); e != nil {
		return nil, fmt.Errorf("install buildctl before starting the worker")
	}
	host, e := url.Parse(os.Getenv("BUILDKIT_HOST"))
	if e != nil || (host.Scheme != "tcp" && host.Scheme != "unix") {
		return nil, fmt.Errorf("BUILDKIT_HOST must use tcp:// or unix://")
	}
	if host.Scheme == "tcp" && os.Getenv("BUILDKIT_TLS_DIR") == "" {
		return nil, fmt.Errorf("remote BuildKit requires BUILDKIT_TLS_DIR with client certificates")
	}
	if os.Getenv("APP_ENV") == "production" && os.Getenv("APP_TLS_SECRET") == "" {
		return nil, fmt.Errorf("production requires APP_TLS_SECRET")
	}
	var cfg *rest.Config
	// e is declared during builder configuration validation above.
	if kc := os.Getenv("KUBECONFIG"); kc != "" {
		cfg, e = clientcmd.BuildConfigFromFlags("", kc)
	} else {
		cfg, e = rest.InClusterConfig()
	}
	if e != nil {
		return nil, e
	}
	cfg.Timeout = 20 * time.Second
	client, e := kubernetes.NewForConfig(cfg)
	if e != nil {
		return nil, e
	}
	return &Runtime{Client: client, Domain: os.Getenv("APP_DOMAIN"), Registry: os.Getenv("IMAGE_REPOSITORY"), IngressClass: os.Getenv("INGRESS_CLASS"), TLSSecret: os.Getenv("APP_TLS_SECRET"), RuntimeClass: os.Getenv("RUNTIME_CLASS")}, nil
}

// One worker owns the beta queue. A dedicated advisory-lock connection prevents
// two processes racing a production route. The DB, not HTTP/SSE, owns job state.
func (rt *Runtime) Run(ctx context.Context) error {
	lock, e := db.Pool.Acquire(ctx)
	if e != nil {
		return e
	}
	defer lock.Release()
	var acquired bool
	if e = lock.QueryRow(ctx, `SELECT pg_try_advisory_lock(71423819)`).Scan(&acquired); e != nil {
		return e
	}
	if !acquired {
		return fmt.Errorf("another deployment worker is already active")
	}
	defer lock.Exec(context.Background(), `SELECT pg_advisory_unlock(71423819)`)
	workerCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	// Resume interrupted jobs. Every resource is deterministically named and
	// image digests are saved before applying workloads.
	if _, e = db.Pool.Exec(ctx, `UPDATE launch_deployments SET status='queued',updated_at=now() WHERE status IN ('building','deploying')`); e != nil {
		return e
	}
	heartbeatDone := make(chan struct{})
	defer func() { cancel(); <-heartbeatDone }()
	go func() {
		defer close(heartbeatDone)
		tick := time.NewTicker(10 * time.Second)
		defer tick.Stop()
		for {
			if _, e := lock.Exec(workerCtx, `INSERT INTO launch_worker_health(name,last_seen) VALUES('primary',now()) ON CONFLICT(name) DO UPDATE SET last_seen=now()`); e != nil {
				cancel()
				return
			}
			select {
			case <-workerCtx.Done():
				return
			case <-tick.C:
			}
		}
	}()
	for {
		if workerCtx.Err() != nil {
			return workerCtx.Err()
		}
		job, e := claim(workerCtx)
		if errors.Is(e, pgx.ErrNoRows) {
			select {
			case <-workerCtx.Done():
				return workerCtx.Err()
			case <-time.After(2 * time.Second):
				continue
			}
		}
		if e != nil {
			return e
		}
		jobCtx, stop := context.WithTimeout(workerCtx, 20*time.Minute)
		e = rt.execute(jobCtx, job)
		stop()
		if e != nil {
			if errors.Is(e, errPersistence) {
				return e
			}
			if workerCtx.Err() != nil {
				return workerCtx.Err()
			}
			msg := e.Error()
			if len(msg) > 2000 {
				msg = msg[:2000]
			}
			log.Printf("deployment %s: %s", job.ID, msg)
			_, saveErr := db.Pool.Exec(workerCtx, `UPDATE launch_deployments SET status='failed',message=$2,updated_at=now() WHERE id=$1`, job.ID, msg)
			if saveErr != nil {
				return saveErr
			}
			Event(workerCtx, job.ID, msg)
		}
	}
}
func claim(ctx context.Context) (Job, error) {
	var j Job
	var raw []byte
	e := db.Pool.QueryRow(ctx, `UPDATE launch_deployments SET status='building',updated_at=now() WHERE id=(SELECT id FROM launch_deployments WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id::text,project_id::text,revision_id::text,environment,env_encrypted,image,port`).Scan(&j.ID, &j.Project, &j.Revision, &j.Environment, &j.Encrypted, &j.Image, &j.Port)
	if e != nil {
		return j, e
	}
	e = db.Pool.QueryRow(ctx, `SELECT source_key,plan FROM launch_revisions WHERE id=$1`, j.Revision).Scan(&j.Source, &raw)
	if e != nil {
		return j, e
	}
	e = json.Unmarshal(raw, &j.Plan)
	return j, e
}
func (rt *Runtime) execute(ctx context.Context, j Job) error {
	if j.Image == "" {
		if e := Event(ctx, j.ID, "Building your source in the isolated builder. This can take several minutes."); e != nil {
			return e
		}
		image, e := rt.build(ctx, j)
		if e != nil {
			return e
		}
		j.Image = image
		if _, e = db.Pool.Exec(ctx, `UPDATE launch_deployments SET image=$2,updated_at=now() WHERE id=$1`, j.ID, image); e != nil {
			return e
		}
	} else {
		Event(ctx, j.ID, "Reusing the saved image and configuration; no rebuild is needed.")
	}
	if _, e := db.Pool.Exec(ctx, `UPDATE launch_deployments SET status='deploying',updated_at=now() WHERE id=$1`, j.ID); e != nil {
		return e
	}
	return rt.deploy(ctx, j)
}

type cappedBuffer struct{ bytes.Buffer }

func (b *cappedBuffer) Write(p []byte) (int, error) {
	n := len(p)
	if b.Len() < 16000 {
		keep := 16000 - b.Len()
		if keep > n {
			keep = n
		}
		b.Buffer.Write(p[:keep])
	}
	return n, nil
}
func (rt *Runtime) build(ctx context.Context, j Job) (string, error) {
	data, e := ReadSource(j.Source)
	if e != nil {
		return "", e
	}
	files, _, e := Inspect(data)
	if e != nil {
		return "", e
	}
	dir, e := os.MkdirTemp("", "meridian-build-")
	if e != nil {
		return "", e
	}
	defer os.RemoveAll(dir)
	source := filepath.Join(dir, "source")
	for name, b := range files {
		dst := filepath.Join(source, filepath.FromSlash(name))
		if e = os.MkdirAll(filepath.Dir(dst), 0755); e != nil {
			return "", e
		}
		if e = os.WriteFile(dst, b, 0644); e != nil {
			return "", e
		}
	}
	// Put the generated build recipe outside the customer-controlled context.
	recipe := filepath.Join(dir, "recipe")
	if e = os.Mkdir(recipe, 0700); e != nil {
		return "", e
	}
	if e = os.WriteFile(filepath.Join(recipe, "Dockerfile"), []byte(j.Plan.Dockerfile), 0600); e != nil {
		return "", e
	}
	metadata := filepath.Join(dir, "metadata.json")
	tag := rt.Registry + ":" + j.ID
	args := []string{"--addr", os.Getenv("BUILDKIT_HOST")}
	if dir := os.Getenv("BUILDKIT_TLS_DIR"); dir != "" {
		args = append(args, "--tlsdir", dir)
	}
	args = append(args, "build", "--frontend", "dockerfile.v0", "--local", "context="+source, "--local", "dockerfile="+recipe, "--output", "type=image,name="+tag+",push=true", "--metadata-file", metadata)
	cmd := exec.CommandContext(ctx, "buildctl", args...)
	var output cappedBuffer
	cmd.Stdout = &output
	cmd.Stderr = &output
	if e = cmd.Run(); e != nil {
		if ctx.Err() != nil {
			return "", fmt.Errorf("Build timed out or worker stopped; the previous release is unchanged")
		}
		Event(ctx, j.ID, output.String())
		return "", fmt.Errorf("Build failed. Review the build output, dependency versions and start command, then upload a corrected project")
	}
	b, e := os.ReadFile(metadata)
	if e != nil {
		return "", e
	}
	var m map[string]interface{}
	if json.Unmarshal(b, &m) != nil {
		return "", fmt.Errorf("builder returned invalid metadata")
	}
	digest, _ := m["containerimage.digest"].(string)
	if !strings.HasPrefix(digest, "sha256:") || len(digest) != 71 {
		return "", fmt.Errorf("builder did not return an immutable image digest")
	}
	return rt.Registry + "@" + digest, nil
}
func nameFor(s string) string { return "mrd-" + strings.ReplaceAll(s, "-", "") }
func ptr[T any](v T) *T       { return &v }
func (rt *Runtime) deploy(ctx context.Context, j Job) error {
	ns := nameFor(j.Project)
	name := nameFor(j.ID)
	labels := map[string]string{"meridian.release": j.ID, "meridian.environment": j.Environment, "meridian.project": j.Project}
	_, e := rt.Client.CoreV1().Namespaces().Create(ctx, &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: ns, Labels: map[string]string{"meridian.project": j.Project, "pod-security.kubernetes.io/enforce": "restricted"}}}, metav1.CreateOptions{})
	if e != nil && !apierrors.IsAlreadyExists(e) {
		return e
	}
	if e = rt.ensurePolicy(ctx, ns); e != nil {
		return e
	}
	// Copy only the operator-configured registry and TLS credentials into app
	// namespaces. Runtime pods have no Kubernetes API credentials.
	for _, secretName := range []string{rt.TLSSecret, os.Getenv("IMAGE_PULL_SECRET")} {
		if secretName == "" {
			continue
		}
		sourceNS := os.Getenv("PLATFORM_NAMESPACE")
		if sourceNS == "" {
			sourceNS = "meridian-system"
		}
		original, err := rt.Client.CoreV1().Secrets(sourceNS).Get(ctx, secretName, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("operator secret %s unavailable: %w", secretName, err)
		}
		copy := &corev1.Secret{ObjectMeta: metav1.ObjectMeta{Name: secretName, Namespace: ns}, Type: original.Type, Data: original.Data}
		existing, err := rt.Client.CoreV1().Secrets(ns).Get(ctx, secretName, metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			_, err = rt.Client.CoreV1().Secrets(ns).Create(ctx, copy, metav1.CreateOptions{})
		} else if err == nil {
			copy.ResourceVersion = existing.ResourceVersion
			_, err = rt.Client.CoreV1().Secrets(ns).Update(ctx, copy, metav1.UpdateOptions{})
		}
		if err != nil {
			return err
		}
	}
	env := map[string]string{}
	plain, e := services.Decrypt(j.Encrypted)
	if e != nil {
		return e
	}
	if e = json.Unmarshal([]byte(plain), &env); e != nil {
		return e
	}
	env["PORT"] = fmt.Sprint(j.Port)
	secret := &corev1.Secret{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns}, StringData: env}
	_, e = rt.Client.CoreV1().Secrets(ns).Create(ctx, secret, metav1.CreateOptions{})
	if e != nil && !apierrors.IsAlreadyExists(e) {
		return e
	}
	containers := []corev1.Container{{Name: "app", Image: j.Image, Ports: []corev1.ContainerPort{{ContainerPort: int32(j.Port)}}, EnvFrom: []corev1.EnvFromSource{{SecretRef: &corev1.SecretEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: name}}}}, Resources: corev1.ResourceRequirements{Requests: corev1.ResourceList{corev1.ResourceCPU: resource.MustParse("100m"), corev1.ResourceMemory: resource.MustParse("128Mi")}, Limits: corev1.ResourceList{corev1.ResourceCPU: resource.MustParse("1"), corev1.ResourceMemory: resource.MustParse("512Mi")}}, SecurityContext: &corev1.SecurityContext{AllowPrivilegeEscalation: ptr(false), Capabilities: &corev1.Capabilities{Drop: []corev1.Capability{"ALL"}}}, ReadinessProbe: &corev1.Probe{ProbeHandler: corev1.ProbeHandler{HTTPGet: &corev1.HTTPGetAction{Path: "/", Port: intstr.FromInt(j.Port)}}, InitialDelaySeconds: 5, PeriodSeconds: 5, TimeoutSeconds: 3, FailureThreshold: 12}}}
	spec := &appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns, Labels: labels}, Spec: appsv1.DeploymentSpec{Replicas: ptr(int32(1)), Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"meridian.release": j.ID}}, Template: corev1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: labels}, Spec: corev1.PodSpec{AutomountServiceAccountToken: ptr(false), RuntimeClassName: ptr(rt.RuntimeClass), SecurityContext: &corev1.PodSecurityContext{RunAsNonRoot: ptr(true), SeccompProfile: &corev1.SeccompProfile{Type: corev1.SeccompProfileTypeRuntimeDefault}}, Containers: containers}}}}
	if pull := os.Getenv("IMAGE_PULL_SECRET"); pull != "" {
		spec.Spec.Template.Spec.ImagePullSecrets = []corev1.LocalObjectReference{{Name: pull}}
	}
	_, e = rt.Client.AppsV1().Deployments(ns).Create(ctx, spec, metav1.CreateOptions{})
	if e != nil && !apierrors.IsAlreadyExists(e) {
		return e
	}
	promoted := false
	defer func() {
		if !promoted {
			cleanup, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			active, e := rt.Client.CoreV1().Services(ns).Get(cleanup, "app-"+j.Environment, metav1.GetOptions{})
			if (e != nil && !apierrors.IsNotFound(e)) || (e == nil && active.Spec.Selector["meridian.release"] == j.ID) {
				return
			}
			rt.Client.AppsV1().Deployments(ns).Delete(cleanup, name, metav1.DeleteOptions{})
			rt.Client.CoreV1().Secrets(ns).Delete(cleanup, name, metav1.DeleteOptions{})
		}
	}()
	Event(ctx, j.ID, "Starting the app and checking HTTP /. The existing release stays live until the new version is ready.")
	readyCtx, cancel := context.WithTimeout(ctx, 4*time.Minute)
	defer cancel()
	for {
		d, e := rt.Client.AppsV1().Deployments(ns).Get(readyCtx, name, metav1.GetOptions{})
		if e != nil {
			return fmt.Errorf("Could not verify application readiness: %w", e)
		}
		if d.Status.ObservedGeneration >= d.Generation && d.Status.AvailableReplicas >= 1 {
			break
		}
		select {
		case <-readyCtx.Done():
			return fmt.Errorf("App did not become ready. It must run without root, listen on port %d and return HTTP 200–399 at /. Check missing variables and external database access", j.Port)
		case <-time.After(3 * time.Second):
		}
	}
	svcName := "app-" + j.Environment
	host := strings.ReplaceAll(j.Project, "-", "") + "-" + j.Environment + "." + rt.Domain
	// Ensure routing configuration before changing the live selector.
	ing := &networkingv1.Ingress{ObjectMeta: metav1.ObjectMeta{Name: svcName, Namespace: ns}, Spec: networkingv1.IngressSpec{IngressClassName: ptr(rt.IngressClass), Rules: []networkingv1.IngressRule{{Host: host, IngressRuleValue: networkingv1.IngressRuleValue{HTTP: &networkingv1.HTTPIngressRuleValue{Paths: []networkingv1.HTTPIngressPath{{Path: "/", PathType: ptr(networkingv1.PathTypePrefix), Backend: networkingv1.IngressBackend{Service: &networkingv1.IngressServiceBackend{Name: svcName, Port: networkingv1.ServiceBackendPort{Number: 80}}}}}}}}}}}
	scheme := "http"
	if rt.TLSSecret != "" {
		scheme = "https"
		ing.Spec.TLS = []networkingv1.IngressTLS{{Hosts: []string{host}, SecretName: rt.TLSSecret}}
	}
	_, e = rt.Client.NetworkingV1().Ingresses(ns).Create(ctx, ing, metav1.CreateOptions{})
	if e != nil && !apierrors.IsAlreadyExists(e) {
		return e
	}
	current, e := rt.Client.CoreV1().Services(ns).Get(ctx, svcName, metav1.GetOptions{})
	if apierrors.IsNotFound(e) {
		_, e = rt.Client.CoreV1().Services(ns).Create(ctx, &corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: svcName, Namespace: ns}, Spec: corev1.ServiceSpec{Selector: map[string]string{"meridian.release": j.ID}, Ports: []corev1.ServicePort{{Port: 80, TargetPort: intstr.FromInt(j.Port)}}}}, metav1.CreateOptions{})
	} else if e == nil {
		current.Spec.Selector = map[string]string{"meridian.release": j.ID}
		current.Spec.Ports = []corev1.ServicePort{{Port: 80, TargetPort: intstr.FromInt(j.Port)}}
		_, e = rt.Client.CoreV1().Services(ns).Update(ctx, current, metav1.UpdateOptions{})
	}
	if e != nil {
		return e
	}
	promoted = true // A DB outage here is recovered by replaying this same job.
	if _, e = db.Pool.Exec(ctx, `UPDATE launch_deployments SET status='healthy',url=$2,message='Application is ready; traffic has been routed to this release',updated_at=now() WHERE id=$1`, j.ID, scheme+"://"+host); e != nil {
		return fmt.Errorf("%w: route updated; restart worker to reconcile: %v", errPersistence, e)
	}
	Event(ctx, j.ID, "Application is ready. Rollback reuses the saved image and environment snapshot; it does not undo database changes.")
	old, e := rt.Client.AppsV1().Deployments(ns).List(ctx, metav1.ListOptions{LabelSelector: "meridian.environment=" + j.Environment})
	if e == nil {
		for _, d := range old.Items {
			if d.Name != name {
				rt.Client.AppsV1().Deployments(ns).Delete(ctx, d.Name, metav1.DeleteOptions{})
				rt.Client.CoreV1().Secrets(ns).Delete(ctx, d.Name, metav1.DeleteOptions{})
			}
		}
	}
	return nil
}
func (rt *Runtime) ensurePolicy(ctx context.Context, ns string) error {
	quota := &corev1.ResourceQuota{ObjectMeta: metav1.ObjectMeta{Name: "meridian-budget"}, Spec: corev1.ResourceQuotaSpec{Hard: corev1.ResourceList{corev1.ResourcePods: resource.MustParse("6"), corev1.ResourceLimitsMemory: resource.MustParse("3Gi"), corev1.ResourceLimitsCPU: resource.MustParse("6")}}}
	if _, e := rt.Client.CoreV1().ResourceQuotas(ns).Create(ctx, quota, metav1.CreateOptions{}); e != nil && !apierrors.IsAlreadyExists(e) {
		return e
	}
	dns := intstr.FromInt(53)
	udp := corev1.ProtocolUDP
	tcp := corev1.ProtocolTCP
	policy := &networkingv1.NetworkPolicy{ObjectMeta: metav1.ObjectMeta{Name: "meridian-isolation"}, Spec: networkingv1.NetworkPolicySpec{PodSelector: metav1.LabelSelector{}, PolicyTypes: []networkingv1.PolicyType{networkingv1.PolicyTypeIngress, networkingv1.PolicyTypeEgress}, Ingress: []networkingv1.NetworkPolicyIngressRule{{From: []networkingv1.NetworkPolicyPeer{{NamespaceSelector: &metav1.LabelSelector{MatchLabels: map[string]string{"meridian.ingress": "true"}}}, {PodSelector: &metav1.LabelSelector{}}}}}, Egress: []networkingv1.NetworkPolicyEgressRule{{To: []networkingv1.NetworkPolicyPeer{{NamespaceSelector: &metav1.LabelSelector{MatchLabels: map[string]string{"kubernetes.io/metadata.name": "kube-system"}}, PodSelector: &metav1.LabelSelector{MatchLabels: map[string]string{"k8s-app": "kube-dns"}}}}, Ports: []networkingv1.NetworkPolicyPort{{Protocol: &udp, Port: &dns}, {Protocol: &tcp, Port: &dns}}}, {To: []networkingv1.NetworkPolicyPeer{{IPBlock: &networkingv1.IPBlock{CIDR: "0.0.0.0/0", Except: []string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16", "127.0.0.0/8"}}}}}}}}
	_, e := rt.Client.NetworkingV1().NetworkPolicies(ns).Create(ctx, policy, metav1.CreateOptions{})
	if e != nil && !apierrors.IsAlreadyExists(e) {
		return e
	}
	return nil
}

var _ io.Writer = (*cappedBuffer)(nil)
