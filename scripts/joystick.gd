class_name Joystick
extends Control

signal moved(vector: Vector2)

var _touch_index: int = -1
var _knob_offset: Vector2 = Vector2.ZERO


func _ready() -> void:
	visible = DisplayServer.is_touchscreen_available()
	set_process_input(visible)


func _input(event: InputEvent) -> void:
	var touch := event as InputEventScreenTouch
	var drag := event as InputEventScreenDrag
	if touch != null:
		if touch.pressed and _touch_index == -1 and get_global_rect().has_point(touch.position):
			_touch_index = touch.index
			_update(touch.position)
		elif not touch.pressed and touch.index == _touch_index:
			_release()
	elif drag != null and drag.index == _touch_index:
		_update(drag.position)


func _update(screen_position: Vector2) -> void:
	_knob_offset = (screen_position - get_global_rect().get_center()).limit_length(Config.JOYSTICK_RADIUS)
	var vector: Vector2 = _knob_offset / Config.JOYSTICK_RADIUS
	moved.emit(vector if vector.length() >= Config.JOYSTICK_DEADZONE else Vector2.ZERO)
	queue_redraw()


func _release() -> void:
	_touch_index = -1
	_knob_offset = Vector2.ZERO
	moved.emit(Vector2.ZERO)
	queue_redraw()


func _draw() -> void:
	var center: Vector2 = size / 2.0
	draw_circle(center, Config.JOYSTICK_RADIUS, Color(1, 1, 1, 0.1))
	draw_arc(center, Config.JOYSTICK_RADIUS, 0.0, TAU, 48, Color(1, 1, 1, 0.3), 2.0)
	draw_circle(center + _knob_offset, 28.0, Color(1, 1, 1, 0.35))
