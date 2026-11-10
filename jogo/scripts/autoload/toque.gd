extends CanvasLayer
## Controles de toque: joystick flutuante na metade esquerda e botoes na direita.
## So aparece em celular/tablet. No PC o jogo usa teclado ou controle.

const RAIO_JOY := 40.0

var ativo := false

var _tela: Control
var _joy_indice := -1
var _joy_centro := Vector2.ZERO
var _joy_pos := Vector2.ZERO
var _botoes := [
	{"acao": "atacar", "texto": "ATK", "raio": 32.0, "desloc": Vector2(-62, -62), "indice": -1},
	{"acao": "dash", "texto": "DASH", "raio": 22.0, "desloc": Vector2(-132, -42), "indice": -1},
	{"acao": "interagir", "texto": "USAR", "raio": 22.0, "desloc": Vector2(-62, -136), "indice": -1},
]


func _ready() -> void:
	layer = 30
	process_mode = Node.PROCESS_MODE_ALWAYS
	ativo = OS.has_feature("mobile") or OS.has_feature("web_android") \
		or OS.has_feature("web_ios") or DisplayServer.is_touchscreen_available()
	_tela = Control.new()
	_tela.set_anchors_preset(Control.PRESET_FULL_RECT)
	_tela.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_tela.visible = ativo
	add_child(_tela)
	_tela.draw.connect(_desenhar)


func _input(event: InputEvent) -> void:
	if not ativo:
		return
	if event is InputEventScreenTouch:
		_ao_tocar(event as InputEventScreenTouch)
	elif event is InputEventScreenDrag:
		var arrasto := event as InputEventScreenDrag
		if arrasto.index == _joy_indice:
			_joy_pos = arrasto.position
			var v: Vector2 = (_joy_pos - _joy_centro) / RAIO_JOY
			_aplicar(v.limit_length(1.0))
			_tela.queue_redraw()


func _ao_tocar(toque: InputEventScreenTouch) -> void:
	var tamanho := _tela.size
	if toque.pressed:
		for b in _botoes:
			var centro: Vector2 = tamanho + b["desloc"]
			var raio: float = b["raio"]
			if b["indice"] == -1 and toque.position.distance_to(centro) <= raio * 1.3:
				b["indice"] = toque.index
				Input.action_press(b["acao"])
				_tela.queue_redraw()
				return
		if _joy_indice == -1 and toque.position.x < tamanho.x * 0.5:
			_joy_indice = toque.index
			_joy_centro = toque.position
			_joy_pos = toque.position
			_aplicar(Vector2.ZERO)
	else:
		for b in _botoes:
			if b["indice"] == toque.index:
				b["indice"] = -1
				Input.action_release(b["acao"])
		if toque.index == _joy_indice:
			_joy_indice = -1
			_aplicar(Vector2.ZERO)
	_tela.queue_redraw()


func _aplicar(v: Vector2) -> void:
	_definir("mover_direita", maxf(v.x, 0.0))
	_definir("mover_esquerda", maxf(-v.x, 0.0))
	_definir("mover_baixo", maxf(v.y, 0.0))
	_definir("mover_cima", maxf(-v.y, 0.0))


func _definir(acao: String, forca: float) -> void:
	if forca > 0.05:
		Input.action_press(acao, forca)
	else:
		Input.action_release(acao)


func _desenhar() -> void:
	var tamanho := _tela.size
	var fonte := ThemeDB.fallback_font
	if _joy_indice != -1:
		_tela.draw_circle(_joy_centro, RAIO_JOY, Color(1, 1, 1, 0.15))
		var ponta := _joy_centro + (_joy_pos - _joy_centro).limit_length(RAIO_JOY)
		_tela.draw_circle(ponta, 14.0, Color(1, 1, 1, 0.4))
	else:
		_tela.draw_circle(Vector2(72, tamanho.y - 72), RAIO_JOY, Color(1, 1, 1, 0.08))
	for b in _botoes:
		var centro: Vector2 = tamanho + b["desloc"]
		var raio: float = b["raio"]
		var apertado: bool = b["indice"] != -1
		_tela.draw_circle(centro, raio, Color(1, 1, 1, 0.35 if apertado else 0.18))
		var texto: String = b["texto"]
		_tela.draw_string(fonte, centro + Vector2(-raio, 4), texto,
			HORIZONTAL_ALIGNMENT_CENTER, raio * 2.0, 10, Color(1, 1, 1, 0.85))
