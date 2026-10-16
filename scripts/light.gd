class_name Light
extends Vision

var kind: String = "sweep"
var arc_from: float = 0.0
var arc_to: float = 180.0
var period: float = 4.0
var on_time: float = 2.0

var _time: float = 0.0


func setup(data: Dictionary, tile: float) -> void:
	kind = str(data.get("type", "sweep"))
	var pos: Array = data["pos"]
	position = (Vector2(pos[0], pos[1]) + Vector2(0.5, 0.5)) * tile
	period = float(data.get("period", period))
	_time = float(data.get("offset", 0.0))
	cone_color = Config.LIGHT_COLOR
	if kind == "blink":
		fov_deg = 360.0
		view_range = float(data.get("radius", 80.0))
		on_time = float(data.get("on", period / 2.0))
	else:
		var arc: Array = data.get("arc", [0, 180])
		arc_from = float(arc[0])
		arc_to = float(arc[1])
		fov_deg = float(data.get("fov", 40.0))
		view_range = float(data.get("range", 140.0))


func _update_state(delta: float) -> void:
	_time += delta
	if kind == "blink":
		active = fposmod(_time, period) < on_time
	else:
		var t: float = 0.5 - 0.5 * cos(TAU * _time / period)
		facing = Vector2.from_angle(deg_to_rad(lerpf(arc_from, arc_to, t)))


func _draw_body() -> void:
	draw_circle(Vector2.ZERO, 5.0, Config.LAMP_COLOR if active else Config.LAMP_COLOR.darkened(0.6))
