class_name CharacterSprites

const DIRECTIONS: Array[String] = ["down", "up", "left", "right"]
const DIR: String = "res://assets/sprites/"
const SCALE: float = 0.5
const FEET_Y: float = 10.0
const FPS: float = 8.0


static func create(character: String) -> AnimatedSprite2D:
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(DIR + character + ".json"))
	var texture: Texture2D = load(DIR + character + ".png")
	var frame: Array = data["frame"]
	var frame_size := Vector2(frame[0], frame[1])
	var counts: Dictionary = data["counts"]
	var frames := SpriteFrames.new()
	frames.remove_animation("default")
	for row: int in DIRECTIONS.size():
		var direction: String = DIRECTIONS[row]
		frames.add_animation(direction)
		frames.set_animation_speed(direction, FPS)
		for i: int in int(counts[direction]):
			var atlas := AtlasTexture.new()
			atlas.atlas = texture
			atlas.region = Rect2(Vector2(i, row) * frame_size, frame_size)
			frames.add_frame(direction, atlas)
	var sprite := AnimatedSprite2D.new()
	sprite.sprite_frames = frames
	sprite.animation = "down"
	sprite.scale = Vector2(SCALE, SCALE)
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	sprite.position = Vector2(0.0, FEET_Y - frame_size.y * SCALE / 2.0)
	return sprite


static func direction_name(vector: Vector2) -> String:
	if absf(vector.x) > absf(vector.y):
		return "right" if vector.x > 0.0 else "left"
	return "down" if vector.y > 0.0 else "up"
