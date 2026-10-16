class_name Vision
extends Node2D

signal spotted

const ALERT_BUBBLE: Texture2D = preload("res://assets/ui/graphics/alert_bubble.png")

var fov_deg: float = Config.GUARD_FOV
var view_range: float = Config.GUARD_RANGE
var facing: Vector2 = Vector2.RIGHT
var active: bool = true
var cone_color: Color = Config.VISION_COLOR

var _seen_time: float = 0.0
var _alerted: bool = false
var _polygon: PackedVector2Array = PackedVector2Array()
var _target: Node2D


func _physics_process(delta: float) -> void:
	if _target == null:
		_target = get_tree().get_first_node_in_group("player") as Node2D
	_update_state(delta)
	if active:
		_update_polygon()
		_update_detection(delta)
	else:
		_polygon.clear()
		_seen_time = 0.0
	queue_redraw()


func _update_state(_delta: float) -> void:
	pass


func _draw_body() -> void:
	pass


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
	var color: Color = Config.ALERT_COLOR if _seen_time > 0.0 else cone_color
	for i: int in range(1, _polygon.size() - 1):
		var a: Vector2 = _polygon[i]
		var b: Vector2 = _polygon[i + 1]
		if absf(a.cross(b)) > 0.01:
			draw_colored_polygon(PackedVector2Array([Vector2.ZERO, a, b]), color)
	_draw_body()
	if _seen_time > 0.0:
		draw_texture(ALERT_BUBBLE, Vector2(-11.0, -42.0))
