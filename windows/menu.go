package main

/*
Menu setup for Airport on Windows.

Uses Win32 API (CreateMenu, AppendMenu) via golang.org/x/sys/windows
to create a native menu bar.

Menu items dispatch keyboard events to the WebView via webview.Eval():

	window.dispatchEvent(new KeyboardEvent('keydown', {key: 't', ctrlKey: true}))

Edit menu items (Copy/Paste/Cut/Select All) are handled natively by WebView2.
*/

// Menu item IDs
const (
	menuNewSession    = 1001
	menuCloseSession  = 1002
	menuCopy          = 2001
	menuPaste         = 2002
	menuCut           = 2003
	menuSelectAll     = 2004
	menuClearTerminal = 3001
	menuNextSession   = 3002
	menuPrevSession   = 3003
	menuNextDone      = 3004
)

// setupMenu creates the Win32 menu bar.
// This is a placeholder — actual Win32 API calls require the HWND
// from the WebView2 window, which is library-specific.
// The webview2 library may provide a way to get the native handle.
func setupMenu() {
	// TODO: Implement using golang.org/x/sys/windows when building on Windows.
	// The implementation will:
	// 1. Get HWND from webview: w.Window()
	// 2. CreateMenu() for menu bar
	// 3. CreatePopupMenu() for each dropdown
	// 4. AppendMenuW for items with accelerator text
	// 5. SetMenu(hwnd, menuBar)
	//
	// Session menu:
	//   New Session   (Ctrl+T)
	//   Close Session (Ctrl+W)
	//
	// Edit menu:
	//   Copy       (Ctrl+C)
	//   Paste      (Ctrl+V)
	//   Cut        (Ctrl+X)
	//   Select All (Ctrl+A)
	//
	// View menu:
	//   Clear Terminal (Ctrl+K)
	//   Next Session   (Ctrl+])
	//   Prev Session   (Ctrl+[)
	//   Next Done      (Ctrl+J)
}
