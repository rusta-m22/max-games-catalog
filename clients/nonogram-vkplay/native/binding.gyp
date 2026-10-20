{
  "targets": [
    {
      "target_name": "vkplay_overlay",
      "sources": [
        "gclay.cc"
      ],
      "defines": [
        "NAPI_VERSION=8",
        "WIN32_LEAN_AND_MEAN",
        "NOMINMAX"
      ],
      "win_delay_load_hook": "true",
      "msvs_settings": {
        "VCCLCompilerTool": {
          "AdditionalOptions": [
            "/std:c++17",
            "/utf-8"
          ],
          "RuntimeLibrary": 0
        }
      }
    },
    {
      "target_name": "gclay_fixture",
      "type": "shared_library",
      "sources": [
        "../tests/native/fake-gclay.cc"
      ],
      "defines": [
        "WIN32_LEAN_AND_MEAN",
        "NOMINMAX"
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "AdditionalOptions": [
            "/std:c++17",
            "/utf-8"
          ],
          "RuntimeLibrary": 0
        }
      }
    }
  ]
}
