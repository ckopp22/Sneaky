class_name CharacterSprites

const DIRECTIONS: Array[String] = ["down", "up", "left", "right"]
const DIR: String = "res://assets/sprites/"
const FEET_Y: float = 10.0
const FPS: float = 10.0


static func create(character: String) -> AnimatedSprite2D:
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(DIR + character + ".json"))
	var texture: Texture2D = load(DIR + character + ".png")
	var frame: Array = data["frame"]
	var frame_size := Vector2(frame[0], frame[1])
	var rows: Dictionary = data["rows"]
	var walk: Array = data["walk"]
	var frames := SpriteFrames.new()
	frames.remove_animation("default")
	for direction: String in DIRECTIONS:
		var row: int = int(rows[direction])
		frames.add_animation(direction)
		frames.set_animation_speed(direction, FPS)
		for col: int in range(int(walk[0]), int(walk[1]) + 1):
			frames.add_frame(direction, _frame(texture, col, row, frame_size))
		frames.add_animation("idle_" + direction)
		frames.add_frame("idle_" + direction, _frame(texture, 0, row, frame_size))
	var sprite := AnimatedSprite2D.new()
	sprite.sprite_frames = frames
	sprite.animation = "idle_down"
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	sprite.position = Vector2(0.0, FEET_Y - (float(data["feet_y"]) - frame_size.y / 2.0))
	return sprite


static func direction_name(vector: Vector2) -> String:
	if absf(vector.x) > absf(vector.y):
		return "right" if vector.x > 0.0 else "left"
	return "down" if vector.y > 0.0 else "up"


static func _frame(texture: Texture2D, col: int, row: int, frame_size: Vector2) -> AtlasTexture:
	var atlas := AtlasTexture.new()
	atlas.atlas = texture
	atlas.region = Rect2(Vector2(col, row) * frame_size, frame_size)
	return atlas
