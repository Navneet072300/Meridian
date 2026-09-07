package launch

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	ktesting "k8s.io/client-go/testing"
	"meridian/internal/config"
	"meridian/internal/db"
	"meridian/internal/services"
)

func TestRolloutRetainsOldRouteUntilReady(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("requires TEST_DATABASE_URL")
	}
	ctx := context.Background()
	admin, e := pgxpool.New(ctx, dsn)
	if e != nil {
		t.Fatal(e)
	}
	defer admin.Close()
	schema := fmt.Sprintf("meridian_runtime_test_%d", time.Now().UnixNano())
	ident := pgx.Identifier{schema}.Sanitize()
	if _, e = admin.Exec(ctx, "CREATE SCHEMA "+ident); e != nil {
		t.Fatal(e)
	}
	defer admin.Exec(ctx, "DROP SCHEMA "+ident+" CASCADE")
	pc, _ := pgxpool.ParseConfig(dsn)
	pc.ConnConfig.RuntimeParams["search_path"] = schema
	pool, e := pgxpool.NewWithConfig(ctx, pc)
	if e != nil {
		t.Fatal(e)
	}
	defer pool.Close()
	old := db.Pool
	db.Pool = pool
	defer func() { db.Pool = old }()
	if _, e = pool.Exec(ctx, `CREATE TABLE users(id INTEGER PRIMARY KEY);CREATE TABLE otp_codes(id INTEGER);INSERT INTO users(id) VALUES(1)`); e != nil {
		t.Fatal(e)
	}
	if e = Migrate(ctx); e != nil {
		t.Fatal(e)
	}
	oldKey := config.EncryptionKey
	config.EncryptionKey = "12345678901234567890123456789012"
	defer func() { config.EncryptionKey = oldKey }()
	enc, e := services.Encrypt(`{"DATABASE_URL":"postgres://private"}`)
	if e != nil {
		t.Fatal(e)
	}
	for _, healthy := range []bool{false, true} {
		t.Run(fmt.Sprintf("healthy=%t", healthy), func(t *testing.T) {
			var project, revision, dep string
			pool.QueryRow(ctx, `INSERT INTO launch_projects(user_id,name,env_encrypted) VALUES(1,'test',$1) RETURNING id::text`, enc).Scan(&project)
			plan, _ := json.Marshal(Plan{Runtime: "static", Port: 8080})
			pool.QueryRow(ctx, `INSERT INTO launch_revisions(project_id,source_key,plan) VALUES($1,'test',$2) RETURNING id::text`, project, plan).Scan(&revision)
			pool.QueryRow(ctx, `INSERT INTO launch_deployments(project_id,revision_id,environment,status,env_encrypted,port,idempotency_key) VALUES($1,$2,'production','deploying',$3,8080,'test') RETURNING id::text`, project, revision, enc).Scan(&dep)
			ns := nameFor(project)
			oldID := "old"
			oldName := "old-release"
			client := fake.NewSimpleClientset(&corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: "app-production", Namespace: ns}, Spec: corev1.ServiceSpec{Selector: map[string]string{"meridian.release": oldID}}}, &appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: oldName, Namespace: ns, Labels: map[string]string{"meridian.environment": "production"}}})
			client.PrependReactor("get", "deployments", func(action ktesting.Action) (bool, runtime.Object, error) {
				get := action.(ktesting.GetAction)
				if get.GetName() != nameFor(dep) {
					return false, nil, nil
				}
				if !healthy {
					return true, nil, fmt.Errorf("readiness unavailable")
				}
				obj, e := client.Tracker().Get(appsv1.SchemeGroupVersion.WithResource("deployments"), ns, get.GetName())
				if e != nil {
					return true, nil, e
				}
				d := obj.(*appsv1.Deployment).DeepCopy()
				d.Status.ObservedGeneration = d.Generation
				d.Status.AvailableReplicas = 1
				return true, d, nil
			})
			rt := &Runtime{Client: client, Domain: "apps.example.test", IngressClass: "test", RuntimeClass: "sandbox"}
			err := rt.deploy(ctx, Job{ID: dep, Project: project, Revision: revision, Environment: "production", Encrypted: enc, Image: "registry.example/app@sha256:0123456789012345678901234567890123456789012345678901234567890123", Port: 8080})
			service, e := client.CoreV1().Services(ns).Get(ctx, "app-production", metav1.GetOptions{})
			if e != nil {
				t.Fatal(e)
			}
			if !healthy {
				if err == nil {
					t.Fatal("unready rollout succeeded")
				}
				if service.Spec.Selector["meridian.release"] != oldID {
					t.Fatal("changed route before readiness")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if service.Spec.Selector["meridian.release"] != dep {
				t.Fatal("did not promote ready release")
			}
			var state string
			pool.QueryRow(ctx, `SELECT status FROM launch_deployments WHERE id=$1`, dep).Scan(&state)
			if state != "healthy" {
				t.Fatal("did not persist healthy status")
			}
			d, e := client.AppsV1().Deployments(ns).Get(ctx, nameFor(dep), metav1.GetOptions{})
			if e != nil {
				t.Fatal(e)
			}
			if *d.Spec.Template.Spec.AutomountServiceAccountToken {
				t.Fatal("app has Kubernetes credentials")
			}
			if !*d.Spec.Template.Spec.SecurityContext.RunAsNonRoot {
				t.Fatal("app can run as root")
			}
		})
	}
}
