// Package launch implements the source-to-release pipeline independently of the
// legacy, globally configured cluster dashboard.
package launch

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

const MaxArchive = 32 << 20
const MaxExpanded = 128 << 20

type Plan struct {
	Runtime    string   `json:"runtime"`
	Port       int      `json:"port"`
	Dockerfile string   `json:"dockerfile"`
	Required   []string `json:"required"`
	Warnings   []string `json:"warnings"`
	Blockers   []string `json:"blockers"`
	Files      int      `json:"files"`
}

// Inspect rejects ambiguous/unsafe archives before any source is written. Both
// the API and worker use this exact validation, including CRC verification.
func Inspect(data []byte) (map[string][]byte, Plan, error) {
	p := Plan{Port: 8080, Required: []string{}, Warnings: []string{}, Blockers: []string{}}
	if len(data) > MaxArchive {
		return nil, p, fmt.Errorf("ZIP must be smaller than 32 MB")
	}
	z, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, p, fmt.Errorf("upload a valid ZIP project archive")
	}
	if len(z.File) > 5000 {
		return nil, p, fmt.Errorf("too many files; remove dependencies and build output")
	}
	files := map[string][]byte{}
	total := int64(0)
	for _, f := range z.File {
		name := f.Name
		if name == "." || name == "" || strings.ContainsAny(name, "\\\x00:") || strings.HasPrefix(name, "/") || path.Clean(name) != strings.TrimSuffix(name, "/") || name == ".." || strings.HasPrefix(name, "../") {
			return nil, p, fmt.Errorf("unsafe archive path")
		}
		if f.Mode()&os.ModeSymlink != 0 || (!f.FileInfo().IsDir() && !f.Mode().IsRegular()) {
			return nil, p, fmt.Errorf("links and special files are not accepted")
		}
		if f.FileInfo().IsDir() {
			continue
		}
		skip := false
		for _, part := range strings.Split(name, "/") {
			if part == "node_modules" || part == ".git" || part == "__MACOSX" || part == ".venv" {
				skip = true
			}
		}
		if skip {
			continue
		}
		base := path.Base(name)
		if base == ".env" || (strings.HasPrefix(base, ".env.") && base != ".env.example" && base != ".env.sample" && base != ".env.template") || strings.HasSuffix(base, ".pem") || base == "id_rsa" || base == "id_ed25519" {
			return nil, p, fmt.Errorf("remove secret files such as .env and private keys; add values in project settings")
		}
		if f.UncompressedSize64 > MaxExpanded {
			return nil, p, fmt.Errorf("expanded archive too large")
		}
		r, e := f.Open()
		if e != nil {
			return nil, p, e
		}
		b, e := io.ReadAll(io.LimitReader(r, MaxExpanded-total+1))
		r.Close()
		if e != nil {
			return nil, p, fmt.Errorf("corrupt archive")
		}
		total += int64(len(b))
		if total > MaxExpanded {
			return nil, p, fmt.Errorf("expanded archive exceeds 128 MB")
		}
		if _, ok := files[name]; ok {
			return nil, p, fmt.Errorf("duplicate archive path")
		}
		files[name] = b
	}
	if len(files) == 0 {
		return nil, p, fmt.Errorf("archive contains no source files")
	}
	// GitHub archives and Finder ZIPs wrap their project in a root directory.
	for {
		prefix := ""
		common := true
		for n := range files {
			i := strings.Index(n, "/")
			if i < 0 {
				common = false
				break
			}
			if prefix == "" {
				prefix = n[:i+1]
			} else if prefix != n[:i+1] {
				common = false
				break
			}
		}
		if !common || prefix == "" {
			break
		}
		next := map[string][]byte{}
		for n, b := range files {
			next[strings.TrimPrefix(n, prefix)] = b
		}
		files = next
	}
	p.Files = len(files)
	for n, b := range files {
		if path.Base(n) == ".env.example" {
			for _, line := range strings.Split(string(b), "\n") {
				key, _, ok := strings.Cut(strings.TrimSpace(line), "=")
				key = strings.TrimSpace(key)
				if ok && envName.MatchString(key) && key != "PORT" {
					p.Required = append(p.Required, key)
				}
			}
		}
	}
	sort.Strings(p.Required)
	p.Required = unique(p.Required)
	if docker, ok := files["Dockerfile"]; ok {
		p.Runtime = "docker"
		p.Dockerfile = string(docker)
		p.Warnings = append(p.Warnings, "Custom Dockerfile: confirm the listening port. The container must run as a non-root user.")
		return files, p, nil
	}
	switch {
	case files["package.json"] != nil:
		var pkg struct {
			Scripts         map[string]string `json:"scripts"`
			Dependencies    map[string]string `json:"dependencies"`
			DevDependencies map[string]string `json:"devDependencies"`
		}
		if json.Unmarshal(files["package.json"], &pkg) != nil {
			return nil, p, fmt.Errorf("package.json is invalid")
		}
		p.Runtime = "node"
		install := "npm install"
		if files["package-lock.json"] != nil {
			install = "npm ci"
		}
		p.Dockerfile = "FROM node:22-bookworm-slim\nWORKDIR /app\nCOPY --chown=node:node . .\nRUN " + install + "\n"
		if pkg.Scripts["build"] != "" {
			p.Dockerfile += "RUN npm run build\n"
		}
		if pkg.Dependencies["vite"] != "" || pkg.DevDependencies["vite"] != "" {
			p.Runtime = "static"
			p.Dockerfile = "FROM node:22-bookworm-slim AS build\nWORKDIR /app\nCOPY . .\nRUN " + install + " && npm run build\nFROM nginxinc/nginx-unprivileged:stable-alpine\nCOPY --from=build /app/dist /usr/share/nginx/html\nEXPOSE 8080\n"
			p.Warnings = append(p.Warnings, "Vite builds must output dist/. Runtime variables are unavailable in static JavaScript; provide public build configuration in source.")
		} else if pkg.Scripts["start"] == "" {
			p.Blockers = append(p.Blockers, "Add a start script to package.json or supply a Dockerfile.")
		} else {
			p.Dockerfile += "USER 1000\nENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0\nEXPOSE 8080\nCMD [\"npm\",\"start\"]\n"
		}
	case files["requirements.txt"] != nil:
		p.Runtime = "python"
		p.Dockerfile = "FROM python:3.12-slim\nWORKDIR /app\nCOPY . .\nRUN pip install --no-cache-dir -r requirements.txt && useradd -u 10001 app\nUSER 10001\nENV PORT=8080 PYTHONUNBUFFERED=1\nEXPOSE 8080\n"
		if strings.Contains(string(files["main.py"]), "FastAPI(") {
			p.Dockerfile += "CMD [\"python\",\"-m\",\"uvicorn\",\"main:app\",\"--host\",\"0.0.0.0\",\"--port\",\"8080\"]\n"
			p.Warnings = append(p.Warnings, "Include uvicorn in requirements.txt. Expected application: main:app.")
		} else {
			p.Blockers = append(p.Blockers, "Python detected. Add a Dockerfile specifying your production server and application entry point.")
		}
	case files["go.mod"] != nil:
		p.Runtime = "go"
		p.Dockerfile = "FROM golang:1.26-bookworm AS build\nWORKDIR /app\nCOPY . .\nRUN CGO_ENABLED=0 go build -o /server .\nFROM gcr.io/distroless/static-debian12:nonroot\nCOPY --from=build /server /server\nENV PORT=8080\nEXPOSE 8080\nCMD [\"/server\"]\n"
		p.Warnings = append(p.Warnings, "Builds the root Go package. Listen on 0.0.0.0 using PORT; use a Dockerfile for other package layouts.")
	case files["index.html"] != nil:
		p.Runtime = "static"
		p.Dockerfile = "FROM nginxinc/nginx-unprivileged:stable-alpine\nCOPY . /usr/share/nginx/html\nEXPOSE 8080\n"
	default:
		p.Runtime = "unknown"
		p.Blockers = append(p.Blockers, "Add a Dockerfile to deploy this language or choose the folder containing your app.")
	}
	p.Warnings = append(p.Warnings, "Only one web service is deployed per project. Database provisioning and migrations are not automatic.")
	return files, p, nil
}

var envName = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]{0,127}$`)

func ValidateEnv(values map[string]string) error {
	if len(values) > 100 {
		return fmt.Errorf("maximum 100 environment variables")
	}
	for k, v := range values {
		if !envName.MatchString(k) || len(v) > 8192 || strings.ContainsRune(v, 0) {
			return fmt.Errorf("invalid environment variable %q", k)
		}
	}
	return nil
}
func unique(a []string) []string {
	out := []string{}
	for _, v := range a {
		if len(out) == 0 || out[len(out)-1] != v {
			out = append(out, v)
		}
	}
	return out
}
func SourceDir() string {
	if v := os.Getenv("SOURCE_DIR"); v != "" {
		return v
	}
	return "data/sources"
}
func StoreSource(data []byte) (string, error) {
	sum := sha256.Sum256(data)
	key := hex.EncodeToString(sum[:])
	if e := os.MkdirAll(SourceDir(), 0700); e != nil {
		return "", e
	}
	f, e := os.CreateTemp(SourceDir(), ".upload-")
	if e != nil {
		return "", e
	}
	defer os.Remove(f.Name())
	_, e = f.Write(data)
	ce := f.Close()
	if e != nil {
		return "", e
	}
	if ce != nil {
		return "", ce
	}
	if e = os.Rename(f.Name(), filepath.Join(SourceDir(), key+".zip")); e != nil {
		return "", e
	}
	return key, nil
}
func ReadSource(key string) ([]byte, error) {
	if !regexp.MustCompile(`^[a-f0-9]{64}$`).MatchString(key) {
		return nil, fmt.Errorf("invalid source key")
	}
	b, e := os.ReadFile(filepath.Join(SourceDir(), key+".zip"))
	if e != nil {
		return nil, e
	}
	sum := sha256.Sum256(b)
	if hex.EncodeToString(sum[:]) != key {
		return nil, fmt.Errorf("source checksum mismatch")
	}
	return b, nil
}
