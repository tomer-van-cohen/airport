package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	webview2 "github.com/jchv/go-webview2"
)

var version = "dev"

func main() {
	showVersion := flag.Bool("version", false, "Print version and exit")
	flag.Parse()
	if *showVersion {
		fmt.Println("Airport", version)
		os.Exit(0)
	}

	exePath, _ := os.Executable()
	baseDir := filepath.Dir(exePath)

	// Set up environment
	dataDir := filepath.Join(os.Getenv("APPDATA"), "Airport")
	os.MkdirAll(dataDir, 0755)

	binDir := filepath.Join(baseDir, "bin")
	rendererDir := filepath.Join(baseDir, "renderer")
	nodePath := filepath.Join(baseDir, "node.exe")

	os.Setenv("AIRPORT_BIN_DIR", binDir)
	os.Setenv("AIRPORT_DATA_DIR", dataDir)
	os.Setenv("AIRPORT_RENDERER_DIR", rendererDir)
	os.Setenv("HOME", os.Getenv("USERPROFILE"))
	os.Setenv("PATH", binDir+";"+os.Getenv("PATH"))

	// Run hook setup (best-effort)
	setupHooks := filepath.Join(baseDir, "scripts", "setup-hooks.mjs")
	runHookSetup(nodePath, setupHooks, baseDir)

	// Spawn node backend
	backend, err := spawnBackend(nodePath, filepath.Join(baseDir, "backend.js"))
	if err != nil {
		log.Fatal("Failed to start backend: ", err)
	}

	// Background update check
	go checkForUpdate(version)

	// Set up menu (Win32 menu bar)
	setupMenu()

	// Create WebView2 window
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		AutoFocus: true,
		WindowOptions: webview2.WindowOptions{
			Title:  "Airport",
			Width:  1400,
			Height: 900,
			Center: true,
		},
	})
	if w == nil {
		log.Fatal("Failed to create WebView2 window")
	}
	defer w.Destroy()
	w.Navigate(fmt.Sprintf("http://127.0.0.1:%d", backend.port))

	// Run the window event loop (blocking)
	w.Run()

	// Window closed — shut down backend
	shutdownBackend(backend)
}
