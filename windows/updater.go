package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// isNewer returns true if version a is strictly newer than version b (semver major.minor.patch).
func isNewer(a, b string) bool {
	pa := strings.SplitN(a, ".", 3)
	pb := strings.SplitN(b, ".", 3)
	for i := 0; i < 3; i++ {
		va, vb := 0, 0
		if i < len(pa) {
			va, _ = strconv.Atoi(pa[i])
		}
		if i < len(pb) {
			vb, _ = strconv.Atoi(pb[i])
		}
		if va > vb {
			return true
		}
		if va < vb {
			return false
		}
	}
	return false
}

const repoOwner = "tomer-van-cohen"
const repoName = "airport"

type githubRelease struct {
	TagName string        `json:"tag_name"`
	Assets  []githubAsset `json:"assets"`
}

type githubAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

// checkForUpdate polls the GitHub Releases API for a newer version.
// If an update is found, it downloads the zip and prepares an update script.
func checkForUpdate(currentVersion string) {
	resp, err := http.Get(fmt.Sprintf(
		"https://api.github.com/repos/%s/%s/releases/latest",
		repoOwner, repoName,
	))
	if err != nil {
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return
	}

	var release githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return
	}

	latest := strings.TrimPrefix(release.TagName, "v")
	current := strings.TrimPrefix(currentVersion, "v")
	if latest == "" || !isNewer(latest, current) {
		return
	}

	// Find the Windows x64 zip asset
	var downloadURL string
	for _, asset := range release.Assets {
		if strings.Contains(asset.Name, "x64") && strings.HasSuffix(asset.Name, ".zip") {
			downloadURL = asset.BrowserDownloadURL
			break
		}
	}
	if downloadURL == "" {
		return
	}

	// Download to temp directory
	tmpDir := os.TempDir()
	zipPath := filepath.Join(tmpDir, "airport-update.zip")
	if err := downloadFile(zipPath, downloadURL); err != nil {
		return
	}

	// Write a batch script that will apply the update after the app exits
	exePath, _ := os.Executable()
	installDir := filepath.Dir(exePath)
	updateScript := filepath.Join(tmpDir, "airport-update.cmd")
	script := fmt.Sprintf(`@echo off
echo Updating Airport...
timeout /t 2 /nobreak >nul
powershell -NoProfile -Command "Expand-Archive -Force '%s' '%s'"
start "" "%s"
del "%%~f0"
`, zipPath, installDir, exePath)

	os.WriteFile(updateScript, []byte(script), 0755)

	// TODO: Notify the user via WebView that an update is available.
	// For now, just log it. The actual update will be triggered by user action.
	fmt.Printf("Update available: v%s -> v%s\n", current, latest)
}

// downloadFile fetches a URL and writes the response body to a local file.
func downloadFile(path string, url string) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	out, err := os.Create(path)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}
