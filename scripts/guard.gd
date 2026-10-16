class_name Guard
extends Vision

var path: Array[Vector2] = []
var speed: float = Config.GUARD_SPEED
var pause_time: float = Config.GUARD_PAUSE

var _next: int = 1
var _step_dir: int = 1
var _pause_left: float = 0.0


func setup(data: Dictionary, tile: float) -> void:
	for point: Array in data["path"]:
		path.append((Vector2(point[0], point[1]) + Vector2(0.5, 0.5)) * tile)
	speed = float(data.get("speed", speed))
	fov_deg = float(data.get("fov", fov_deg))
	view_range = float(data.get("range", view_range))
	pause_time = float(data.get("pause", pause_time))
	position = path[0]
	if path.size() > 1:
		facing = (path[1] - path[0]).normalized()


func _update_state(delta: float) -> void:
	if path.size() < 2:
		return
	if _pause_left > 0.0:
		_pause_left -= delta
		return
	var to_goal: Vector2 = path[_next] - position
	var step: float = speed * delta
	if to_goal.length() <= step:
		position = path[_next]
		if _next + _step_dir < 0 or _next + _step_dir >= path.size():
			_step_dir = -_step_dir
		_next += _step_dir
		_pause_left = pause_time
	else:
		facing = to_goal.normalized()
		position += facing * step


func _draw_body() -> void:
	draw_circle(Vector2.ZERO, Config.GUARD_RADIUS, Config.GUARD_COLOR)
