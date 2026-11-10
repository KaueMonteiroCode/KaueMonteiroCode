extends CanvasLayer
## O Mestre do jogo: mostra falas com efeito de maquina de escrever e rola dados.

const LETRAS_POR_SEGUNDO := 50.0

var _fila: Array = []
var _painel: PanelContainer
var _texto: Label
var _letras := 0.0
var _espera := 0.0
var _mostrando := false


func _ready() -> void:
	layer = 20
	process_mode = Node.PROCESS_MODE_ALWAYS

	_painel = PanelContainer.new()
	_painel.anchor_left = 0.5
	_painel.anchor_right = 0.5
	_painel.offset_left = -170.0
	_painel.offset_right = 170.0
	_painel.offset_top = 6.0
	_painel.mouse_filter = Control.MOUSE_FILTER_IGNORE

	var estilo := StyleBoxFlat.new()
	estilo.bg_color = Color(0.95, 0.89, 0.74, 0.95)
	estilo.border_color = Color(0.35, 0.22, 0.1)
	estilo.set_border_width_all(2)
	estilo.set_corner_radius_all(4)
	estilo.set_content_margin_all(6)
	_painel.add_theme_stylebox_override("panel", estilo)

	_texto = Label.new()
	_texto.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_texto.visible_characters_behavior = TextServer.VC_CHARS_AFTER_SHAPING
	_texto.custom_minimum_size = Vector2(320, 0)
	_texto.add_theme_color_override("font_color", Color(0.2, 0.12, 0.05))
	_texto.add_theme_font_size_override("font_size", 11)
	_painel.add_child(_texto)

	add_child(_painel)
	_painel.visible = false


func falar(texto: String) -> void:
	_fila.append(texto)


func limpar() -> void:
	_fila.clear()
	_mostrando = false
	_painel.visible = false


## Rola um d20 na frente do jogador e narra o resultado.
func rolar_d20(motivo: String) -> int:
	var resultado := randi_range(1, 20)
	var extra := ""
	if resultado == 20:
		extra = " CRÍTICO!"
	elif resultado == 1:
		extra = " Falha crítica..."
	falar("[d20] %s: %d.%s" % [motivo, resultado, extra])
	return resultado


func _process(delta: float) -> void:
	if not _mostrando:
		if _fila.is_empty():
			return
		_texto.text = _fila.pop_front()
		_texto.visible_characters = 0
		_letras = 0.0
		_espera = 0.0
		_mostrando = true
		_painel.visible = true
		_painel.call_deferred("reset_size")
		return

	var total := _texto.text.length()
	if _texto.visible_characters < total:
		var velocidade := LETRAS_POR_SEGUNDO * (2.0 if _fila.size() > 2 else 1.0)
		_letras += delta * velocidade
		_texto.visible_characters = mini(int(_letras), total)
		return

	_espera += delta
	var limite := 1.2 + total * 0.025
	if _fila.size() > 2:
		limite = 0.8
	if _espera >= limite:
		_mostrando = false
		if _fila.is_empty():
			_painel.visible = false
