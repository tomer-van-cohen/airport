import AppKit
import WebKit

/// Transparent overlay positioned over the title bar area so that
/// mouse-down events initiate a native window drag instead of being
/// swallowed by the WKWebView underneath.
private class TitleBarDragView: NSView {
    override var mouseDownCanMoveWindow: Bool { true }
}

class MainWindow: NSWindow {
    private var webView: WKWebView!

    init(port: Int) {
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 1400, height: 900),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )

        self.titlebarAppearsTransparent = true
        self.titleVisibility = .hidden
        self.isMovableByWindowBackground = false
        self.backgroundColor = NSColor(red: 0x1e/255, green: 0x1e/255, blue: 0x2e/255, alpha: 1) // Catppuccin Mocha base
        self.minSize = NSSize(width: 800, height: 500)
        self.center()

        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")

        webView = WKWebView(frame: .zero, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground") // Transparent until content loads

        self.contentView = webView

        // Native drag overlay for the custom title bar (38px tall).
        // Starts at x=80 to leave room for the traffic-light buttons.
        let dragView = TitleBarDragView()
        dragView.translatesAutoresizingMaskIntoConstraints = false
        webView.addSubview(dragView)
        NSLayoutConstraint.activate([
            dragView.topAnchor.constraint(equalTo: webView.topAnchor),
            dragView.leadingAnchor.constraint(equalTo: webView.leadingAnchor, constant: 80),
            dragView.trailingAnchor.constraint(equalTo: webView.trailingAnchor),
            dragView.heightAnchor.constraint(equalToConstant: 38),
        ])

        let url = URL(string: "http://127.0.0.1:\(port)")!
        webView.load(URLRequest(url: url))
    }
}
