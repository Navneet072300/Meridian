package launch

import (
	"archive/zip"
	"bytes"
	"os"
	"strings"
	"testing"
)

func archive(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var b bytes.Buffer
	z := zip.NewWriter(&b)
	for n, s := range files {
		w, e := z.Create(n)
		if e != nil {
			t.Fatal(e)
		}
		if _, e = w.Write([]byte(s)); e != nil {
			t.Fatal(e)
		}
	}
	if e := z.Close(); e != nil {
		t.Fatal(e)
	}
	return b.Bytes()
}
func TestInspect(t *testing.T) {
	cases := []struct {
		name    string
		files   map[string]string
		runtime string
		blocked bool
	}{
		{"node", map[string]string{"app/package.json": `{"scripts":{"start":"node index.js"}}`, "app/.env.example": "DATABASE_URL=\nPORT=8080"}, "node", false},
		{"vite", map[string]string{"package.json": `{"scripts":{"build":"vite build"},"devDependencies":{"vite":"*"}}`}, "static", false},
		{"python", map[string]string{"requirements.txt": "fastapi\nuvicorn", "main.py": "app = FastAPI()"}, "python", false},
		{"unknown python entrypoint", map[string]string{"requirements.txt": "django"}, "python", true},
		{"go", map[string]string{"go.mod": "module app\ngo 1.23"}, "go", false},
		{"html", map[string]string{"index.html": "hello"}, "static", false},
		{"other language", map[string]string{"Dockerfile": "FROM scratch\nUSER 10001", "main.rs": "fn main() {}"}, "docker", false},
		{"unsupported", map[string]string{"app.rb": "puts 'hi'"}, "unknown", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, p, e := Inspect(archive(t, c.files))
			if e != nil {
				t.Fatal(e)
			}
			if p.Runtime != c.runtime || (len(p.Blockers) > 0) != c.blocked {
				t.Fatalf("unexpected plan: %+v", p)
			}
		})
	}
}
func TestRejectUnsafeArchives(t *testing.T) {
	for _, name := range []string{"../escape", "/absolute", "a/../../escape", "a\\evil", "a/./evil", "a/.env", "a/.env.production", "id_rsa", "tls.pem", "C:/evil"} {
		t.Run(name, func(t *testing.T) {
			if _, _, e := Inspect(archive(t, map[string]string{name: "x"})); e == nil {
				t.Fatalf("accepted %s", name)
			}
		})
	}
	var b bytes.Buffer
	w := zip.NewWriter(&b)
	h := &zip.FileHeader{Name: "link"}
	h.SetMode(os.ModeSymlink | 0777)
	f, _ := w.CreateHeader(h)
	f.Write([]byte("/etc/passwd"))
	w.Close()
	if _, _, e := Inspect(b.Bytes()); e == nil {
		t.Fatal("accepted symlink")
	}
	b.Reset()
	w = zip.NewWriter(&b)
	for i := 0; i < 2; i++ {
		f, _ = w.Create("same")
		f.Write([]byte("x"))
	}
	w.Close()
	if _, _, e := Inspect(b.Bytes()); e == nil {
		t.Fatal("accepted duplicate")
	}
}
func TestArchiveSizeAndIntegrity(t *testing.T) {
	if _, _, e := Inspect(make([]byte, MaxArchive+1)); e == nil {
		t.Fatal("accepted oversized input")
	}
	data := archive(t, map[string]string{"file": strings.Repeat("x", 1024)})
	z, _ := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	offset, _ := z.File[0].DataOffset()
	data[offset] ^= 255
	if _, _, e := Inspect(data); e == nil {
		t.Fatal("accepted corrupted zip")
	}
}
func TestSourceStoreAndEnv(t *testing.T) {
	t.Setenv("SOURCE_DIR", t.TempDir())
	data := archive(t, map[string]string{"index.html": "hi"})
	key, e := StoreSource(data)
	if e != nil {
		t.Fatal(e)
	}
	got, e := ReadSource(key)
	if e != nil || !bytes.Equal(data, got) {
		t.Fatal("source roundtrip failed")
	}
	if _, e = ReadSource("../../etc/passwd"); e == nil {
		t.Fatal("accepted source traversal")
	}
	if ValidateEnv(map[string]string{"BAD=KEY": "x"}) == nil {
		t.Fatal("accepted bad env")
	}
	if ValidateEnv(map[string]string{"DATABASE_URL": "postgres://test"}) != nil {
		t.Fatal("valid env rejected")
	}
}
