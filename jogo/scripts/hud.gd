extends CanvasLayer
## Status no canto, dica de interação e barra de vida do chefe.

var extra := ""
var dica := ""

var _status: Label
var _dica: Label
var _barra_chefe: ProgressBar


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

	_barra_chefe = ProgressBar.new()
	_barra_chefe.anchor_left = 0.5
	_barra_chefe.anchor_right = 0.5
	_barra_chefe.anchor_top = 1.0
	_barra_chefe.anchor_bottom = 1.0
	_barra_chefe.offset_left = -110.0
	_barra_chefe.offset_right = 110.0
	_barra_chefe.offset_top = -18.0
	_barra_chefe.offset_bottom = -10.0
	_barra_chefe.show_percentage = false
	_barra_chefe.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var fundo := StyleBoxFlat.new()
	fundo.bg_color = Color(0.1, 0.05, 0.1, 0.8)
	var cheio := StyleBoxFlat.new()
	cheio.bg_color = Color(0.85, 0.15, 0.25)
	_barra_chefe.add_theme_stylebox_override("background", fundo)
	_barra_chefe.add_theme_stylebox_override("fill", cheio)
	_barra_chefe.visible = false
	add_child(_barra_chefe)


func _estilo(l: Label) -> void:
	l.add_theme_font_size_override("font_size", 11)
	l.add_theme_color_override("font_outline_color", Color.BLACK)
	l.add_theme_constant_override("outline_size", 4)


func _process(_delta: float) -> void:
	var texto := ""
	var j := get_tree().get_first_node_in_group("jogador")
	if j != null:
		texto += "Vida %d/%d" % [j.get("vida"), j.get("vida_max")]
		if j.get("pode_atacar"):
			var recarga: float = j.get("recarga_habilidade")
			if recarga > 0.0:
				texto += "   Hab. %ds" % ceili(recarga)
			else:
				texto += "   Hab. pronta"
		texto += "\n"
	texto += "Ouro %d   Sementes %d\nColheitas %d   Dia %d" % [
		Jogo.ouro, Jogo.sementes, Jogo.colheitas, Jogo.dia
	]
	if not Jogo.missao.is_empty():
		texto += "\nMissão: " + Jogo.texto_missao()
	if extra != "":
		texto += "\n" + extra
	_status.text = texto
	_dica.text = ("[E / USAR] " + dica) if dica != "" else ""

	var chefe := get_tree().get_first_node_in_group("chefe")
	_barra_chefe.visible = chefe != null
	if chefe != null:
		_barra_chefe.max_value = chefe.get("vida_max")
		_barra_chefe.value = chefe.get("vida")
