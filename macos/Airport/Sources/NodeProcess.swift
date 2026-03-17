import Foundation

enum NodeProcessError: LocalizedError {
    case nodeNotFound
    case backendNotFound
    case startupTimeout
    case unexpectedExit(Int32)

    var errorDescription: String? {
        switch self {
        case .nodeNotFound: return "Node.js binary not found in app bundle"
        case .backendNotFound: return "backend.js not found in app bundle"
        case .startupTimeout: return "Backend did not start within 10 seconds"
        case .unexpectedExit(let code): return "Backend exited with code \(code)"
        }
    }
}

class NodeProcess {
    private var process: Process?
    private(set) var port: Int = 0

    func start() throws -> Int {
        let resourcePath = Bundle.main.resourcePath ?? Bundle.main.bundlePath
        let nodePath = resourcePath + "/node"
        let backendPath = resourcePath + "/backend.js"
        let rendererDir = resourcePath + "/renderer"
        let binDir = resourcePath + "/bin"

        guard FileManager.default.fileExists(atPath: nodePath) else {
            throw NodeProcessError.nodeNotFound
        }
        guard FileManager.default.fileExists(atPath: backendPath) else {
            throw NodeProcessError.backendNotFound
        }

        let dataDir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/Airport").path

        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: nodePath)
        proc.arguments = [backendPath]

        var env = ProcessInfo.processInfo.environment
        env["AIRPORT_BIN_DIR"] = binDir
        env["AIRPORT_DATA_DIR"] = dataDir
        env["AIRPORT_RENDERER_DIR"] = rendererDir
        env["PATH"] = "\(binDir):\(env["PATH"] ?? "/usr/bin:/bin")"
        env["HOME"] = FileManager.default.homeDirectoryForCurrentUser.path
        if env["SHELL"] == nil {
            env["SHELL"] = "/bin/zsh"
        }
        proc.environment = env

        // Ensure the data directory exists so currentDirectoryURL works.
        // Without this, the process inherits the parent's CWD (often ~),
        // and child process spawns in TCC-protected subdirs like ~/Downloads
        // trigger endless macOS permission prompts.
        try? FileManager.default.createDirectory(
            atPath: dataDir,
            withIntermediateDirectories: true,
            attributes: nil
        )
        proc.currentDirectoryURL = URL(fileURLWithPath: dataDir)

        let pipe = Pipe()
        proc.standardOutput = pipe

        let semaphore = DispatchSemaphore(value: 0)
        var detectedPort: Int?

        pipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            guard !data.isEmpty, let line = String(data: data, encoding: .utf8) else { return }
            for part in line.components(separatedBy: "\n") {
                if part.hasPrefix("AIRPORT_PORT="), let p = Int(part.dropFirst("AIRPORT_PORT=".count)) {
                    detectedPort = p
                    semaphore.signal()
                }
            }
        }

        proc.terminationHandler = { process in
            if detectedPort == nil {
                semaphore.signal()
            }
            NSLog("Airport backend exited with code \(process.terminationStatus)")
        }

        try proc.run()
        self.process = proc

        let result = semaphore.wait(timeout: .now() + 10)
        pipe.fileHandleForReading.readabilityHandler = nil

        if result == .timedOut {
            proc.terminate()
            throw NodeProcessError.startupTimeout
        }

        guard let port = detectedPort else {
            throw NodeProcessError.unexpectedExit(proc.terminationStatus)
        }

        self.port = port
        return port
    }

    func stop() {
        guard let proc = process, proc.isRunning else { return }
        proc.terminate()

        // Wait up to 2 seconds for graceful shutdown
        let deadline = Date().addingTimeInterval(2)
        while proc.isRunning && Date() < deadline {
            Thread.sleep(forTimeInterval: 0.05)
        }

        if proc.isRunning {
            proc.interrupt() // SIGKILL as last resort
        }

        process = nil
    }
}
