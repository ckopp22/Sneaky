class_name Player
extends CharacterBody2D

const LEFT_KEYS: Array[Key] = [KEY_A, KEY_LEFT]
const RIGHT_KEYS: Array[Key] = [KEY_D, KEY_RIGHT]
const UP_KEYS: Array[Key] = [KEY_W, KEY_UP]
const DOWN_KEYS: Array[Key] = [KEY_S, KEY_DOWN]

var joystick_vector: Vector2 = Vector2.ZERO

@onready var _shape: CollisionShape2D = $CollisionShape2D


func _ready() -> void:
	add_to_group("player")
	motion_mode = CharacterBody2D.MOTION_MODE_FLOATING
	collision_layer = 1
	collision_mask = Config.WALL_LAYER
	(_shape.shape as CircleShape2D).radius = Config.PLAYER_RADIUS


func _physics_process(_delta: float) -> void:
	var direction: Vector2 = _keyboard_vector()
	if direction == Vector2.ZERO:
		direction = joystick_vector
	velocity = direction * Config.PLAYER_SPEED
	move_and_slide()


func set_joystick_vector(vector: Vector2) -> void:
	joystick_vector = vector


func _keyboard_vector() -> Vector2:
	var x: float = float(_is_down(RIGHT_KEYS)) - float(_is_down(LEFT_KEYS))
	var y: float = float(_is_down(DOWN_KEYS)) - float(_is_down(UP_KEYS))
	return Vector2(x, y).limit_length(1.0)


func _is_down(keys: Array[Key]) -> bool:
	for key: Key in keys:
		if Input.is_physical_key_pressed(key):
			return true
	return false


func _draw() -> void:
	draw_circle(Vector2.ZERO, Config.PLAYER_RADIUS, Config.PLAYER_COLOR)
