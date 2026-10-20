// Test-only DLL. It is never copied into the distributable and makes no network requests.
#include <windows.h>
#include <cstring>
#include <cwchar>
#pragma pack(push, 1)
struct BrowserForm {
  int ParamSize; const char* Url; double Width, Height; const char* Caption;
  double ClientWidth, ClientHeight;
};
#pragma pack(pop)
static_assert(sizeof(BrowserForm)==52, "x64 packed ABI");
static int visible=0;
static bool mode(const wchar_t* expected) {
  wchar_t value[64]{}; GetEnvironmentVariableW(L"NONOGRAM_FAKE_GCLAY_MODE",value,64);
  return std::wcscmp(value,expected)==0;
}
extern "C" __declspec(dllexport) int __stdcall IsGCConnected() {
  return mode(L"disconnected") ? 0 : 1;
}
extern "C" __declspec(dllexport) int __stdcall GetOverlayState() { return visible; }
extern "C" __declspec(dllexport) int __stdcall DemandBrowserForm(BrowserForm* p) {
  if(mode(L"rejected") || !p || p->ParamSize!=sizeof(BrowserForm) || !p->Url || !p->Caption ||
    std::strcmp(p->Url,"https://co.vkpay.ru/test?order=local%2F123&lang=ru") ||
    std::strcmp(p->Caption,"Nonogram - VK Play") ||
    p->Width!=0 || p->Height!=0 || p->ClientWidth!=0 || p->ClientHeight!=0)return 0;
  visible=1;return 1;
}
