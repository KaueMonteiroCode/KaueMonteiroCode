extends CanvasLayer
## Status no canto e dica de interacao embaixo.

var extra := ""
var dica := ""

var _status: Label
var _dica: Label


func _ready() -> void:
	layer = 10
	_status = Label.new()
	_status.position = Vector2(8, 6)
	_estilo(_status)
	add_child(_status)

	_dica = Label.new()
	_dica.anchor_left = 0.0
	_dica.anchor_right = 1.0
	_dica.anchor_top = 1.0
	_dica.anchor_bottom = 1.0
	_dica.offset_top = -44.0
	_dica.offset_bottom = -26.0
	_dica.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_dica.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_estilo(_dica)
	add_child(_dica)


func _estilo(l: Label) -> void:
	l.add_theme_font_size_override("font_size", 11)
	l.add_theme_color_override("font_outline_color", Color.BLACK)
	l.add_theme_constant_override("outline_size", 4)


func _process(_delta: float) -> void:
	var texto := ""
	var j := get_tree().get_first_node_in_group("jogador")
	if j != null:
		texto += "Vida %d/%d\n" % [j.get("vida"), j.get("vida_max")]
	texto += "Ouro %d   Sementes %d\nColheitas %d   Dia %d" % [
		Jogo.ouro, Jogo.sementes, Jogo.colheitas, Jogo.dia
	]
	if extra != "":
		texto += "\n" + extra
	_status.text = texto
	_dica.text = ("[E / USAR] " + dica) if dica != "" else ""
