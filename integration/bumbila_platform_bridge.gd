extends Node
# Compatibility bridge for the supplied BUMbila export.
# Game rules remain inside the original Main script; no advertising SDK here.
var was_paused := false
var previous_tree_pause := false
var previous_mute := false
var round_ended := false

func _ready() -> void:
 process_mode = Node.PROCESS_MODE_ALWAYS

func _process(_delta: float) -> void:
 if not OS.has_feature("web"):
  return
 var game := get_tree().current_scene
 if game != null:
  var ended := bool(game.get("level_complete")) or bool(game.get("game_over"))
  if ended and not round_ended:
   JavaScriptBridge.eval("window.JarvisGameRoundEnded && window.JarvisGameRoundEnded()")
  round_ended = ended
 var should_pause: bool = str(JavaScriptBridge.eval("window.__platform_paused === true ? 'paused' : ''")) == "paused"
 if should_pause == was_paused:
  return
 was_paused = should_pause
 if should_pause:
  previous_tree_pause = get_tree().paused
  previous_mute = AudioServer.is_bus_mute(0)
  get_tree().paused = true
  AudioServer.set_bus_mute(0, true)
 else:
  get_tree().paused = previous_tree_pause
  AudioServer.set_bus_mute(0, previous_mute)
