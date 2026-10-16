class_name Guard
extends Node2D

signal spotted

var path: Array[Vector2] = []
var speed: float = Config.GUARD_SPEED
var fov_deg: float = Config.GUARD_FOV
var view_range: float = Config.GUARD_RANGE
var pause_time: float = Config.GUARD_PAUSE
var facing: Vector2 = Vector2.RIGHT

var _next: int = 1
var _step_dir: int = 1
var _pause_left: float = 0.0
var _seen_time: float = 0.0
var _alerted: bool = false
var _polygon: PackedVector2Array = PackedVector2Array()
var _target: Node2D


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


func _physics_process(delta: float) -> void:
	if _target == null:
		_target = get_tree().get_first_node_in_group("player") as Node2D
	_patrol(delta)
	_update_polygon()
	_update_detection(delta)
	queue_redraw()


func _patrol(delta: float) -> void:
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


func _update_polygon() -> void:
	var space: PhysicsDirectSpaceState2D = get_world_2d().direct_space_state
	var count: int = maxi(1, ceili(fov_deg / Config.VISION_RAY_STEP_DEG))
	var half: float = deg_to_rad(fov_deg) / 2.0
	_polygon = PackedVector2Array([Vector2.ZERO])
	for i: int in count + 1:
		var angle: float = facing.angle() + lerpf(-half, half, float(i) / float(count))
		var end: Vector2 = global_position + Vector2.from_angle(angle) * view_range
		var hit: Dictionary = space.intersect_ray(_ray(end))
		if not hit.is_empty():
			end = hit["position"]
		_polygon.append(to_local(end))


func _update_detection(delta: float) -> void:
	if _target != null and _can_see(_target.global_position):
		_seen_time += delta
	else:
		_seen_time = 0.0
	if _seen_time >= Config.GRACE_TIME and not _alerted:
		_alerted = true
		spotted.emit()


func _can_see(point: Vector2) -> bool:
	var offset: Vector2 = point - global_position
	if offset.length() > view_range:
		return false
	if absf(facing.angle_to(offset)) > deg_to_rad(fov_deg) / 2.0:
		return false
	return get_world_2d().direct_space_state.intersect_ray(_ray(point)).is_empty()


func _ray(to: Vector2) -> PhysicsRayQueryParameters2D:
	return PhysicsRayQueryParameters2D.create(global_position, to, Config.WALL_LAYER)


func _draw() -> void:
	var color: Color = Config.ALERT_COLOR if _seen_time > 0.0 else Config.VISION_COLOR
	for i: int in range(1, _polygon.size() - 1):
		var a: Vector2 = _polygon[i]
		var b: Vector2 = _polygon[i + 1]
		if absf(a.cross(b)) > 0.01:
			draw_colored_polygon(PackedVector2Array([Vector2.ZERO, a, b]), color)
	draw_circle(Vector2.ZERO, Config.GUARD_RADIUS, Config.GUARD_COLOR)
	if _seen_time > 0.0:
		draw_string(ThemeDB.fallback_font, Vector2(-4.0, -16.0), "!", HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color.RED)
