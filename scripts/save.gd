class_name Save

const PATH: String = "user://progress.cfg"


static func highest_completed() -> int:
	var cfg := ConfigFile.new()
	if cfg.load(PATH) != OK:
		return 0
	return int(cfg.get_value("progress", "highest_completed", 0))


static func complete(level_id: int) -> void:
	if level_id <= highest_completed():
		return
	var cfg := ConfigFile.new()
	cfg.set_value("progress", "highest_completed", level_id)
	cfg.save(PATH)


static func is_unlocked(level_id: int) -> bool:
	return level_id <= highest_completed() + 1
