extends Control

@onready var _grid: GridContainer = $Center/Box/Grid


func _ready() -> void:
	var completed: int = Save.highest_completed()
	for id: int in range(1, Game.LEVEL_COUNT + 1):
		var button := Button.new()
		button.custom_minimum_size = Vector2(150, 90)
		if Save.is_unlocked(id):
			var status: String = "\nDone" if id <= completed else ""
			button.text = "%d\n%s%s" % [id, Game.level_name(id), status]
			button.pressed.connect(Game.start_level.bind(id))
		else:
			button.text = "%d\nLocked" % id
			button.disabled = true
		_grid.add_child(button)
