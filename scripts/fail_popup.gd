class_name FailPopup
extends Control

signal retry_pressed

@onready var _button: Button = $Center/Box/TryAgain


func _ready() -> void:
	_button.pressed.connect(retry_pressed.emit)
