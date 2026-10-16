extends Node2D

const BACKGROUND_COLOR: Color = Color(0.04, 0.05, 0.08)


func _ready() -> void:
	RenderingServer.set_default_clear_color(BACKGROUND_COLOR)
