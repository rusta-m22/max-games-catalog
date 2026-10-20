// Minimal ABI declarations from the official GCLay.h; no vendor DLL is bundled.
// https://documentation.vkplay.ru/hotbox/devdocs/documents/gcdoc/2/GCLay.h
#include <windows.h>
#include <node_api.h>
#include <cstddef>
#include <string>
#include <vector>

#pragma pack(push, 1)
struct BrowserForm {
  int ParamSize;
  const char* Url;
  double Width;
  double Height;
  const char* Caption;
  double ClientWidth;
  double ClientHeight;
};
#pragma pack(pop)
static_assert(sizeof(void*) == 8, "Only Windows x64 is supported");
static_assert(sizeof(BrowserForm) == 52 && offsetof(BrowserForm, Url) == 4,
              "The published packed GCLay ABI must be preserved");
using Demand = int (__stdcall*)(BrowserForm*);
using Query = int (__stdcall*)();
static HMODULE module = nullptr;
static Demand demand = nullptr;
static Query connected = nullptr, overlay_state = nullptr;
static bool explicitly_loaded = false;
static DWORD load_error = 0;
static const char* error_code = "OVERLAY_NOT_LOADED";

static void boolean(napi_env env, napi_value obj, const char* name, bool value) {
  napi_value v; napi_get_boolean(env, value, &v); napi_set_named_property(env, obj, name, v);
}
static void integer(napi_env env, napi_value obj, const char* name, int value) {
  napi_value v; napi_create_int32(env, value, &v); napi_set_named_property(env, obj, name, v);
}
static void string(napi_env env, napi_value obj, const char* name, const char* value) {
  napi_value v; napi_create_string_utf8(env, value, NAPI_AUTO_LENGTH, &v);
  napi_set_named_property(env, obj, name, v);
}
static napi_value status_value(napi_env env) {
  napi_value obj; napi_create_object(env, &obj);
  boolean(env, obj, "loaded", module != nullptr);
  boolean(env, obj, "explicitlyLoaded", explicitly_loaded);
  boolean(env, obj, "available", demand && connected && overlay_state);
  boolean(env, obj, "connected", connected && connected() == 1);
  integer(env, obj, "overlayState", overlay_state ? overlay_state() : -1);
  integer(env, obj, "loadError", static_cast<int>(load_error));
  if (error_code) string(env, obj, "error", error_code);
  return obj;
}
static napi_value status(napi_env env, napi_callback_info) { return status_value(env); }
static napi_value initialize(napi_env env, napi_callback_info) {
  if (!module) {
    const wchar_t* key = L"GC_GCLAY64_PATHNAME";
    DWORD size = GetEnvironmentVariableW(key, nullptr, 0);
    load_error = 0;
    if (!size) { error_code = "OVERLAY_NOT_LOADED"; return status_value(env); }
    if (size > 32768) { error_code = "OVERLAY_INVALID_PATH"; return status_value(env); }
    std::vector<wchar_t> buffer(size);
    DWORD copied = GetEnvironmentVariableW(key, buffer.data(), size);
    if (!copied || copied >= size) { error_code = "OVERLAY_INVALID_PATH"; return status_value(env); }
    std::wstring path(buffer.data(), copied);
    // Only the documented local absolute environment path; never search the working directory.
    bool drive = (path[0] >= L'A' && path[0] <= L'Z') || (path[0] >= L'a' && path[0] <= L'z');
    if (path.size() < 4 || !drive || path[1] != L':' || (path[2] != L'\\' && path[2] != L'/')) {
      error_code = "OVERLAY_INVALID_PATH"; return status_value(env);
    }
    module = GetModuleHandleW(path.c_str());
    if (!module) {
      module = LoadLibraryExW(path.c_str(), nullptr,
        LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_SYSTEM32);
      explicitly_loaded = module != nullptr;
      if (!module) {
        load_error = GetLastError(); error_code = "OVERLAY_LOAD_FAILED"; return status_value(env);
      }
    }
  }
  demand = reinterpret_cast<Demand>(GetProcAddress(module, "DemandBrowserForm"));
  connected = reinterpret_cast<Query>(GetProcAddress(module, "IsGCConnected"));
  overlay_state = reinterpret_cast<Query>(GetProcAddress(module, "GetOverlayState"));
  error_code = demand && connected && overlay_state ? nullptr : "OVERLAY_SDK_UNAVAILABLE";
  return status_value(env);
}
static napi_value open_form(napi_env env, napi_callback_info info) {
  size_t argc = 1; napi_value arg;
  napi_get_cb_info(env, info, &argc, &arg, nullptr, nullptr);
  napi_valuetype type;
  size_t length = 0;
  if (argc != 1 || napi_typeof(env, arg, &type) != napi_ok || type != napi_string ||
      napi_get_value_string_utf8(env, arg, nullptr, 0, &length) != napi_ok || !length || length > 65536) {
    napi_throw_type_error(env, nullptr, "INVALID_PAYMENT_URL"); return nullptr;
  }
  std::vector<char> url(length + 1);
  napi_get_value_string_utf8(env, arg, url.data(), url.size(), &length);
  if (std::string(url.data()).size() != length) {
    napi_throw_type_error(env, nullptr, "INVALID_PAYMENT_URL"); return nullptr;
  }
  const char* failure = nullptr;
  bool accepted = false;
  if (!demand || !connected || !overlay_state) failure = "OVERLAY_SDK_UNAVAILABLE";
  else if (connected() != 1) failure = "GAME_CENTER_NOT_CONNECTED";
  else {
    // Leave sizes at zero for the SDK's default layout. Do not guess percentage encoding.
    BrowserForm form{};
    form.ParamSize = sizeof(form);
    form.Url = url.data();
    form.Caption = "Nonogram - VK Play";
    accepted = demand(&form) == 1;
    if (!accepted) failure = "OVERLAY_FORM_REJECTED";
  }
  napi_value result = status_value(env);
  boolean(env, result, "accepted", accepted);
  if (failure) string(env, result, "error", failure);
  return result;
}
NAPI_MODULE_INIT() {
  napi_property_descriptor properties[] = {
    {"initialize", nullptr, initialize, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"status", nullptr, status, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"open", nullptr, open_form, nullptr, nullptr, nullptr, napi_default, nullptr}
  };
  napi_define_properties(env, exports, 3, properties);
  return exports;
}
