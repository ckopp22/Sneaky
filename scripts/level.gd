class_name Level
extends Node2D

signal goal_reached
signal player_spotted

const GUARD_SCENE: PackedScene = preload("res://scenes/guard.tscn")
const LIGHT_SCENE: PackedScene = preload("res://scenes/light.tscn")

var map_size: Vector2 = Vector2.ZERO
var player_start: Vector2 = Vector2.ZERO

var _walls: Array[Rect2] = []
var _goal: Rect2 = Rect2()


func load_json(path: String) -> bool:
	var data: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if data is not Dictionary:
		push_error("Could not load level: %s" % path)
		return false
	_build(data as Dictionary)
	return true


func _build(data: Dictionary) -> void:
	var tile: float = float(data.get("tileSize", Config.TILE_SIZE))
	var size: Array = data["size"]
	map_size = Vector2(size[0], size[1]) * tile
	var start: Array = data["playerStart"]
	player_start = (Vector2(start[0], start[1]) + Vector2(0.5, 0.5)) * tile
	for wall: Array in data["walls"]:
		var rect: Rect2 = _tile_rect(wall, tile)
		_walls.append(rect)
		_add_wall_body(rect)
	_goal = _tile_rect(data["goal"]["rect"], tile)
	_add_goal_area(_goal)
	for guard_data: Dictionary in data.get("guards", []):
		var guard := GUARD_SCENE.instantiate() as Guard
		guard.setup(guard_data, tile)
		guard.spotted.connect(player_spotted.emit)
		add_child(guard)
	for light_data: Dictionary in data.get("lights", []):
		var light := LIGHT_SCENE.instantiate() as Light
		light.setup(light_data, tile)
		light.spotted.connect(player_spotted.emit)
		add_child(light)
	queue_redraw()


func _tile_rect(values: Array, tile: float) -> Rect2:
	return Rect2(Vector2(values[0], values[1]) * tile, Vector2(values[2], values[3]) * tile)


func _add_wall_body(rect: Rect2) -> void:
	var body := StaticBody2D.new()
	body.position = rect.get_center()
	body.collision_layer = Config.WALL_LAYER
	body.collision_mask = 0
	body.add_child(_make_shape(rect.size))
	add_child(body)


func _add_goal_area(rect: Rect2) -> void:
	var area := Area2D.new()
	area.position = rect.get_center()
	area.collision_layer = 0
	area.add_child(_make_shape(rect.size))
	area.body_entered.connect(_on_goal_body_entered)
	add_child(area)


func _make_shape(size: Vector2) -> CollisionShape2D:
	var shape := RectangleShape2D.new()
	shape.size = size
	var collision := CollisionShape2D.new()
	collision.shape = shape
	return collision


func _on_goal_body_entered(body: Node2D) -> void:
	if body is Player:
		goal_reached.emit()


func _draw() -> void:
	for wall: Rect2 in _walls:
		draw_rect(wall, Config.WALL_COLOR)
	draw_rect(_goal, Config.GOAL_COLOR)
