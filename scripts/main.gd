extends Node2D

var _ended: bool = false

@onready var _level: Level = $Level
@onready var _player: Player = $Player
@onready var _camera: Camera2D = $Player/Camera2D
@onready var _joystick: Joystick = $UI/Joystick
@onready var _popup: ResultPopup = $UI/ResultPopup
@onready var _menu_button: Button = $UI/Menu


func _ready() -> void:
	_level.goal_reached.connect(_on_goal_reached)
	_level.player_spotted.connect(_on_player_spotted)
	_popup.retry_pressed.connect(_on_retry)
	_popup.next_pressed.connect(_on_next)
	_popup.menu_pressed.connect(_on_menu)
	_menu_button.pressed.connect(_on_menu)
	_joystick.moved.connect(_player.set_joystick_vector)
	if _level.load_json(Game.level_path(Game.current_level)):
		_player.position = _level.player_start
		_camera.limit_right = int(_level.map_size.x)
		_camera.limit_bottom = int(_level.map_size.y)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		_on_menu()


func _on_goal_reached() -> void:
	if _ended:
		return
	_ended = true
	Save.complete(Game.current_level)
	get_tree().paused = true
	_popup.show_win(Game.current_level < Game.LEVEL_COUNT)


func _on_player_spotted() -> void:
	if _ended:
		return
	_ended = true
	get_tree().paused = true
	_popup.show_fail()


func _on_retry() -> void:
	get_tree().paused = false
	get_tree().reload_current_scene()


func _on_next() -> void:
	get_tree().paused = false
	Game.start_level(Game.current_level + 1)


func _on_menu() -> void:
	get_tree().paused = false
	Game.open_level_select()
