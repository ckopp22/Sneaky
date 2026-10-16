class_name UiTheme

const DIR: String = "res://assets/ui/"
const TEXT: Color = Color("e8eefa")
const TEXT_DIM: Color = Color("6a7aa0")


static func build() -> Theme:
	var theme := Theme.new()
	theme.default_font_size = 16
	theme.set_color("font_color", "Label", TEXT)
	for state: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		theme.set_color(state, "Button", TEXT)
	theme.set_color("font_disabled_color", "Button", TEXT_DIM)
	theme.set_stylebox("panel", "PanelContainer", _box("panels/panel", 0))
	_button(theme, "Button", "btn_primary", "btn_primary_pressed", "btn_disabled")
	_button(theme, "SecondaryButton", "btn_secondary", "btn_secondary_pressed", "btn_disabled")
	_button(theme, "SuccessButton", "btn_success", "btn_success_pressed", "btn_disabled")
	_button(theme, "SquareButton", "btn_square_secondary", "btn_square_secondary_pressed", "btn_square_disabled")
	_button(theme, "LevelButton", "level_open", "level_open_pressed", "level_locked")
	_button(theme, "LevelDoneButton", "level_done", "level_done", "level_locked")
	return theme


static func _button(theme: Theme, type: String, normal: String, pressed: String, disabled: String) -> void:
	if type != "Button":
		theme.set_type_variation(type, "Button")
	theme.set_stylebox("normal", type, _box("buttons/" + normal, 12))
	theme.set_stylebox("hover", type, _box("buttons/" + normal, 12))
	theme.set_stylebox("pressed", type, _box("buttons/" + pressed, 12))
	theme.set_stylebox("disabled", type, _box("buttons/" + disabled, 12))
	theme.set_stylebox("focus", type, StyleBoxEmpty.new())


static func _box(path: String, content_margin: float) -> StyleBoxTexture:
	var box := StyleBoxTexture.new()
	box.texture = load(DIR + path + ".png") as Texture2D
	box.set_texture_margin_all(8.0)
	box.set_content_margin_all(content_margin)
	return box
