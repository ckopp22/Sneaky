class_name ResultPopup
extends Control

signal retry_pressed
signal next_pressed
signal menu_pressed

@onready var _title: Label = $Center/Panel/Margin/Box/Title
@onready var _retry: Button = $Center/Panel/Margin/Box/Retry
@onready var _next: Button = $Center/Panel/Margin/Box/Next
@onready var _menu: Button = $Center/Panel/Margin/Box/Menu


func _ready() -> void:
	_retry.pressed.connect(retry_pressed.emit)
	_next.pressed.connect(next_pressed.emit)
	_menu.pressed.connect(menu_pressed.emit)


func show_fail() -> void:
	_title.text = "Bummer... try again?"
	_retry.show()
	_next.hide()
	show()


func show_win(has_next: bool) -> void:
	_title.text = "Level Complete!"
	_retry.hide()
	_next.visible = has_next
	show()
