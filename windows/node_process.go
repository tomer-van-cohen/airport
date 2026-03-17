package main

import (
	"bufio"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// runHookSetup runs the hook setup script (best-effort, errors ignored).
func runHookSetup(nodePath, setupHooksPath, baseDir string) {
	if _, err := os.Stat(setupHooksPath); err == nil {
		cmd := exec.Command(nodePath, setupHooksPath)
		cmd.Dir = baseDir
		cmd.Run() // ignore errors
	}
}

// backendInfo holds the connection details reported by the Node.js backend.
type backendInfo struct {
	cmd   *exec.Cmd
	port  int
	token string
}

// spawnBackend starts the Node.js backend process and waits for it to
// report a port number and shutdown token on stdout.
func spawnBackend(nodePath, backendPath string) (*backendInfo, error) {
	cmd := exec.Command(nodePath, backendPath)
	cmd.Dir = filepath.Dir(backendPath)
	cmd.Stderr = os.Stderr
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, err
	}

	// Scan stdout for AIRPORT_PORT=NNNN and AIRPORT_TOKEN=...
	scanner := bufio.NewScanner(stdout)
	port := 0
	token := ""
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "AIRPORT_PORT=") {
			p, err := strconv.Atoi(strings.TrimPrefix(line, "AIRPORT_PORT="))
			if err == nil {
				port = p
			}
		}
		if strings.HasPrefix(line, "AIRPORT_TOKEN=") {
			token = strings.TrimPrefix(line, "AIRPORT_TOKEN=")
		}
		if port != 0 && token != "" {
			break
		}
	}

	if port == 0 {
		cmd.Process.Kill()
		return nil, fmt.Errorf("backend did not report a port")
	}

	// Drain remaining stdout in background
	go func() {
		for scanner.Scan() {
		}
	}()

	return &backendInfo{cmd: cmd, port: port, token: token}, nil
}

// shutdownBackend sends a graceful shutdown request to the backend
// and waits up to 2 seconds before forcefully killing the process.
func shutdownBackend(backend *backendInfo) {
	// Graceful shutdown via HTTP with auth token
	client := &http.Client{Timeout: 2 * time.Second}
	req, err := http.NewRequest("POST", fmt.Sprintf("http://127.0.0.1:%d/api/shutdown", backend.port), nil)
	if err == nil {
		if backend.token != "" {
			req.Header.Set("Authorization", "Bearer "+backend.token)
		}
		client.Do(req) //nolint:errcheck
	}

	// Wait up to 2 seconds for clean exit
	done := make(chan error, 1)
	go func() { done <- backend.cmd.Wait() }()

	select {
	case <-done:
		// Exited cleanly
	case <-time.After(2 * time.Second):
		backend.cmd.Process.Kill()
	}
}
