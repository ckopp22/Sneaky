extends Node

const LEVEL_COUNT: int = 5
const MAIN_SCENE: String = "res://scenes/main.tscn"
const SELECT_SCENE: String = "res://scenes/level_select.tscn"

var current_level: int = 1


func _ready() -> void:
	RenderingServer.set_default_clear_color(Config.BACKGROUND_COLOR)
	get_window().theme = UiTheme.build()


func level_path(id: int) -> String:
	return "res://assets/levels/level%d.json" % id


func level_name(id: int) -> String:
	var data: Variant = JSON.parse_string(FileAccess.get_file_as_string(level_path(id)))
	if data is Dictionary:
		return str((data as Dictionary).get("name", ""))
	return ""


func start_level(id: int) -> void:
	current_level = id
	get_tree().change_scene_to_file(MAIN_SCENE)


func open_level_select() -> void:
	get_tree().change_scene_to_file(SELECT_SCENE)
