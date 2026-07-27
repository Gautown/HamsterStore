// WebView2 stub — HamsterStore 不使用 WebView2 widget，这个 stub 提供
// CreateCoreWebView2EnvironmentWithOptions 的空实现让 lld-link 能解析符号。
// 返回 E_NOTIMPL（0x80004001）— UI 内部调用时会检测到失败并 fallback 到
// 无 WebView2 的原生 widget 渲染路径。
#include <stdint.h>

typedef int32_t HRESULT;
typedef void* LPVOID;
typedef const void* LPCWSTR;

// Windows COM HRESULT 中的 E_NOTIMPL
#define E_NOTIMPL ((HRESULT)0x80004001L)

// WebView2 COM 接口前向声明（opaque pointer 传参即可）
typedef struct ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler;

// WebView2 loader 入口符号 — 由 webview2-com crate 引用
HRESULT CreateCoreWebView2EnvironmentWithOptions(
    LPCWSTR browserExecutableFolder,
    LPCWSTR userDataFolder,
    LPVOID options,
    ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler* handler) {
  (void)browserExecutableFolder;
  (void)userDataFolder;
  (void)options;
  (void)handler;
  return E_NOTIMPL;
}
