class_name Joystick
extends Control

signal moved(vector: Vector2)

const ART_SCALE: float = 2.0
const BASE_TEXTURE: Texture2D = preload("res://assets/ui/joystick/joystick_base.png")
const KNOB_TEXTURE: Texture2D = preload("res://assets/ui/joystick/joystick_knob.png")
const KNOB_ACTIVE_TEXTURE: Texture2D = preload("res://assets/ui/joystick/joystick_knob_active.png")

var _touch_index: int = -1
var _knob_offset: Vector2 = Vector2.ZERO
var _origin: Vector2 = Vector2.ZERO


func _ready() -> void:
	visible = DisplayServer.is_touchscreen_available()
	set_process_input(visible)


func _input(event: InputEvent) -> void:
	var touch := event as InputEventScreenTouch
	var drag := event as InputEventScreenDrag
	if touch != null:
		if touch.pressed and _touch_index == -1 and not _over_button(touch.position):
			_touch_index = touch.index
			_origin = touch.position
			_update(touch.position)
		elif not touch.pressed and touch.index == _touch_index:
			_release()
	elif drag != null and drag.index == _touch_index:
		_update(drag.position)


func _update(screen_position: Vector2) -> void:
	_knob_offset = (screen_position - _origin).limit_length(Config.JOYSTICK_RADIUS)
	var vector: Vector2 = _knob_offset / Config.JOYSTICK_RADIUS
	moved.emit(vector if vector.length() >= Config.JOYSTICK_DEADZONE else Vector2.ZERO)
	queue_redraw()


func _release() -> void:
	_touch_index = -1
	_knob_offset = Vector2.ZERO
	moved.emit(Vector2.ZERO)
	queue_redraw()


func _over_button(point: Vector2) -> bool:
	for sibling: Node in get_parent().get_children():
		var button := sibling as Button
		if button != null and button.is_visible_in_tree() and button.get_global_rect().has_point(point):
			return true
	return false


func _draw() -> void:
	if _touch_index == -1:
		return
	_draw_centered(BASE_TEXTURE, _origin)
	_draw_centered(KNOB_ACTIVE_TEXTURE, _origin + _knob_offset)


func _draw_centered(texture: Texture2D, at: Vector2) -> void:
	var texture_size: Vector2 = texture.get_size() * ART_SCALE
	draw_texture_rect(texture, Rect2(at - texture_size / 2.0, texture_size), false)
