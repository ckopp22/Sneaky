extends Node2D

const LEVEL_PATH: String = "res://assets/levels/test.json"

@onready var _level: Level = $Level
@onready var _player: Player = $Player
@onready var _camera: Camera2D = $Player/Camera2D
@onready var _joystick: Joystick = $UI/Joystick
@onready var _message: Label = $UI/Message


func _ready() -> void:
	RenderingServer.set_default_clear_color(Config.BACKGROUND_COLOR)
	_level.goal_reached.connect(_on_goal_reached)
	_joystick.moved.connect(_player.set_joystick_vector)
	if _level.load_json(LEVEL_PATH):
		_player.position = _level.player_start
		_camera.limit_right = int(_level.map_size.x)
		_camera.limit_bottom = int(_level.map_size.y)


func _on_goal_reached() -> void:
	_message.show()
